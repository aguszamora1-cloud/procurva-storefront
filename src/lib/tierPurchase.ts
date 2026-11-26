// Compra por escalones «Lleva N» (category_volume_tiers) y el agregado común de
// un producto suelto: cálculos y validaciones PUROS, compartidos por la ficha de
// Classic (pages/ProductDetail.tsx) y las plantillas.
//
// Extraído tal cual de ProductDetail (P1.2-B1). No hay reglas nuevas: mismas
// bases de precio, mismo orden de campos en las líneas del carrito, mismo
// control de stock. El estado vive en hooks/useTierPurchase.ts.

import { tierUnitPrices, type CategoryTierConfig } from './categoryTiers';
import { tierTotalSavings, type QuantityTierOption } from '@/components/QuantityTierSelector';
import type { UnitSelection } from '@/components/UnitVariantRows';
import type { CartItem, Product, Variant } from './types';
import type { Promotion } from './promotions';

/** Una tarjeta del selector: el baseline «Lleva 1» o un escalón de la DB. */
export interface TierCard {
  units: number;
  discountPct: number;
  isFeatured: boolean;
}

const BASELINE: TierCard = { units: 1, discountPct: 0, isFeatured: false };

/** Tarjetas a mostrar: baseline «Lleva 1» (precio normal) + los escalones de la DB. */
export function tierCardsFor(config: CategoryTierConfig | null): TierCard[] {
  return config
    ? [BASELINE, ...config.tiers.map((t) => ({ units: t.minQuantity, discountPct: t.discountPct, isFeatured: t.isFeatured }))]
    : [];
}

/** El escalón elegido (o el baseline). */
export function selectedTierCard(cards: TierCard[], units: number): TierCard {
  return cards.find((t) => t.units === units) ?? cards[0] ?? BASELINE;
}

/**
 * Escalones ya calculados para QuantityTierSelector (el componente no calcula).
 * Protagonista = contado si hay; la línea "tarjeta" sólo si es más caro. El
 * ahorro sale del MISMO precio que se muestra en el baseline «Lleva 1» (que ya
 * tiene la promo automática aplicada), no del precio de lista.
 */
export function buildTierOptions(args: {
  cards: TierCard[];
  activeUnits: number;
  finalPrice: number;
  finalCash: number | null;
  layout: 'cards' | 'list' | string;
}): QuantityTierOption[] {
  const { cards, activeUnits, finalPrice, finalCash, layout } = args;
  const tierPrices = (discountPct: number) => tierUnitPrices(finalPrice, finalCash, discountPct);
  const baselineUnitPrice = (() => {
    const p = tierPrices(0);
    return p.cash ?? p.card;
  })();
  return cards.map((t) => {
    const p = tierPrices(t.discountPct);
    const unitPrice = p.cash ?? p.card;
    return {
      units: t.units,
      discountPct: t.discountPct,
      unitPrice,
      cardPrice: p.cash != null && p.cash < p.card ? p.card : null,
      // Tachado sólo en 'list' y sólo con descuento: ahí cada fila se lee sola y
      // necesita contra qué comparar. En 'cards' la comparación la da la tarjeta
      // "Lleva 1" de al lado, así que sumarlo sería ruido. El baseline no lleva.
      strikePrice: layout === 'list' && t.discountPct > 0 ? baselineUnitPrice : null,
      savings: tierTotalSavings(baselineUnitPrice, unitPrice, t.units),
      isFeatured: t.isFeatured,
      isActive: activeUnits === t.units,
    };
  });
}

/** Dimensiones de las variantes del producto (para resolver talle + color). */
export interface VariantSpace {
  variants: Variant[];
  colors: string[];
  sizes: string[];
}

/** La variante (fila product_variants) de un talle + color. */
export function findVariant({ variants, colors, sizes }: VariantSpace, size: string | null, color: string | null): Variant | null {
  return variants.find((v) => (colors.length === 0 || v.color === color) && (sizes.length === 0 || v.size === size)) ?? null;
}

