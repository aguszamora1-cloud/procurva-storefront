import { Fragment, useMemo, type ReactNode } from 'react';
import { useStore } from '@/context/StoreProvider';
import { useProducts } from '@/hooks/useProducts';
import { useFeaturedSections } from '@/hooks/useFeaturedSections';
import { useTopSelling } from '@/hooks/useTopSelling';
import { usePromotions } from '@/context/PromotionsContext';
import type { Product } from '@/lib/types';
import { Seo } from '@/components/Seo';
import { Hero } from '@/components/Hero';
import { TrustBadges } from '@/components/TrustBadges';
import { CategoriesSection } from '@/components/home/CategoriesSection';
import { ProductsSection } from '@/components/home/ProductsSection';
import { NewsletterSection } from '@/components/home/NewsletterSection';
import { StoriesSection } from '@/components/home/StoriesSection';
import { SocialProofSection } from '@/components/home/SocialProofSection';
import { OutfitsSection } from '@/components/home/OutfitsSection';
import { CustomBannerSection } from '@/components/home/CustomBannerSection';
import { CustomTextSection } from '@/components/home/CustomTextSection';
import { PromoBannerAuto } from '@/components/PromoBannerAuto';
import { useCustomSections } from '@/hooks/useCustomSections';
import { ProductGridSkeleton } from '@/components/ProductGrid';
import { Reveal } from '@/components/Reveal';

// Orden por defecto de las secciones del home (coincide con la tab "Secciones"
// del admin). Las keys sin sección en el home (upsell, probador) se ignoran:
// upsell = recomendaciones en el detalle de producto; probador = en el detalle.
const DEFAULT_SECTION_ORDER = [
  'hero',
  'trust_badges',
  'categories',
  'featured',
  'new_arrivals',
  'offers',
  'outfits',
  'upsell',
  'probador',
  'stories',
  'social_proof',
  'newsletter',
];

const SECTION_LIMIT = 12;

// Modelo auto + pins: primero los productos FIJADOS (en el orden del admin, sólo
// los que existen en el catálogo cargado), después el resto por la regla
// automática de la sección, sin duplicar, hasta el límite.
function buildSection(products: Product[], pinIds: string[], autoOrdered: Product[]): Product[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const pinned = pinIds.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  const pinnedSet = new Set(pinned.map((p) => p.id));
  const rest = autoOrdered.filter((p) => !pinnedSet.has(p.id));
  return [...pinned, ...rest].slice(0, SECTION_LIMIT);
}

