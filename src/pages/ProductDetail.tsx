import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, Eye, Ruler, Tag, Truck } from 'lucide-react';
import { useProduct } from '@/hooks/useProduct';
import { useMetaPixel } from '@/hooks/useMetaPixel';
import { useStore, useStoreType } from '@/context/StoreProvider';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { useCart } from '@/context/CartContext';
import { usePromotions } from '@/context/PromotionsContext';
import { useCategoryTiers } from '@/context/CategoryTiersContext';
import { tierUnitPrices } from '@/lib/categoryTiers';
import { Seo } from '@/components/Seo';
import { ProductGallery, type GalleryItem } from '@/components/ProductGallery';
import { ColorSelector } from '@/components/ColorSelector';
import { SizeSelector } from '@/components/SizeSelector';
import { SizeFinder } from '@/components/SizeFinder';
import { TrustBadges } from '@/components/TrustBadges';
import { ShippingCalculator } from '@/components/ShippingCalculator';
import { PriceStack } from '@/components/PriceStack';
import { CouponPdpChip } from '@/components/CouponChip';
import { WholesalePurchasePanel } from '@/components/WholesalePurchasePanel';
import { PromoCountdown } from '@/components/PromoCountdown';
import { QuantityTierSelector, tierTotalSavings, type QuantityTierOption } from '@/components/QuantityTierSelector';
import { CardBadge } from '@/components/CardBadge';
import { ProductDetailCustomSlot, CustomSectionNode } from '@/components/ProductDetailCustomSlot';
import { RelatedProducts } from '@/components/RelatedProducts';
import { ComplementaryBlock } from '@/components/ComplementaryBlock';
import { OtherColorsBlock } from '@/components/OtherColorsBlock';
import { OutfitForProductBlock } from '@/components/OutfitForProductBlock';
import { PolicyAccordions } from '@/components/PolicyAccordions';
import { ProductReviews } from '@/components/ProductReviews';
import { ProductReels } from '@/components/ProductReels';
import { PurchaseFlow } from '@/components/PurchaseFlow';
import { UnitVariantRows, type UnitSelection } from '@/components/UnitVariantRows';
import { VirtualTryOn, mapFashnCategory } from '@/components/VirtualTryOn';
import { useProductDetailCustomSections } from '@/hooks/useProductDetailCustomSections';
import { useProductBadges } from '@/hooks/useProductBadges';
import { formatPrice, getPriceInfo, productImages, sortSizes } from '@/lib/utils';
import { buildWhatsappInquiry } from '@/lib/checkout';
import { track } from '@/lib/tracking';
import { isCustomToken, customTokenId, type ProductLayout } from '@/lib/productLayout';
import type { CustomSection, Product, ProductDetailSlot, StoreConfig, Variant } from '@/lib/types';

/**
 * Renderiza la zona "debajo del producto" (ancho completo) en el ORDEN del
 * layout configurado. Recorre `layout.below_product`: cada token es un bloque
 * predefinido (purchase_flow/reviews/related) o una referencia `custom:<id>` a
 * una sección custom de ese slot; los tokens desconocidos se ignoran. Las custom
 * sections visibles que no estén referenciadas se agregan al final (forward-compat
 * para secciones creadas después de configurar el layout). Sólo se usa cuando el
 * tenant configuró un layout; sin layout, ProductDetail cae al render legacy.
 */
function BelowProductBlocks({
  layout,
  product,
  config,
  sections,
}: {
  layout: ProductLayout;
  product: Product;
  config: StoreConfig;
  sections: CustomSection[];
}) {
  const belowCustoms = sections.filter((s) => (s.content as { slot?: ProductDetailSlot }).slot === 'below_product');
  const byId = new Map(belowCustoms.map((s) => [s.id, s]));
  const referenced = new Set<string>();
  const nodes: ReactNode[] = [];

  for (const token of layout.below_product) {
    if (isCustomToken(token)) {
      const sec = byId.get(customTokenId(token));
      if (sec) {
        referenced.add(sec.id);
        nodes.push(<CustomSectionNode key={token} section={sec} />);
      }
      continue;
    }
    switch (token) {
      case 'purchase_flow':
        nodes.push(
          <div key="purchase_flow" className="mx-auto max-w-[1200px] px-6">
            <PurchaseFlow />
          </div>,
        );
        break;
      // Videos del producto ("Mirá cómo queda"). Sistema aparte de 'reviews':
      // aquéllas salen de catalog_testimonials, éstos de catalog_reels.
      case 'reels':
        nodes.push(<ProductReels key="reels" productId={product.id} />);
        break;
      case 'reviews':
        if (config.isPro && config.sections.productReviews) {
          nodes.push(
            <div key="reviews" className="px-6 pb-4 md:px-10 lg:px-16">
              <ProductReviews />
            </div>,
          );
        }
        break;
      case 'related':
        if (config.isPro && config.sections.upsell) {
          nodes.push(<RelatedProducts key="related" product={product} />);
        }
        break;
      // 'upsells' (Complementarios manuales) ahora vive en la columna derecha de la
      // ficha; 'related' quedó como descubrimiento por categoría ("También te puede
      // gustar"). Cualquier otro token se ignora.
      default:
        break;
    }
  }

  // Forward-compat: custom sections visibles de below_product que el layout aún no
  // referencia (p. ej. creadas después). Se muestran al final para no perderlas.
  for (const sec of belowCustoms) {
    if (!referenced.has(sec.id)) nodes.push(<CustomSectionNode key={`unref-${sec.id}`} section={sec} />);
  }

  return <>{nodes}</>;
}

