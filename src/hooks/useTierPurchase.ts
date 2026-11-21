import { useEffect, useState } from 'react';
import { useStore } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { usePromotions } from '@/context/PromotionsContext';
import { useCategoryTiers } from '@/context/CategoryTiersContext';
import { tierUnitPrices } from '@/lib/categoryTiers';
import {
  buildTierCartItems,
  buildTierOptions,
  effectiveSelections,
  isTierSelectionValid,
  selectedTierCard,
  sizeDisabledForColor,
  syncTierSelections,
  tierCardsFor,
  tierVariantLabel as variantLabelOf,
  type VariantSpace,
} from '@/lib/tierPurchase';
import { getPriceInfo, productCategories } from '@/lib/utils';
import type { QuantityTierOption } from '@/components/QuantityTierSelector';
import type { UnitSelection } from '@/components/UnitVariantRows';
import type { Product, Variant } from '@/lib/types';

interface Params {
  /** null mientras carga: el hook se llama antes de los returns tempranos. */
  product: Product | null;
  variants: Variant[];
  colors: string[];
  sizes: string[];
  selectedSize: string | null;
  selectedColor: string | null;
  setSelectedSize: (s: string | null) => void;
  setSelectedColor: (c: string | null) => void;
  /** Fotos del producto (fallback de la imagen de cada línea). */
  images: string[];
  /** Meta Pixel u otro registro, con el valor efectivamente agregado. */
  trackAddToCart?: (p: { contentId: string; name: string; value: number }) => void;
}

export interface TierPurchase {
  tierUnits: number;
  setTierUnits: (n: number) => void;
  tierSelections: UnitSelection[];
  /** El producto tiene escalones (además del «Lleva 1»). */
  hasTiers: boolean;
  tierOptions: QuantityTierOption[];
  /** Hay un escalón de más de una unidad elegido. */
  inTierMode: boolean;
  /** Se muestran las filas de variante por unidad (y no los selectores únicos). */
  perUnitOpen: boolean;
  effectiveTierSelections: UnitSelection[];
  tierVariantLabel: string | null;
  tierValid: boolean;
  /** Texto del botón en modo escalón. */
  tierCtaLabel: string;
  sizeDisabledFor: (color: string | null) => (size: string) => boolean;
  updateTierUnit: (i: number, patch: Partial<UnitSelection>) => void;
  /** La guía de talles aplica el talle sugerido a todas las unidades. */
  setAllUnitSizes: (size: string) => void;
  handleAddTier: () => void;
}

/**
 * Compra por escalones «Lleva N» de la ficha. Estado + acciones; los cálculos
 * están en lib/tierPurchase.ts. Extraído de pages/ProductDetail.tsx (P1.2-B1)
 * sin cambiar el comportamiento: lo usan Classic y las plantillas.
 *
 * Las bases de precio son las mismas que la ficha: precio por talle
 * (getPriceInfo) y promo automática por color (priceFor).
 */