export function Home() {
  const config = useStore();
  const { products, isLoading } = useProducts();
  const { sections: customSections } = useCustomSections();
  // Pins (productos fijados) por canal, desde storefront_featured_products.
  const fs = useFeaturedSections();
  // Ranking de ventas para la regla automática de Destacados.
  const top = useTopSelling();
  const { promoForProduct, priceFor } = usePromotions();

  // Destacados: pins arriba + resto por MÁS VENDIDOS (rank de unidades; los sin
  // ventas caen por recencia, que es el orden base de `products`).
  const featured = useMemo(() => {
    const auto = products.slice().sort((a, b) => {
      const ra = top.rank.has(a.id) ? (top.rank.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
      const rb = top.rank.has(b.id) ? (top.rank.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
    return buildSection(products, fs.featured, auto);
  }, [products, fs.featured, top.rank]);

  // Nuevos ingresos: pins arriba + resto por created_at DESC (orden base de `products`).
  const newArrivals = useMemo(
    () => buildSection(products, fs.newArrivals, products),
    [products, fs.newArrivals],
  );

  // Ofertas: la membresía se DERIVA de las promos vigentes (fuente única). Los
  // pins sólo cuentan si el producto SIGUE en promoción (el pin no fuerza oferta).
  // Resto por mayor descuento %.
  const offers = useMemo(() => {
    const refPrice = (p: Product) =>
      config.storeType === 'wholesale' ? p.wholesale_price ?? 0 : p.retail_price ?? 0;
    const discPct = (p: Product) => priceFor(refPrice(p), p).discountPct ?? 0;
    const inPromo = products.filter((p) => promoForProduct(p) !== null);
    const inPromoIds = new Set(inPromo.map((p) => p.id));
    const auto = inPromo.slice().sort((a, b) => discPct(b) - discPct(a));
    const pinIds = fs.offersOrder.filter((id) => inPromoIds.has(id));
    return buildSection(products, pinIds, auto);
  }, [products, fs.offersOrder, promoForProduct, priceFor, config.storeType]);

  const productSkeleton = (
    <div className="mx-auto max-w-none px-6 py-8 md:py-16">
      <ProductGridSkeleton />
    </div>
  );

  // Nodo por sección (null = no se muestra: deshabilitada, sin datos o no-PRO).
  // Las secciones PRO se gatean con isPro; las demás por su flag.
  const nodes: Record<string, ReactNode> = {
    hero: config.heroEnabled ? <Hero /> : null,
    // Acoplada al hero (sin gap), como su parte inferior, con color de fondo configurable.
    trust_badges: config.sections.trustBadges ? (
      <TrustBadges attached background={config.trustBadgesBgColor || undefined} />
    ) : null,
    categories: config.sections.categories ? <CategoriesSection products={products} /> : null,
    featured: config.sections.featured
      ? isLoading
        ? productSkeleton
        : <ProductsSection label="Lo más buscado" title="Destacados" products={featured} linkTo="/productos" />
      : null,
    new_arrivals:
      config.sections.newArrivals && !isLoading
        ? <ProductsSection label="Recién llegados" title="Nuevos ingresos" products={newArrivals} linkTo="/productos" />
        : null,
    // Ofertas: se muestra sólo si hay productos en promoción para el canal. El
    // orden se gestiona desde el panel "Organizar"; la membresía sale de las promos.
    offers: !isLoading && offers.length > 0
      ? <ProductsSection label="Aprovechá" title="Ofertas" products={offers} linkTo="/productos" />
      : null,
    // Outfits son exclusivos de la tienda minorista (no aplican a mayorista).
    outfits: config.storeType !== 'wholesale' && config.isPro && config.sections.outfits ? <OutfitsSection /> : null,
    stories: config.isPro && config.sections.stories ? <StoriesSection /> : null,
    social_proof: config.isPro && config.sections.socialProof ? <SocialProofSection /> : null,
    newsletter: config.isPro && config.sections.newsletter ? <NewsletterSection /> : null,
  };

  // Secciones personalizadas: cada una se referencia en sections_order como
  // `custom:<uuid>`. Las agregamos al mapa de nodos para que se intercalen.
  const customKeys: string[] = [];
  for (const cs of customSections) {
    const key = `custom:${cs.id}`;
    customKeys.push(key);
    nodes[key] = cs.section_type === 'banner'
      ? <CustomBannerSection section={cs} />
      : <CustomTextSection section={cs} />;
  }

  // Orden configurado en el admin (sections_order) + las secciones fijas que
  // falten (en su posición por defecto) + las custom que aún no estén en el orden.
  const orderedKeys = [
    ...config.sectionsOrder.filter((k) => k in nodes),
    ...DEFAULT_SECTION_ORDER.filter((k) => !config.sectionsOrder.includes(k)),
    ...customKeys.filter((k) => !config.sectionsOrder.includes(k)),
  ];

  return (
    <div>
      <Seo
        title={config.metaTitle || config.name}
        description={config.metaDescription || config.tagline || `Tienda online de ${config.name}.`}
        image={config.ogImageUrl}
        slug={config.slug}
        siteName={config.name}
        path="/"
      />
      {/* Banner de promoción de tienda completa (scope 'all'), arriba del contenido. */}
      <PromoBannerAuto />
      {orderedKeys.map((key) => {
        const node = nodes[key];
        if (!node) return null;
        // Hero y trust badges van arriba del fold: se muestran de una, sin fade
        // (animarlos perjudicaría la carga inicial y el LCP).
        if (key === 'hero' || key === 'trust_badges') return <Fragment key={key}>{node}</Fragment>;
        return <Reveal key={key}>{node}</Reveal>;
      })}
    </div>
  );
}
