import { Fragment, useMemo, type ReactNode } from 'react';
import { useStore } from '@/context/StoreProvider';
import { useProducts } from '@/hooks/useProducts';
import { useFeaturedSections } from '@/hooks/useFeaturedSections';
import { usePromotions } from '@/context/PromotionsContext';
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

// Resuelve los productos de una sección: si la tabla storefront_featured_products
// está disponible (ok), usa esos product_id ordenados (membresía + orden); si no,
// cae al criterio viejo por flag. Sólo incluye productos presentes en el catálogo
// cargado (visibles, con precio del canal).
function pickSection<T extends { id: string }>(
  products: T[],
  orderedIds: string[],
  ok: boolean,
  flagFn: (p: T) => boolean,
): T[] {
  if (ok) {
    const byId = new Map(products.map((p) => [p.id, p]));
    return orderedIds.map((id) => byId.get(id)).filter((p): p is T => Boolean(p)).slice(0, 12);
  }
  return products.filter(flagFn).slice(0, 8);
}

export function Home() {
  const config = useStore();
  const { products, isLoading } = useProducts();
  const { sections: customSections } = useCustomSections();
  // Fuente de verdad de las secciones: storefront_featured_products (por canal),
  // gestionada desde el panel "Organizar" del admin.
  const fs = useFeaturedSections();
  const { promoForProduct } = usePromotions();

  // Destacados y Nuevos ingresos: membresía + orden vienen de
  // storefront_featured_products. Si la tabla no está disponible (fs.ok=false),
  // caemos al criterio viejo por flags para no dejar el home vacío.
  const featured = useMemo(
    () => pickSection(products, fs.featured, fs.ok, (p) => !!p.is_featured),
    [products, fs.featured, fs.ok],
  );
  const newArrivals = useMemo(
    () => pickSection(products, fs.newArrivals, fs.ok, (p) => !!p.is_new_arrival),
    [products, fs.newArrivals, fs.ok],
  );
  // Ofertas: la membresía se DERIVA de las promociones activas; el orden (si hay)
  // sale de storefront_featured_products (section 'offers').
  const offers = useMemo(() => {
    const withPromo = products.filter((p) => promoForProduct(p) !== null);
    if (fs.offersOrder.length > 0) {
      const pos = new Map(fs.offersOrder.map((id, i) => [id, i]));
      withPromo.sort(
        (a, b) =>
          (pos.has(a.id) ? (pos.get(a.id) as number) : Number.MAX_SAFE_INTEGER) -
          (pos.has(b.id) ? (pos.get(b.id) as number) : Number.MAX_SAFE_INTEGER),
      );
    }
    return withPromo.slice(0, 12);
  }, [products, promoForProduct, fs.offersOrder]);

  const productSkeleton = (
    <div className="mx-auto max-w-none px-6 py-10 md:py-24">
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