export function useTierPurchase(p: Params): TierPurchase {
  const { product, variants, colors, sizes, selectedSize, selectedColor, setSelectedSize, setSelectedColor, images, trackAddToCart } = p;
  const config = useStore();
  const { addItem } = useCart();
  const { priceFor } = usePromotions();
  const { tiersForProduct } = useCategoryTiers();

  // Cantidad de unidades del escalón elegido (1 = flujo normal suelto) y la
  // variante elegida por cada unidad (talle + color).
  const [tierUnits, setTierUnits] = useState(1);
  const [tierSelections, setTierSelections] = useState<UnitSelection[]>([]);

  // Mantener `tierSelections` con exactamente `tierUnits` slots (ver syncTierSelections).
  useEffect(() => {
    setTierSelections((prev) => syncTierSelections(prev, tierUnits, selectedSize, selectedColor));
  }, [tierUnits, selectedSize, selectedColor]);

  // Al cambiar de producto (la ruta reusa el componente), volver al escalón base.
  useEffect(() => {
    setTierUnits(1);
    setTierSelections([]);
  }, [product?.id]);

  const space: VariantSpace = { variants, colors, sizes };
  // Precio de la ficha para el talle y color elegidos (mismo cálculo que ProductDetail).
  const info = product ? getPriceInfo(product, selectedSize) : null;
  const finalPrice = product && info ? priceFor(info.mainPrice, product, selectedColor).finalPrice : 0;
  const finalCash = product && info && info.cashPrice != null ? priceFor(info.cashPrice, product, selectedColor).finalPrice : null;

  // Config de escalones de la categoría del producto (precedencia por sort_order).
  const tierConfig = product ? tiersForProduct(product) : null;
  const variantPerUnit = tierConfig?.variantPerUnit ?? true;
  const tierCards = tierCardsFor(tierConfig);
  const hasTiers = tierCards.length > 1;
  const selectedTier = selectedTierCard(tierCards, tierUnits);
  const tierOptions = buildTierOptions({
    cards: tierCards,
    activeUnits: tierUnits,
    finalPrice,
    finalCash,
    layout: config.quantityTiersLayout,
  });

  const inTierMode = hasTiers && tierUnits > 1;
  // Filas por unidad: más de una unidad, la categoría pide variante por unidad y
  // hay ALGO que elegir (un solo color y un solo talle no abre N filas iguales).
  const perUnitOpen = inTierMode && variantPerUnit && (colors.length > 1 || sizes.length > 1);
  const effectiveTierSelections = effectiveSelections({ inTierMode, perUnitOpen, tierSelections, tierUnits, selectedSize, selectedColor });
  const tierValid = isTierSelectionValid({ inTierMode, selections: effectiveTierSelections, tierUnits, finalPrice, space });

  const updateTierUnit = (i: number, patch: Partial<UnitSelection>) => {
    setTierSelections((prev) => prev.map((u, idx) => (idx === i ? { ...u, ...patch } : u)));
    // Las filas por unidad no tocan selectedColor/selectedSize, así que se espeja
    // la PRIMERA unidad en ellos: la galería salta a la foto de ese color y, al
    // volver a «Lleva 1», el flujo suelto aparece con lo último elegido.
    if (i === 0) {
      if (patch.color !== undefined) setSelectedColor(patch.color);
      if (patch.size !== undefined) setSelectedSize(patch.size);
    }
  };

  // Precios del escalón para UN talle: con precio por talle cada unidad vale lo
  // suyo. El color sale de `selectedColor` para las promos, igual que antes.
  const pricesForSize = (size: string | null, discountPct: number) => {
    const pi = getPriceInfo(product as Product, size);
    const listPrice = priceFor(pi.mainPrice, product as Product, selectedColor).finalPrice;
    const listCash = pi.cashPrice != null ? priceFor(pi.cashPrice, product as Product, selectedColor).finalPrice : null;
    return { ...tierUnitPrices(listPrice, listCash, discountPct), listPrice };
  };

  const handleAddTier = () => {
    if (!tierValid || !product) return;
    const lines = buildTierCartItems({
      product,
      categories: productCategories(product),
      selections: effectiveTierSelections,
      card: selectedTier,
      groupId: `tier-${product.id}-${selectedTier.units}-${Date.now()}`,
      space,
      pricesForSize,
      fallbackImage: images[0] ?? null,
    });
    let trackedValue = 0;
    for (const line of lines) {
      trackedValue += line.unit_price;
      addItem(line);
    }
    trackAddToCart?.({ contentId: product.id, name: product.name, value: trackedValue });
    // Reset al flujo normal (Lleva 1).
    setTierUnits(1);
    setTierSelections([]);
  };

  return {
    tierUnits,
    setTierUnits,
    tierSelections,
    hasTiers,
    tierOptions,
    inTierMode,
    perUnitOpen,
    effectiveTierSelections,
    tierVariantLabel: variantLabelOf(effectiveTierSelections),
    tierValid,
    tierCtaLabel: tierValid ? `AGREGAR ${tierUnits} AL CARRITO` : 'ELEGÍ LAS VARIANTES',
    sizeDisabledFor: (color) => sizeDisabledForColor(space, color),
    updateTierUnit,
    setAllUnitSizes: (size) => setTierSelections((prev) => prev.map((u) => ({ ...u, size }))),
    handleAddTier,
  };
}

