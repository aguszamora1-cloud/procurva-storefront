import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { useStore, useStoreStatus } from '@/context/StoreProvider';
import { usePromotions } from '@/context/PromotionsContext';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { ProductGrid, ProductGridSkeleton } from '@/components/ProductGrid';
import { PromoCountdown } from '@/components/PromoCountdown';
import { InlineError } from '@/components/ErrorScreen';
import { Seo } from '@/components/Seo';
import { useTypography } from '@/hooks/useTypography';
import { findPromoBySlug, productInPromo, promoHeadline, promoVisibleIn } from '@/lib/promoPage';

/**
 * Página propia de una promoción: encabezado con la promo + grilla de los
 * productos que alcanza. Sirve como destino de banners, del menú y de links
 * compartidos por WhatsApp/Instagram.
 *
 * La promo sale de las VIGENTES que ya cargó PromotionsProvider (no hay query
 * propia). Si venció, la desactivaron o no aplica al canal de esta tienda, la
 * página lo dice y manda al catálogo: un banner olvidado nunca cae en una
 * grilla que promete un descuento que ya no se cobra.
 */
export function PromoPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const config = useStore();
  const { storeType } = useStoreStatus();
  const effStoreType = storeType ?? 'retail';
  const { promotions, ready } = usePromotions();
  const { products, isLoading, error, reload } = useProducts();
  const { ty } = useTypography();

  useFirstPaintGate('promo-page', isLoading || !ready);

  const promo = useMemo(() => {
    const p = findPromoBySlug(promotions, slug);
    return p && promoVisibleIn(p, effStoreType) ? p : null;
  }, [promotions, slug, effStoreType]);

  const filtered = useMemo(
    () => (promo ? products.filter((p) => productInPromo(promo, p, effStoreType)) : []),
    [products, promo, effStoreType],
  );

  if (ready && !promo) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center md:py-24">
        <Seo title={`Promoción finalizada · ${config.name}`} slug={config.slug} siteName={config.name} noindex />
        <h1 className={ty('font-heading text-[calc(28px_*_var(--font-scale,1))] font-semibold uppercase tracking-[1px] text-text', 'page-title', 'text-text')}>
          Esta promoción ya no está vigente
        </h1>
        <p className="mt-3 text-[calc(15px_*_var(--font-scale,1))] text-muted">
          Terminó o todavía no empezó. Mirá el resto de la tienda, seguro encontrás algo.
        </p>
        <Link
          to="/productos"
          className="mt-8 inline-block rounded-button bg-primary px-6 py-3 text-[calc(14px_*_var(--font-scale,1))] font-medium text-on-primary transition-colors hover:bg-accent hover:text-on-accent"
        >
          Ver productos
        </Link>
      </div>
    );
  }

  const headline = promo ? promoHeadline(promo, effStoreType) : '';
  const description = (promo?.description ?? '').trim();

  return (
    <div className="mx-auto max-w-none px-6 py-10 md:py-14">
      {promo && (
        <Seo
          title={`${promo.name} · ${config.name}`}
          description={description || `${headline} — ${config.name}.`}
          image={promo.banner_image_url || config.ogImageUrl}
          slug={config.slug}
          siteName={config.name}
        />
      )}

      {promo?.banner_image_url && (
        <img
          src={promo.banner_image_url}
          alt={promo.name}
          className="mb-8 h-auto w-full rounded-lg object-cover"
          loading="eager"
        />
      )}

      <header className="mb-8">
        <span className={ty('text-[calc(11px_*_var(--font-scale,1))] font-semibold uppercase tracking-[2px] text-subtle', 'eyebrow', 'text-subtle')}>
          Promoción
        </span>
        <h1 className={ty('mt-2 font-heading text-[calc(32px_*_var(--font-scale,1))] font-semibold uppercase tracking-[1px] text-text md:text-[calc(44px_*_var(--font-scale,1))]', 'page-title', 'mt-2 text-text')}>
          {promo?.name}
        </h1>
        {headline && (
          <p className="mt-2 text-[calc(17px_*_var(--font-scale,1))] font-semibold text-accent">{headline}</p>
        )}
        {description && (
          <p className="mt-2 max-w-2xl whitespace-pre-line text-[calc(15px_*_var(--font-scale,1))] leading-relaxed text-muted">
            {description}
          </p>
        )}
        {promo?.show_countdown && promo.ends_at && (
          <PromoCountdown endsAt={promo.ends_at} color={promo.badge_color} className="mt-4" />
        )}
      </header>

      {isLoading || !ready ? (
        <ProductGridSkeleton />
      ) : error ? (
        <InlineError message="No pudimos cargar los productos." onRetry={reload} />
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-[calc(14px_*_var(--font-scale,1))] text-subtle">
          Por ahora no hay productos disponibles en esta promoción.
        </p>
      ) : (
        <ProductGrid products={filtered} />
      )}
    </div>
  );
}