// "X personas viendo" determinístico (sin Math.random, para estabilidad).
function viewersFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 6 + (h % 18);
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { product, isLoading, error } = useProduct(id);
  const config = useStore();
  const isWholesale = useStoreType() === 'wholesale';
  const { addItem } = useCart();
  const { trackViewContent, trackAddToCart } = useMetaPixel();
  const { priceFor, promoForProduct, quantityPromoFor, quantityMessageFor } = usePromotions();
  const { tiersForProduct } = useCategoryTiers();
  const { sections: pdSections } = useProductDetailCustomSections();
  // Badges de la ficha: misma fuente de verdad que la grilla (config.badges +
  // candidatos/prioridad). En el detalle se renderizan inline (sin esquina).
  const { badges: detailBadges, style: badgeStyle, showIcons: badgeShowIcons } = useProductBadges(product);

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  // PROTOTIPO volume tiers: cantidad de unidades del escalón elegido (1 = flujo
  // normal suelto) y la variante elegida por cada unidad (talle + color).
  const [tierUnits, setTierUnits] = useState(1);
  const [tierSelections, setTierSelections] = useState<UnitSelection[]>([]);
  const [showSticky, setShowSticky] = useState(false);
  const [showSizeFinder, setShowSizeFinder] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  // Gate de pintado: la ficha aparece de una sola vez. Además de los datos del
  // producto esperamos a que la FOTO principal esté descargada — era lo último
  // en llegar y dejaba el hueco de la galería en blanco. Si el producto no
  // existe (404), no hay foto que esperar.
  const [galleryReady, setGalleryReady] = useState(false);
  const onGalleryReady = useCallback(() => setGalleryReady(true), []);
  // El reset al cambiar de producto va en RENDER, no en un efecto: los efectos
  // pasivos corren después del paint y llegaban a pisar el `onLoad` de una foto
  // cacheada (la ficha quedaba esperando una imagen que ya estaba).
  const [galleryProductId, setGalleryProductId] = useState<string | undefined>(product?.id);
  if (product?.id !== galleryProductId) {
    setGalleryProductId(product?.id);
    setGalleryReady(false);
  }
  useFirstPaintGate('product-detail', isLoading || (!!product && !galleryReady));

  const variants: Variant[] = product?.product_variants ?? [];
  const colors = useMemo(
    () => Array.from(new Set(variants.filter((v) => v.color).map((v) => v.color as string))),
    [variants],
  );
  const sizes = useMemo(
    () => sortSizes(Array.from(new Set(variants.filter((v) => v.size).map((v) => v.size as string)))),
    [variants],
  );

  const variant = useMemo(
    () =>
      variants.find(
        (v) => (colors.length === 0 || v.color === selectedColor) && (sizes.length === 0 || v.size === selectedSize),
      ) ?? null,
    [variants, colors.length, sizes.length, selectedColor, selectedSize],
  );

  const sizeDisabled = (size: string) =>
    !variants.some(
      (v) => v.size === size && (colors.length === 0 || !selectedColor || v.color === selectedColor) && (v.stock ?? 0) > 0,
    );

  // Color agotado: ninguna variante de ese color tiene stock. A diferencia de
  // sizeDisabled NO cruza con el talle elegido, a propósito: si lo hiciera, elegir
  // un talle podría deshabilitar todos los colores y dejar al comprador trabado sin
  // forma de volver atrás. El talle sí se recalcula al cambiar de color (ese es el
  // orden de elección real), así que la asimetría es la correcta.
  const colorDisabled = (color: string) => !variants.some((v) => v.color === color && (v.stock ?? 0) > 0);

  const images = product ? productImages(product) : [];
  // Galería unificada: si product_media ya tiene imágenes, es la fuente (orden
  // por sort_order, fotos y videos intercalados como los dejó el comercio). Si
  // no (legacy sin backfill), fallback: imágenes de products.images + videos de
  // product_media al final (comportamiento previo).
  const galleryItems = useMemo<GalleryItem[]>(() => {
    const rows = (product?.product_media ?? [])
      .filter((m) => !!m.url)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    const hasImageRows = rows.some((m) => m.type === 'image');
    if (hasImageRows) {
      return rows.map((m): GalleryItem =>
        m.type === 'video'
          ? { kind: 'video', src: m.url, poster: m.thumbnail_url ?? undefined, objectPosition: m.object_position ?? undefined }
          : { kind: 'image', src: m.url },
      );
    }
    const imgItems: GalleryItem[] = images.map((src) => ({ kind: 'image', src }));
    const videoItems: GalleryItem[] = rows
      .filter((m) => m.type === 'video')
      .map((m) => ({ kind: 'video', src: m.url, poster: m.thumbnail_url ?? undefined, objectPosition: m.object_position ?? undefined }));
    return [...imgItems, ...videoItems];
  }, [images, product?.product_media]);

  // Al elegir un color, saltar a la foto de esa variante dentro de la galería.
  const activeImageIndex = useMemo(() => {
    if (!selectedColor) return undefined;
    const variantImg = variants.find((v) => v.color === selectedColor && v.image_url)?.image_url;
    if (!variantImg) return undefined;
    const i = galleryItems.findIndex((it) => it.kind === 'image' && it.src === variantImg);
    return i >= 0 ? i : undefined;
  }, [selectedColor, variants, galleryItems]);

  useEffect(() => {
    const el = addBtnRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        // La ÚLTIMA entry, no la primera. Un solo callback puede traer varias
        // observaciones encoladas, y la primera puede ser un estado intermedio ya
        // vencido. Pasa de verdad, no en teoría: al elegir "Lleva 3" el layout se
        // reacomoda y el navegador entrega [isIntersecting:true (top 467),
        // isIntersecting:false (top 867)] en la misma tanda — medido a 375×667.
        // Leyendo `[entry]` se tomaba el `true` viejo y la barra sticky se
        // ESCONDÍA justo cuando el botón se iba de pantalla: el comprador quedaba
        // sin ningún botón de agregar, ni el inline ni el sticky.
        const last = entries[entries.length - 1];
        if (last) setShowSticky(!last.isIntersecting);
      },
      { rootMargin: '0px 0px -64px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [product?.id]);

  // Si hay un solo color disponible, lo pre-seleccionamos (el usuario no tiene que tocarlo).
  useEffect(() => {
    if (colors.length === 1 && !selectedColor) setSelectedColor(colors[0]);
  }, [colors, selectedColor]);

  // Volume tiers: mantener `tierSelections` con exactamente `tierUnits` slots (uno
  // por unidad), preservando lo ya elegido al cambiar de escalón.
  useEffect(() => {
    setTierSelections((prev) => {
      const next = prev.slice(0, tierUnits);
      while (next.length < tierUnits) next.push({ size: null, color: null });
      return next;
    });
  }, [tierUnits]);

  // Al cambiar de producto (la ruta reusa el componente), volver al escalón base.
  useEffect(() => {
    setTierUnits(1);
    setTierSelections([]);
  }, [product?.id]);

  // Color pre-seleccionado vía ?color= (lo setean las "cards por color" del
  // catálogo). Sólo aplica si el color existe en el producto y el usuario todavía
  // no eligió uno; después puede cambiarlo libremente con el ColorSelector.
  const colorParam = searchParams.get('color');
  useEffect(() => {
    if (colorParam && !selectedColor && colors.includes(colorParam)) {
      setSelectedColor(colorParam);
    }
  }, [colorParam, colors, selectedColor]);

  // Meta Pixel: ViewContent al abrir el detalle (una vez por producto). Usamos
  // el precio prominente de lista; no-op si el tenant no tiene pixel.
  useEffect(() => {
    if (!product) return;
    const { mainPrice } = getPriceInfo(product);
    trackViewContent({ contentId: product.id, name: product.name, value: mainPrice });
    // Analytics propio (independiente del pixel; no-op hasta tenant resuelto).
    track('product_view', { product_id: product.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-6 py-10 md:grid-cols-[1.2fr_1fr] md:gap-16">
        <div className="aspect-[3/4] animate-pulse rounded-[12px] bg-secondary" />
        <div className="space-y-4">
          <div className="h-4 w-1/2 animate-pulse bg-secondary" />
          <div className="h-10 w-4/5 animate-pulse bg-secondary" />
          <div className="h-12 w-1/3 animate-pulse bg-secondary" />
          <div className="h-12 w-full animate-pulse bg-secondary" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-24 text-center">
        <Seo title={`Producto no encontrado · ${config.name}`} slug={config.slug} noindex />
        <h1 className="font-heading text-[32px] font-extrabold tracking-tight text-text">Producto no encontrado</h1>
        <p className="mt-4 text-muted">
          Volvé al{' '}
          <Link to="/productos" className="text-accent underline">
            catálogo
          </Link>
          .
        </p>
      </div>
    );
  }

  const { mainPrice, cashPrice } = getPriceInfo(product);
  // Promoción automática vigente: descuenta el precio que se muestra y el que va al carrito.
  const promo = promoForProduct(product);
  const finalPrice = priceFor(mainPrice, product).finalPrice; // precio prominente con promo aplicada
  const finalCash = cashPrice != null ? priceFor(cashPrice, product).finalPrice : null;
  // Promo por cantidad (descuento condicional: se activa al llegar al mínimo en el carrito).
  const qtyPromo = quantityPromoFor(product);
  const qtyPromoMsg = quantityMessageFor(product);
  const displayPrice = finalPrice; // precio prominente (tarjeta/transferencia, ya con promo)
  const needColor = colors.length > 0;
  const needSize = sizes.length > 0;
  // Producto totalmente agotado: ninguna variante con stock.
  const outOfStock = variants.length > 0 && variants.every((v) => (v.stock ?? 0) <= 0);
  const canAdd = Boolean(variant && (variant.stock ?? 0) > 0 && displayPrice > 0);
  const ctaLabel = outOfStock
    ? 'SIN STOCK'
    : !variant
      ? needColor && needSize
        ? 'ELEGÍ COLOR Y TALLE'
        : needColor
          ? 'ELEGÍ UN COLOR'
          : 'ELEGÍ UN TALLE'
      : (variant.stock ?? 0) <= 0
        ? 'SIN STOCK'
        : 'AGREGAR AL CARRITO';

  const handleAdd = () => {
    if (!variant || !canAdd) return;
    addItem({
      product_id: product.id,
      variant_id: variant.id,
      name: product.name,
      categories: cats,
      size: variant.size,
      color: variant.color,
      // Precio ya con la promo aplicada (finalPrice). El cliente paga lo que ve.
      unit_price: finalPrice,
      // Precio de contado (efectivo/transferencia) si hay descuento, para que el
      // checkout pueda ajustar el total según el método de pago elegido.
      ...(finalCash != null && finalCash < finalPrice ? { unit_price_cash: finalCash } : {}),
      // Datos de la promo aplicada (para el tachado en el carrito y el tracking).
      ...(promo
        ? {
            promo_id: promo.id,
            promo_name: promo.name,
            unit_price_original: mainPrice,
            promo_stackable: promo.stackable_with_coupons !== false,
          }
        : {}),
      qty: 1,
      image_url: variant.image_url ?? images[0] ?? null,
    });
    // Meta Pixel: AddToCart con el precio efectivamente agregado (ya con promo).
    trackAddToCart({ contentId: product.id, name: product.name, value: finalPrice });
  };

  const inquiry = buildWhatsappInquiry(config, product.name);
  const cats = Array.isArray(product.categories) ? product.categories.filter(Boolean) : [];

  // ── Volume tiers por categoría (category_volume_tiers, motor real) ──────────
  // Config de escalones de la categoría del producto (precedencia por sort_order,
  // ver categoryTiers.ts). null = el producto no tiene escalones -> no se muestran.
  const tierConfig = tiersForProduct(product);
  const variantPerUnit = tierConfig?.variantPerUnit ?? true;
  // Tarjetas a mostrar: baseline "Lleva 1" (precio normal) + los escalones de la DB.
  const tierCards = tierConfig
    ? [
        { units: 1, discountPct: 0, isFeatured: false },
        ...tierConfig.tiers.map((t) => ({ units: t.minQuantity, discountPct: t.discountPct, isFeatured: t.isFeatured })),
      ]
    : [];
  const hasTiers = tierCards.length > 1;
  const selectedTier =
    tierCards.find((t) => t.units === tierUnits) ?? tierCards[0] ?? { units: 1, discountPct: 0, isFeatured: false };

  // Precio por unidad de un escalón (tarjeta y efectivo por separado). El % sale
  // de la DB; las bases son finalPrice/finalCash (ya con promo automática).
  const tierPrices = (discountPct: number) => tierUnitPrices(finalPrice, finalCash, discountPct);
  // Escalones ya calculados para QuantityTierSelector (el componente no calcula).
  // Protagonista = contado si hay; la línea "tarjeta" sólo si es más caro.
  // El ahorro sale del MISMO precio que se muestra en el baseline "Lleva 1" (que
  // ya tiene la promo automática aplicada), no del precio de lista.
  const baselineUnitPrice = (() => {
    const p = tierPrices(0);
    return p.cash ?? p.card;
  })();
  const tierOptions: QuantityTierOption[] = tierCards.map((t) => {
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
      strikePrice:
        config.quantityTiersLayout === 'list' && t.discountPct > 0 ? baselineUnitPrice : null,
      savings: tierTotalSavings(baselineUnitPrice, unitPrice, t.units),
      isFeatured: t.isFeatured,
      isActive: tierUnits === t.units,
    };
  });
  // Resuelve la variante (fila product_variants) de un talle+color.
  const variantFor = (size: string | null, color: string | null): Variant | null =>
    variants.find((v) => (colors.length === 0 || v.color === color) && (sizes.length === 0 || v.size === size)) ?? null;
  // Talles sin stock para el color de esa unidad (deshabilitados en su SizeSelector).
  const sizeDisabledFor = (color: string | null) => (size: string) =>
    !variants.some((v) => v.size === size && (colors.length === 0 || !color || v.color === color) && (v.stock ?? 0) > 0);
  const updateTierUnit = (i: number, patch: Partial<{ size: string | null; color: string | null }>) =>
    setTierSelections((prev) => prev.map((u, idx) => (idx === i ? { ...u, ...patch } : u)));

  // Modo escalón activo: hay escalones y el comprador eligió N>1.
  const inTierMode = hasTiers && tierUnits > 1;
  // Filas por unidad: se muestran siempre que haya más de una unidad, que la
  // categoría pida variante por unidad y que haya ALGO que elegir. Sin ese último
  // guard, un producto de un solo color y un solo talle sacaría N filas idénticas
  // de una sola opción cada una.
  const perUnitOpen = inTierMode && variantPerUnit && (colors.length > 1 || sizes.length > 1);
  // Selecciones efectivas por unidad:
  //  - filas por unidad -> cada unidad su variante (tierSelections).
  //  - si no (categoría con variantPerUnit=false, o nada que elegir) -> las N
  //    comparten la variante del selector único. Es el mecanismo que ya existía
  //    para variantPerUnit=false, que sigue siendo un flag real de la categoría
  //    (`category_volume_tiers.variant_per_unit`), no código muerto.
  const effectiveTierSelections: UnitSelection[] = !inTierMode
    ? []
    : perUnitOpen
      ? tierSelections
      : Array.from({ length: tierUnits }, () => ({ size: selectedSize, color: selectedColor }));

  // Resumen de la variante para la barra sticky mobile. Cuando las N unidades
  // comparten variante se puede nombrar de verdad; con las filas por unidad puede
  // haber cualquier combinación.
  const tierVariantLabel = (() => {
    const sel = effectiveTierSelections;
    if (sel.length === 0) return null;
    const [first] = sel;
    if (!sel.every((s) => s.size === first.size && s.color === first.color)) return 'surtido';
    const parts = [first.color, first.size].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : null;
  })();

  // ¿Todas las N unidades tienen una variante válida y con stock suficiente?
  // (Respeta el stock agregado: si dos unidades eligen la misma variante, exige
  // stock >= 2 para esa variante.)
  const tierValid = (() => {
    if (!inTierMode || effectiveTierSelections.length !== tierUnits || !(finalPrice > 0)) return false;
    const counts = new Map<string, number>();
    for (const sel of effectiveTierSelections) {
      const v = variantFor(sel.size, sel.color);
      if (!v) return false;
      counts.set(v.id, (counts.get(v.id) ?? 0) + 1);
    }
    for (const [vid, n] of counts) {
      const v = variants.find((x) => x.id === vid);
      if (!v || (v.stock ?? 0) < n) return false;
    }
    return true;
  })();

  const handleAddTier = () => {
    if (!tierValid) return;
    const { card: unitPrice, cash: unitCash } = tierPrices(selectedTier.discountPct);
    const groupId = `tier-${product.id}-${selectedTier.units}-${Date.now()}`;
    const label = `Lleva ${selectedTier.units}${selectedTier.discountPct > 0 ? ` — ${selectedTier.discountPct}% OFF` : ''}`;
    for (const sel of effectiveTierSelections) {
      const v = variantFor(sel.size, sel.color);
      if (!v) continue;
      addItem({
        product_id: product.id,
        variant_id: v.id,
        name: product.name,
        categories: cats,
        size: v.size,
        color: v.color,
        // El descuento del escalón (de la DB) ya viene aplicado en unit_price (tarjeta).
        unit_price: unitPrice,
        // Precio de lista SIN el descuento del escalón, para el tachado del carrito.
        unit_price_original: finalPrice,
        // Precio de efectivo/transferencia ya con el descuento del escalón aplicado.
        ...(unitCash != null ? { unit_price_cash: unitCash } : {}),
        qty: 1,
        image_url: v.image_url ?? images[0] ?? null,
        source: 'tier',
        tierGroupId: groupId,
        tierLabel: label,
      });
    }
    trackAddToCart({ contentId: product.id, name: product.name, value: unitPrice * selectedTier.units });
    // Reset al flujo normal (Lleva 1).
    setTierUnits(1);
    setTierSelections([]);
  };

  // CTA unificado: en modo escalón (N>1) usa el flujo tier; si no, el suelto normal.
  const tierCtaLabel = tierValid ? `AGREGAR ${tierUnits} AL CARRITO` : 'ELEGÍ LAS VARIANTES';
  const primaryAdd = inTierMode ? handleAddTier : handleAdd;
  const primaryDisabled = inTierMode ? !tierValid : !canAdd;
  const primaryLabel = inTierMode ? tierCtaLabel : ctaLabel;
  // Mostrar los selectores únicos (un talle y un color) salvo cuando están
  // abiertas las filas por unidad.
  const showSingleSelectors = !perUnitOpen;

  return (
    <>
      <Seo
        title={`${product.name} · ${config.name}`}
        description={product.description?.trim() || config.metaDescription || `${product.name} — ${config.name}.`}
        image={images[0] || config.ogImageUrl}
        type="product"
        slug={config.slug}
        siteName={config.name}
      />

      {/* Breadcrumbs */}
      <div className="mx-auto max-w-[1200px] px-6 pb-2 pt-6">
        <nav aria-label="Breadcrumb" className="text-[13px] text-subtle">
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <li><Link to="/" className="transition-colors hover:text-accent">Inicio</Link></li>
            <li aria-hidden="true">›</li>
            <li><Link to="/productos" className="transition-colors hover:text-accent">Productos</Link></li>
            {cats[0] && (
              <>
                <li aria-hidden="true">›</li>
                <li>
                  <Link to={`/categoria/${encodeURIComponent(cats[0])}`} className="capitalize transition-colors hover:text-accent">
                    {cats[0]}
                  </Link>
                </li>
              </>
            )}
            <li aria-hidden="true">›</li>
            <li className="max-w-[60vw] truncate text-text">{product.name}</li>
          </ol>
        </nav>
      </div>

      {/* Detalle 2 columnas (flex para que la imagen quede sticky de forma fiable) */}
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 pb-8 md:flex-row md:items-start md:gap-16">
        <div
          className="md:sticky md:w-[54%] md:shrink-0 md:self-start"
          style={{ top: 'calc(var(--header-h, 64px) + 16px)' }}
        >
          <ProductGallery
            items={galleryItems}
            alt={product.name}
            activeIndex={activeImageIndex}
            onFirstImageReady={onGalleryReady}
          />
          <ProductDetailCustomSlot sections={pdSections} slot="below_gallery" />
        </div>

        <div className="space-y-6 md:min-w-0 md:flex-1">
          {detailBadges.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {detailBadges.map((b) => (
                <CardBadge key={b.key} bg={b.bg} color={b.color} variant={badgeStyle}>
                  {badgeShowIcons && b.icon}
                  {b.label}
                </CardBadge>
              ))}
            </div>
          )}
          <h1 className="font-heading text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-text md:text-[32px]">
            {product.name}
          </h1>

          {/* Countdown de la promoción (si la promo lo activa). */}
          {promo?.show_countdown && (
            <div>
              <PromoCountdown endsAt={promo.ends_at} color={promo.badge_color} />
            </div>
          )}

          {isWholesale && (
            <WholesalePurchasePanel product={product} images={images} promo={promo} onColorChange={setSelectedColor} />
          )}

          {!isWholesale && (
          <>
          <PriceStack product={product} variant="detail" />

          {/* Chip informativo del cupón guardado: cuánto pagarías por este producto
              con el cupón + copiar el código. No aplica nada (eso pasa en el checkout). */}
          <CouponPdpChip product={product} hasNonStackablePromo={promo?.stackable_with_coupons === false} className="mt-3" />

          {/* Promo por cantidad: banner informativo. El precio NO se tacha (el
              descuento se aplica recién al llegar al mínimo en el carrito). */}
          {qtyPromo && qtyPromoMsg && (
            <div
              className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5"
              style={{
                borderColor: (qtyPromo.badge_color || '#16a34a') + '40',
                backgroundColor: (qtyPromo.badge_color || '#16a34a') + '12',
              }}
            >
              <Tag className="h-4 w-4 shrink-0" style={{ color: qtyPromo.badge_color || '#16a34a' }} />
              <p className="text-[13px] font-semibold" style={{ color: qtyPromo.badge_color || '#16a34a' }}>
                {qtyPromoMsg}
              </p>
            </div>
          )}
          {qtyPromo?.show_countdown && (
            <PromoCountdown endsAt={qtyPromo.ends_at} color={qtyPromo.badge_color} />
          )}

          {/* Volume tiers por categoría: tarjetas de escalón seleccionables (DB).
              El cálculo de precios queda acá (tierPrices); QuantityTierSelector
              es sólo presentación. */}
          {hasTiers && (
            <QuantityTierSelector
              title="Elegí cuántas llevás"
              options={tierOptions}
              formatPrice={formatPrice}
              onSelect={setTierUnits}
              layout={config.quantityTiersLayout}
              showSavings={config.quantityTiersShowSavings}
              showCardPrice={config.quantityTiersShowCardPrice}
            />
          )}

          {/* ZONA DE VARIANTES — check, filas por unidad, color, talle y el
              acordeón del recomendador. Va en su propio contenedor con `space-y-3`
              (12px) en vez del `space-y-6` (24px) de la columna: son partes de una
              misma decisión y con los chips más bajos ese aire de 24px entre color
              y talle los desarmaba en bloques sueltos. Contra sus vecinos —precio
              arriba, promesa de envío abajo— sigue habiendo 24px. */}
          <div className="space-y-3">
          {/* Filas por unidad: "Unidad N" + sus chips, color → talle, igual que el
              flujo suelto de abajo. */}
          {perUnitOpen && (
            <UnitVariantRows
              selections={tierSelections}
              sizes={sizes}
              colors={colors}
              sizeDisabledFor={sizeDisabledFor}
              colorDisabled={colorDisabled}
              onChange={updateTierUnit}
            />
          )}

          {/* COLOR antes que TALLE, un solo orden en toda la ficha (también en las
              filas por unidad). El color es el eje que manda: los talles con stock
              se calculan contra el color elegido y elegir color resetea el talle;
              al revés el comprador elegía un talle que después se le borraba. */}
          {showSingleSelectors && needColor && (
            <ColorSelector
              colors={colors}
              selected={selectedColor}
              isDisabled={colorDisabled}
              onSelect={(c) => {
                setSelectedColor(c);
                setSelectedSize(null);
              }}
            />
          )}

          {showSingleSelectors && needSize && <SizeSelector sizes={sizes} selected={selectedSize} isDisabled={sizeDisabled} onSelect={setSelectedSize} />}

          {/* Recomendador de talle — plan TIENDA+, sólo si section_probador. Panel
              inline desplegable.

              Va SIEMPRE acá, pegado abajo de la zona de talle y una sola vez, tanto
              en el flujo suelto como con las filas por unidad (antes desaparecía al
              abrir las cajas UNIDAD). Nunca por unidad: la pregunta que contesta es
              "cuál es MI talle", que tiene una sola respuesta. Por eso, con las
              filas, aplicar la recomendación la escribe en todas las unidades —
              quedan a la vista justo arriba y se pueden cambiar de a una. */}
          {needSize && config.isPaid && config.sections.probador && (
            <div className="overflow-hidden rounded-md border border-line">
              <button
                type="button"
                onClick={() => setShowSizeFinder((v) => !v)}
                aria-expanded={showSizeFinder}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary"
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-text">
                  <Ruler size={16} /> ¿No sabés tu talle?
                </span>
                <span className="flex items-center gap-1 text-[12px] font-semibold text-accent">
                  Recomendador de talle
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${showSizeFinder ? 'rotate-180' : ''}`}
                  />
                </span>
              </button>
              {showSizeFinder && (
                <div className="animate-fade-in border-t border-line bg-secondary px-4 py-4">
                  <SizeFinder
                    sizes={sizes}
                    onSelect={(s) => {
                      setSelectedSize(s);
                      if (perUnitOpen) setTierSelections((prev) => prev.map((u) => ({ ...u, size: s })));
                    }}
                  />
                </div>
              )}
            </div>
          )}
          </div>

          {/* Promesa de envío */}
          {config.shippingPromiseEnabled && (
            <p
              className="flex items-center gap-2 text-[14px]"
              style={{ color: config.shippingPromiseColor }}
            >
              <Truck size={17} className="flex-none" />
              <span className="font-semibold">{config.shippingPromiseTitle}</span>
              {config.shippingPromiseSubtitle && (
                <span className="opacity-70">· {config.shippingPromiseSubtitle}</span>
              )}
            </p>
          )}

          {config.sections.socialProof && (
            <p className="flex animate-fade-in items-center gap-2 text-[14px] text-subtle">
              <Eye size={15} /> {viewersFromId(product.id)} personas están viendo este producto
            </p>
          )}

          <div className="space-y-3 pt-1">
            <button
              ref={addBtnRef}
              type="button"
              onClick={primaryAdd}
              disabled={primaryDisabled}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-primary px-6 py-[18px] text-[16px] font-bold text-on-primary transition-all duration-200 hover:bg-accent hover:text-on-accent hover:scale-[1.01] active:scale-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:bg-primary disabled:hover:text-on-primary"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              {primaryLabel}
            </button>

            {inquiry && (
              <a
                href={inquiry}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] border-[1.5px] border-[#25D366] px-6 py-[14px] text-[14px] font-semibold text-[#25D366] transition-colors hover:bg-[#25D366] hover:text-white"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M19.4 4.6A10 10 0 0 0 4.1 17.3L3 21l3.8-1.1A10 10 0 1 0 19.4 4.6Zm-7.4 15.3a8 8 0 0 1-4.1-1.1l-.3-.2-2.3.7.7-2.3-.2-.3a8 8 0 1 1 6.2 3.2Zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.3.2-.3.6-1 .1-.1 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4 0-.6.3l-.6.7a3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.7 2.6 4.2 3.6 1.5.6 2.1.7 2.9.5.5-.1 1.4-.6 1.6-1.2.2-.5.2-1 .2-1.1-.1-.1-.2-.1-.4-.2Z" />
                </svg>
                Consultar por WhatsApp
              </a>
            )}

            {/* Probador virtual con IA (FASHN) — plan PRO, sólo si section_virtual_tryon. */}
            {config.isPro && config.sections.virtualTryon && images[0] && (
              <VirtualTryOn
                garmentImageUrl={images[0]}
                garmentName={product.name}
                garmentCategory={mapFashnCategory(cats)}
              />
            )}
          </div>
          </>
          )}

          {/* "Sumá otros colores" (mayorista): va ANTES de los complementarios.
              Solo si el toggle está activo; se autooculta si no aplica. */}
          {isWholesale && config.complementaryBlock.mostrarOtrosColores && (
            <OtherColorsBlock product={product} selectedColor={selectedColor} />
          )}

          {/* Complementarios (cross-selling): debajo del botón de agregar, en la
              columna derecha. Se autooculta si no hay nada que sugerir. */}
          <ComplementaryBlock contexto="ficha" product={product} preferredSize={selectedSize} />

          {/* "Es parte de un look": el outfit que contiene el producto (card destacada
              o en lista según config). Solo MINORISTA: los outfits no tienen precio
              mayorista cargado (catalog_outfits solo tiene combo_price retail), así que
              en mayorista no hay precio válido que mostrar → se oculta. */}
          {!isWholesale && config.complementaryBlock.mostrarOutfit && <OutfitForProductBlock product={product} />}

          {/* Acordeones de políticas (mayorista): van DEBAJO de los bloques de
              complementarios/outfit, antes de "Calculá tu envío". */}
          {isWholesale && <PolicyAccordions />}

          <ShippingCalculator />

          {config.sections.trustBadges && <TrustBadges />}

          {/* "Así funciona tu compra" según el layout: sin layout queda acá, como
              siempre. Con layout, acá sólo si el token está en la columna derecha
              — si está en below_product lo pinta BelowProductBlocks, y si no está
              en ninguna zona es porque el comercio lo ocultó.

              El chequeo de right_column no es decorativo: la Fase 0 ignora esa
              zona entera, así que un 'purchase_flow' guardado ahí no se
              renderizaba en NINGÚN lado y el bloque desaparecía de la tienda sin
              aviso. Es el mismo bug que el de 'reels', pero la red de
              FULL_WIDTH_IDS no lo agarra: purchase_flow no es de ancho completo,
              vivir en la columna es legítimo. */}
          {(!config.productLayout || config.productLayout.right_column.includes('purchase_flow')) && <PurchaseFlow />}

          <ProductDetailCustomSlot sections={pdSections} slot="above_description" />

          {product.description && (
            <div className="border-t border-line pt-6">
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Descripción</p>
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-muted">{product.description}</p>
            </div>
          )}

          <ProductDetailCustomSlot sections={pdSections} slot="below_description" />
        </div>
      </div>

      {/* Zona "debajo del producto". Con layout configurado se respeta el orden
          guardado (bloques + custom sections de este slot); sin layout, render
          legacy fijo (idéntico a antes). Los slots above/below_description y
          below_gallery siguen por el mecanismo legacy en ambos casos (híbrido). */}
      {config.productLayout ? (
        <BelowProductBlocks
          layout={config.productLayout}
          product={product}
          config={config}
          sections={pdSections}
        />
      ) : (
        <>
          {/* Videos del producto. Va primero de la zona de abajo, apenas termina
              el bloque de compra: es lo que más ayuda a decidir. Se autooculta
              si el producto no tiene videos. */}
          <ProductReels productId={product.id} />

          <ProductDetailCustomSlot sections={pdSections} slot="below_product" />

          {/* Reseñas (Extra PRO): las mismas reseñas del home (social proof). El componente se autooculta si no hay reseñas. */}
          {config.isPro && config.sections.productReviews && (
            <div className="px-6 pb-4 md:px-10 lg:px-16">
              <ProductReviews />
            </div>
          )}

          {/* Recomendaciones del admin (sección "upsell", PRO). Usa las recos
              manuales por color; si no hay, cae a relacionados por categoría. */}
          {config.isPro && config.sections.upsell && <RelatedProducts product={product} />}
        </>
      )}

      {/* Sticky bar mobile (solo retail; el panel mayorista tiene su propio CTA inline) */}
      {!isWholesale && showSticky && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex items-center gap-3 border-t border-line bg-background px-4 py-3 md:hidden"
          style={{ boxShadow: '0 -2px 10px rgba(0,0,0,0.08)' }}
        >
          <div className="min-w-0 flex-1">
            {/* Contado protagonista + tarjeta chica al lado (si hay descuento de contado). */}
            <p className="flex flex-wrap items-baseline gap-x-1.5 leading-none">
              <span className="text-[18px] font-extrabold text-accent">
                {formatPrice(finalCash != null && finalCash < displayPrice ? finalCash : displayPrice)}
              </span>
              {finalCash != null && finalCash < displayPrice && (
                <span className="text-[11px] font-medium text-subtle">{formatPrice(displayPrice)} tarjeta</span>
              )}
            </p>
            {inTierMode ? (
              // Cuando las N unidades comparten variante la barra puede nombrarla
              // de verdad en vez de quedarse en "Lleva N". Con las filas por unidad
              // y variantes distintas no hay una variante que nombrar: "surtido".
              <p className="mt-0.5 truncate text-[11px] text-subtle">
                Lleva {tierUnits}
                {tierVariantLabel ? ` · ${tierVariantLabel}` : ''}
              </p>
            ) : (
              (selectedColor || selectedSize) && (
                <p className="mt-0.5 truncate text-[11px] text-subtle">{[selectedColor, selectedSize].filter(Boolean).join(' · ')}</p>
              )
            )}
          </div>
          <button
            type="button"
            onClick={primaryAdd}
            disabled={primaryDisabled}
            className="inline-flex flex-shrink-0 items-center justify-center rounded-md bg-primary px-5 py-3 text-[13px] font-bold text-on-primary disabled:opacity-40"
          >
            {inTierMode ? (tierValid ? `Agregar ${tierUnits}` : 'Elegí variantes') : outOfStock ? 'Sin stock' : !variant ? 'Elegí opción' : (variant.stock ?? 0) <= 0 ? 'Sin stock' : 'Agregar'}
          </button>
        </div>
      )}
    </>
  );
}
