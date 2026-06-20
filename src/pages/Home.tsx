import { Fragment, type ReactNode } from 'react';
import { useStore } from '@/context/StoreProvider';
import { useProducts } from '@/hooks/useProducts';
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
  'outfits',
  'upsell',
  'probador',
  'stories',
  'social_proof',
  'newsletter',
];

export function Home() {
  const config = useStore();
  const { products, isLoading } = useProducts();
  const { sections: customSections } = useCustomSections();

  // Destacados: sólo los marcados is_featured en ProCurva (máx 8).
  const featured = products.filter((p) => p.is_featured).slice(0, 8);
  // Nuevos ingresos: más recientes (ya vienen ordenados por created_at desc),
  // excluyendo los que ya están en Destacados para que no se repitan (máx 8).
  const featuredIds = new Set(featured.map((p) => p.id));
  const newArrivals = products.filter((p) => !featuredIds.has(p.id)).slice(0, 8);

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
