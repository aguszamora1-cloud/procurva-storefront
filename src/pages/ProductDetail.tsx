import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Eye, Ruler, Truck } from 'lucide-react';
import { useProduct } from '@/hooks/useProduct';
import { useStore } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { ProductGallery } from '@/components/ProductGallery';
import { ColorSelector } from '@/components/ColorSelector';
import { SizeSelector } from '@/components/SizeSelector';
import { TrustBadges } from '@/components/TrustBadges';
import { PriceDisplay } from '@/components/PriceDisplay';
import { formatPrice, getPriceInfo, productImages, sortSizes } from '@/lib/utils';
import { buildWhatsappInquiry } from '@/lib/checkout';
import type { Variant } from '@/lib/types';

// "X personas viendo" determinístico (sin Math.random, para estabilidad).
function viewersFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 6 + (h % 18);
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { product, isLoading, error } = useProduct(id);
  const config = useStore();
  const { addItem } = useCart();

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [showSticky, setShowSticky] = useState(false);
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
        <h1 className="font-heading text-[32px] font-extrabold uppercase tracking-tight text-text">Producto no encontrado</h1>
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

  const { cardPrice } = getPriceInfo(product);
  const needColor = colors.length > 0;
  const needSize = sizes.length > 0;
  const canAdd = Boolean(variant && (variant.stock ?? 0) > 0 && cardPrice > 0);
  const ctaLabel = !variant
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
      size: variant.size,
      color: variant.color,
      unit_price: cardPrice,
      qty: 1,
      image_url: variant.image_url ?? images[0] ?? null,
    });
  };

  const inquiry = buildWhatsappInquiry(config, product.name);
  const cats = Array.isArray(product.categories) ? product.categories.filter(Boolean) : [];
  const stock = variant?.stock ?? null;

  return (
    <>
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

      {/* Detalle 2 columnas */}
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-start gap-8 px-6 pb-8 md:grid-cols-[1.2fr_1fr] md:gap-12">
        <div className="md:sticky md:top-24">
          <ProductGallery images={images} alt={product.name} activeIndex={activeImageIndex} />
        </div>

        <div className="space-y-6">
          {cats[0] && <p className="text-[11px] font-semibold uppercase tracking-[2px] text-accent">{cats[0]}</p>}
          <h1 className="font-heading text-[26px] font-bold uppercase leading-[1.15] tracking-[-0.3px] text-text md:text-[32px]">
            {product.name}
          </h1>

          <PriceDisplay product={product} variant="detail" />

          {needSize && <SizeSelector sizes={sizes} selected={selectedSize} isDisabled={sizeDisabled} onSelect={setSelectedSize} />}

          {/* Probador virtual — plan PRO, sólo si section_probador */}
          {config.isPro && config.sections.probador && (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg border border-line px-4 py-3 text-left transition-colors hover:border-text"
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-text">
                <Ruler size={16} /> ¿No sabés tu talle?
              </span>
              <span className="text-[12px] font-semibold text-accent">Probador virtual ›</span>
            </button>
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
            <p className="flex items-center gap-2 text-[14px] text-text">
              <Truck size={17} className="text-accent" />
              <span className="font-semibold">{config.shippingPromiseTitle}</span>
              {config.shippingPromiseSubtitle && <span className="text-muted">· {config.shippingPromiseSubtitle}</span>}
            </p>
          )}

          {config.sections.socialProof && (
            <p className="flex animate-fade-in items-center gap-2 text-[14px] text-subtle">
              <Eye size={15} /> {viewersFromId(product.id)} personas están viendo este producto
            </p>
          )}

          {stock !== null && stock > 0 && stock <= 5 && (
            <p className="animate-fade-in text-[14px] font-semibold text-accent">¡Últimas {stock} unidades!</p>
          )}

          <div className="space-y-3 pt-1">
            <button
              ref={addBtnRef}
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary py-[18px] text-[16px] font-bold uppercase tracking-[0.5px] text-on-primary transition-all duration-200 hover:bg-accent hover:text-on-accent hover:scale-[1.01] active:scale-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:bg-primary disabled:hover:text-on-primary"
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] border-2 border-[#25D366] py-[14px] text-[14px] font-bold uppercase tracking-[0.5px] text-[#25D366] transition-colors hover:bg-[#25D366] hover:text-white"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M19.4 4.6A10 10 0 0 0 4.1 17.3L3 21l3.8-1.1A10 10 0 1 0 19.4 4.6Zm-7.4 15.3a8 8 0 0 1-4.1-1.1l-.3-.2-2.3.7.7-2.3-.2-.3a8 8 0 1 1 6.2 3.2Zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.3.2-.3.6-1 .1-.1 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4 0-.6.3l-.6.7a3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.7 2.6 4.2 3.6 1.5.6 2.1.7 2.9.5.5-.1 1.4-.6 1.6-1.2.2-.5.2-1 .2-1.1-.1-.1-.2-.1-.4-.2Z" />
                </svg>
                Consultar por WhatsApp
              </a>
            )}
          </div>

          <TrustBadges />

          {product.description && (
            <div className="border-t border-line pt-6">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[1.5px] text-subtle">Descripción</p>
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-muted">{product.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky bar mobile */}
      {showSticky && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex items-center gap-3 border-t border-line bg-background px-4 py-3 md:hidden"
          style={{ boxShadow: '0 -2px 10px rgba(0,0,0,0.08)' }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-extrabold leading-none text-accent">{formatPrice(cardPrice)}</p>
            {(selectedColor || selectedSize) && (
              <p className="mt-0.5 truncate text-[11px] text-subtle">{[selectedColor, selectedSize].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="inline-flex flex-shrink-0 items-center justify-center rounded-lg bg-primary px-5 py-3 text-[13px] font-bold uppercase tracking-[0.5px] text-on-primary disabled:opacity-40"
          >
            {!variant ? 'Elegí opción' : (variant.stock ?? 0) <= 0 ? 'Sin stock' : 'Agregar'}
          </button>
        </div>
      )}
    </>
  );
}