/** Talles sin stock para el color de esa unidad (deshabilitados en su selector). */
export function sizeDisabledForColor({ variants, colors }: VariantSpace, color: string | null) {
  return (size: string) =>
    !variants.some((v) => v.size === size && (colors.length === 0 || !color || v.color === color) && (v.stock ?? 0) > 0);
}

/**
 * Mantiene `tierSelections` con exactamente `tierUnits` slots (uno por unidad),
 * preservando lo ya elegido al cambiar de escalón. Las unidades NUEVAS arrancan
 * con lo que ya eligió arriba. Devuelve `prev` cuando no hay nada que cambiar.
 * Fuera del modo escalón el array se vacía.
 */
export function syncTierSelections(
  prev: UnitSelection[],
  tierUnits: number,
  selectedSize: string | null,
  selectedColor: string | null,
): UnitSelection[] {
  if (tierUnits <= 1) return prev.length === 0 ? prev : [];
  if (prev.length === tierUnits) return prev;
  const next = prev.slice(0, tierUnits);
  while (next.length < tierUnits) next.push({ size: selectedSize, color: selectedColor });
  return next;
}

/**
 * Selecciones efectivas por unidad: con filas por unidad, cada unidad su
 * variante; si no (categoría con variantPerUnit=false, o nada que elegir), las N
 * comparten la variante del selector único.
 */
export function effectiveSelections(args: {
  inTierMode: boolean;
  perUnitOpen: boolean;
  tierSelections: UnitSelection[];
  tierUnits: number;
  selectedSize: string | null;
  selectedColor: string | null;
}): UnitSelection[] {
  const { inTierMode, perUnitOpen, tierSelections, tierUnits, selectedSize, selectedColor } = args;
  return !inTierMode
    ? []
    : perUnitOpen
      ? tierSelections
      : Array.from({ length: tierUnits }, () => ({ size: selectedSize, color: selectedColor }));
}

/**
 * Resumen de la variante (barra fija del celular). Cuando las N unidades
 * comparten variante se nombra; con variantes distintas, "surtido".
 */
