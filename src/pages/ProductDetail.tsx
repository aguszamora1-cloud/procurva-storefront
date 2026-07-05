import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, Eye, Ruler, Tag, Truck } from 'lucide-react';
import { useProduct } from '@/hooks/useProduct';
import { useMetaPixel } from '@/hooks/useMetaPixel';
import { useStore, useStoreType } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { usePromotions } from '@/context/PromotionsContext';
import { Seo } from '@/components/Seo';
import { ProductGallery } from '@/components/ProductGallery';
import { ColorSelector } from '@/components/ColorSelector';
import { SizeSelector } from '@/components/SizeSelector';
import { SizeFinder } from '@/components/SizeFinder';
import { TrustBadges } from '@/components/TrustBadges';
import { ShippingCalculator } from '@/components/ShippingCalculator';
import { PriceDisplay } from '@/components/PriceDisplay';
import { WholesalePurchasePanel } from '@/components/WholesalePurchasePanel';
import { PromoCountdown } from '@/components/PromoCountdown';
import { CardBadge } from '@/components/CardBadge';
import { ProductDetailCustomSlot, CustomSectionNode } from '@/components/ProductDetailCustomSlot';
import { RelatedProducts } from '@/components/RelatedProducts';
import { ProductReviews } from '@/components/ProductReviews';
import { PurchaseFlow } from '@/components/PurchaseFlow';
import { VirtualTryOn, mapFashnCategory } from '@/components/VirtualTryOn';
import { useProductDetailCustomSections } from '@/hooks/useProductDetailCustomSections';
import { useProductBadges } from '@/hooks/useProductBadges';
import { formatPrice, getPriceInfo, productImages, sortSizes } from '@/lib/utils';
import { buildWhatsappInquiry } from '@/lib/checkout';
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
      // 'upsells' queda reservado para la lectura de product_recommendations (fase
      // siguiente): hoy no renderiza nada. Cualquier otro token se ignora.
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
  const { sections: pdSections } = useProductDetailCustomSections();
  // Badges de la ficha: misma fuente de verdad que la grilla (config.badges +
  // candidatos/prioridad). En el detalle se renderizan inline (sin esquina).
  const { badges: detailBadges, style: badgeStyle, showIcons: badgeShowIcons } = useProductBadges(product);

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [showSticky, setShowSticky] = useState(false);
  const [showSizeFinder, setShowSizeFinder] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

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

  const images = product ? productImages(product) : [];
  const activeImageIndex = useMemo(() => {
    if (!selectedColor) return undefined;
    const variantImg = variants.find((v) => v.color === selectedColor && v.image_url)?.image_url;
    if (!variantImg) return undefined;
    const i = images.indexOf(variantImg);
    return i >= 0 ? i : undefined;
  }, [selectedColor, variants, images]);

  useEffect(() => {
    const el = addBtnRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setShowSticky(!entry.isIntersecting), {
      rootMargin: '0px 0px -64px 0px',
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [product?.id]);

  // Si hay un solo color disponible, lo pre-seleccionamos (el usuario no tiene que tocarlo).
  useEffect(() => {
    if (colors.length === 1 && !selectedColor) setSelectedColor(colors[0]);
  }, [colors, selectedColor]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-6 py-10 md:grid-cols-[1.2fr_1fr] md:gap-12">
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
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 pb-8 md:flex-row md:items-start md:gap-12">
        <div
          className="md:sticky md:w-[54%] md:shrink-0 md:self-start"
          style={{ top: 'calc(var(--header-h, 64px) + 16px)' }}
        >
          <ProductGallery images={images} alt={product.name} activeIndex={activeImageIndex} />
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
          <PriceDisplay product={product} variant="detail" />

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

          {needSize && <SizeSelector sizes={sizes} selected={selectedSize} isDisabled={sizeDisabled} onSelect={setSelectedSize} />}

          {/* Recomendador de talle — plan TIENDA+, sólo si section_probador. Panel inline desplegable. */}
          {config.isPaid && config.sections.probador && (
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
                  <SizeFinder sizes={sizes} onSelect={setSelectedSize} />
                </div>
              )}
            </div>
          )}

          {needColor && (
            <ColorSelector
              colors={colors}
              selected={selectedColor}
              onSelect={(c) => {
                setSelectedColor(c);
                setSelectedSize(null);
              }}
            />
          )}

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
              onClick={handleAdd}
              disabled={!canAdd}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-primary px-6 py-[18px] text-[16px] font-bold text-on-primary transition-all duration-200 hover:bg-accent hover:text-on-accent hover:scale-[1.01] active:scale-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:bg-primary disabled:hover:text-on-primary"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              {ctaLabel}
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

          <ShippingCalculator />

          {config.sections.trustBadges && <TrustBadges />}

          {/* Con layout configurado, "Así funciona tu compra" se renderiza en la
              zona ordenable de abajo (below_product); sin layout, queda acá como siempre. */}
          {!config.productLayout && <PurchaseFlow />}

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
          <ProductDetailCustomSlot sections={pdSections} slot="below_product" />

          {/* Reseñas (Extra PRO): las mismas reseñas del home (social proof). El componente se autooculta si no hay reseñas. */}
          {config.isPro && config.sections.productReviews && (
            <div className="px-6 pb-4 md:px-10 lg:px-16">
              <ProductReviews />
            </div>
          )}

          {/* Productos relacionados (sección "upsell" del admin, PRO) */}
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
            <p className="text-[18px] font-extrabold leading-none text-accent">{formatPrice(displayPrice)}</p>
            {(selectedColor || selectedSize) && (
              <p className="mt-0.5 truncate text-[11px] text-subtle">{[selectedColor, selectedSize].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="inline-flex flex-shrink-0 items-center justify-center rounded-md bg-primary px-5 py-3 text-[13px] font-bold text-on-primary disabled:opacity-40"
          >
            {outOfStock ? 'Sin stock' : !variant ? 'Elegí opción' : (variant.stock ?? 0) <= 0 ? 'Sin stock' : 'Agregar'}
          </button>
        </div>
      )}
    </>
  );
}
