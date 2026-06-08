import { Link, useParams } from 'react-router-dom';
import { useProduct } from '@/hooks/useProduct';
import { useStore, useStoreType } from '@/context/StoreProvider';
import { Seo } from '@/components/Seo';
import { ProductGallery } from '@/components/ProductGallery';
import { TrustBadges } from '@/components/TrustBadges';
import { ShippingCalculator } from '@/components/ShippingCalculator';
import { PriceDisplay } from '@/components/PriceDisplay';
import { WholesalePurchasePanel } from '@/components/WholesalePurchasePanel';
import { CardBadge } from '@/components/CardBadge';
import { ProductDetailCustomSlot } from '@/components/ProductDetailCustomSlot';
import { useProductDetailCustomSections } from '@/hooks/useProductDetailCustomSections';
import { badgeColor, productImages } from '@/lib/utils';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { product, isLoading, error } = useProduct(id);
  const config = useStore();
  const isWholesale = useStoreType() === 'wholesale';
  const { sections: pdSections } = useProductDetailCustomSections();

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-6 py-10 md:grid-cols-[1.2fr_1fr] md:gap-12">
        <div className="aspect-[3/4] animate-pulse bg-secondary" />
        <div className="space-y-4">
          <div className="h-10 w-4/5 animate-pulse bg-secondary" />
          <div className="h-12 w-1/3 animate-pulse bg-secondary" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-24 text-center">
        <Seo title={`Producto no encontrado · ${config.name}`} slug={config.slug} noindex />
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

  const images = productImages(product);
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
          <ProductGallery images={images} alt={product.name} />
          <ProductDetailCustomSlot sections={pdSections} slot="below_gallery" />
        </div>

        <div className="space-y-6 md:min-w-0 md:flex-1">
          {isWholesale && cats[0] && <p className="text-[11px] font-semibold uppercase tracking-[2px] text-accent">{cats[0]}</p>}
          {isWholesale && product.catalog_badge_visible && product.catalog_badge_text && (
            <CardBadge glow bg={badgeColor(product.catalog_badge_color)}>{product.catalog_badge_text}</CardBadge>
          )}
          <h1 className="font-heading text-[26px] font-bold uppercase leading-[1.15] tracking-[-0.02em] text-text md:text-[32px]">
            {product.name}
          </h1>

          {isWholesale ? (
            <>
              <WholesalePurchasePanel product={product} images={images} />
              <ShippingCalculator />
              <ProductDetailCustomSlot sections={pdSections} slot="above_description" />
              {config.sections.trustBadges && <TrustBadges />}
              {product.description && (
                <div className="border-t border-line pt-6">
                  <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Descripción</p>
                  <p className="whitespace-pre-line text-[14px] leading-relaxed text-muted">{product.description}</p>
                </div>
              )}
              <ProductDetailCustomSlot sections={pdSections} slot="below_description" />
            </>
          ) : (
            <>
              {/* Vista minorista simplificada: sólo precio (foto + nombre arriba). Las
                  secciones custom del detalle siguen disponibles para sumar contenido. */}
              <PriceDisplay product={product} variant="detail" />
              <ProductDetailCustomSlot sections={pdSections} slot="above_description" />
              <ProductDetailCustomSlot sections={pdSections} slot="below_description" />
            </>
          )}
        </div>
      </div>

      <ProductDetailCustomSlot sections={pdSections} slot="below_product" />
    </>
  );
}