export function tierVariantLabel(sel: UnitSelection[]): string | null {
  if (sel.length === 0) return null;
  const [first] = sel;
  if (!sel.every((s) => s.size === first.size && s.color === first.color)) return 'surtido';
  const parts = [first.color, first.size].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * ¿Todas las N unidades tienen una variante válida y con stock suficiente?
 * Respeta el stock agregado: si dos unidades eligen la misma variante, exige
 * stock >= 2 para esa variante.
 */
export function isTierSelectionValid(args: {
  inTierMode: boolean;
  selections: UnitSelection[];
  tierUnits: number;
  finalPrice: number;
  space: VariantSpace;
}): boolean {
  const { inTierMode, selections, tierUnits, finalPrice, space } = args;
  if (!inTierMode || selections.length !== tierUnits || !(finalPrice > 0)) return false;
  const counts = new Map<string, number>();
  for (const sel of selections) {
    const v = findVariant(space, sel.size, sel.color);
    if (!v) return false;
    counts.set(v.id, (counts.get(v.id) ?? 0) + 1);
  }
  for (const [vid, n] of counts) {
    const v = space.variants.find((x) => x.id === vid);
    if (!v || (v.stock ?? 0) < n) return false;
  }
  return true;
}

/**
 * Por qué una selección de escalón no se puede agregar (null = se puede, en lo
 * que respecta a variantes y stock). Mismas reglas que isTierSelectionValid,
 * con el detalle para explicárselo al comprador:
 *  - 'unit': a esa unidad (índice desde 0) le falta color o talle.
 *  - 'stock': esa variante no alcanza para las `requested` unidades que la piden.
 * No informa cuánto stock hay: sólo que no alcanza.
 */
export type TierIssue =
  | { kind: 'unit'; unit: number }
  | { kind: 'stock'; variant: Variant; requested: number }
  | null;

export function tierSelectionIssue(args: { inTierMode: boolean; selections: UnitSelection[]; tierUnits: number; space: VariantSpace }): TierIssue {
  const { inTierMode, selections, tierUnits, space } = args;
  if (!inTierMode) return null;
  const counts = new Map<string, number>();
  for (let i = 0; i < tierUnits; i++) {
    const sel = selections[i];
    const v = sel ? findVariant(space, sel.size, sel.color) : null;
    if (!v) return { kind: 'unit', unit: i };
    counts.set(v.id, (counts.get(v.id) ?? 0) + 1);
  }
  for (const [vid, n] of counts) {
    const v = space.variants.find((x) => x.id === vid);
    if (v && (v.stock ?? 0) < n) return { kind: 'stock', variant: v, requested: n };
  }
  return null;
}

/** Etiqueta del grupo en el carrito ("Lleva 3 — 20% OFF"). */
export function tierGroupLabel(card: TierCard): string {
  return `Lleva ${card.units}${card.discountPct > 0 ? ` — ${card.discountPct}% OFF` : ''}`;
}

/** Precios del escalón para UN talle (con precio por talle cada unidad vale lo suyo). */
export interface TierUnitPrice {
  card: number;
  cash: number | null;
  listPrice: number;
}

/**
 * Líneas del carrito de un escalón: una por unidad, con el descuento ya aplicado
 * en unit_price (tarjeta) y unit_price_cash (contado), y el precio de lista en
 * unit_price_original para el tachado. Mismo orden de campos que ProductDetail.
 */
export function buildTierCartItems(args: {
  product: Pick<Product, 'id' | 'name'>;
  categories: string[];
  selections: UnitSelection[];
  card: TierCard;
  groupId: string;
  space: VariantSpace;
  pricesForSize: (size: string | null, discountPct: number) => TierUnitPrice;
  fallbackImage: string | null;
}): CartItem[] {
  const { product, categories, selections, card, groupId, space, pricesForSize, fallbackImage } = args;
  const label = tierGroupLabel(card);
  const items: CartItem[] = [];
  for (const sel of selections) {
    const v = findVariant(space, sel.size, sel.color);
    if (!v) continue;
    const { card: unitPrice, cash: unitCash, listPrice } = pricesForSize(v.size, card.discountPct);
    items.push({
      product_id: product.id,
      variant_id: v.id,
      name: product.name,
      categories,
      size: v.size,
      color: v.color,
      // El descuento del escalón (de la DB) ya viene aplicado en unit_price (tarjeta).
      unit_price: unitPrice,
      // Precio de lista SIN el descuento del escalón, para el tachado del carrito.
      unit_price_original: listPrice,
      // Precio de efectivo/transferencia ya con el descuento del escalón aplicado.
      ...(unitCash != null ? { unit_price_cash: unitCash } : {}),
      qty: 1,
      image_url: v.image_url ?? fallbackImage,
      source: 'tier',
      tierGroupId: groupId,
      tierLabel: label,
    });
  }
  return items;
}

/**
 * Línea del carrito de un producto suelto (el agregado común). Precio ya con la
 * promo automática (el cliente paga lo que ve); contado si es más barato; datos
 * de la promo para el tachado y el tracking. Mismo orden de campos que Classic.
 */
export function buildSingleCartItem(args: {
  product: Pick<Product, 'id' | 'name'>;
  categories: string[];
  variant: Variant;
  finalPrice: number;
  finalCash: number | null;
  mainPrice: number;
  /** Contado de lista (getPriceInfo, sin promo), o null si no hay contado. */
  cashPrice: number | null;
  promo: Promotion | null;
  fallbackImage: string | null;
}): CartItem {
  const { product, categories, variant, finalPrice, finalCash, mainPrice, cashPrice, promo, fallbackImage } = args;
  const hasCash = finalCash != null && finalCash < finalPrice;
  return {
    product_id: product.id,
    variant_id: variant.id,
    name: product.name,
    categories,
    size: variant.size,
    color: variant.color,
    unit_price: finalPrice,
    ...(hasCash ? { unit_price_cash: finalCash } : {}),
    ...(promo
      ? {
          promo_id: promo.id,
          promo_name: promo.name,
          unit_price_original: mainPrice,
          ...(hasCash && cashPrice != null ? { unit_price_cash_original: cashPrice } : {}),
          promo_stackable: promo.stackable_with_coupons !== false,
        }
      : {}),
    qty: 1,
    image_url: variant.image_url ?? fallbackImage,
  };
}
