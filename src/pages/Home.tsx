import type { ReactNode } from 'react';
import { useStore } from '@/context/StoreProvider';
import { useTypography } from '@/hooks/useTypography';
import { useProducts } from '@/hooks/useProducts';
import { useHomeSections } from '@/hooks/useHomeSections';
import { sectionListPath } from '@/lib/homeSections';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { Seo } from '@/components/Seo';
import { Hero } from '@/components/Hero';
import { TrustBadges } from '@/components/TrustBadges';
import { CategoriesSection } from '@/components/home/CategoriesSection';
import { ProductsSection } from '@/components/home/ProductsSection';
import { NewsletterSection } from '@/components/home/NewsletterSection';
import { StoriesSection } from '@/components/home/StoriesSection';
import { ReelsSection } from '@/components/home/ReelsSection';
import { SocialProofSection } from '@/components/home/SocialProofSection';
import { OutfitsSection } from '@/components/home/OutfitsSection';
import { PromoBannerAuto } from '@/components/PromoBannerAuto';
import { customSectionKey, homeSectionEnabled, orderHomeKeys, type FixedHomeKey } from '@/lib/homeOrder';
import { customSectionNode, customSectionSkipsReveal } from '@/components/home/customSectionNode';
import { useCustomSections } from '@/hooks/useCustomSections';
import { ProductGridSkeleton } from '@/components/ProductGrid';
import { Reveal } from '@/components/Reveal';
import { PreviewSection } from '@/components/PreviewSection';

// Orden y visibilidad de las secciones: lib/homeOrder (compartido con las
// plantillas, T5). Nodos de las secciones personalizadas: customSectionNode.

export function Home() {
  const config = useStore();
  const { version: typoVersion } = useTypography();
  // v2: el home tiene que tener SU h1. Hoy sólo existe si el hero pinta título
  // (Hero.tsx); con un hero "sólo imagen", sin título o apagado, la página no
  // tenía h1 (malo para buscadores y lectores de pantalla). Va oculto a la
  // vista: no cambia nada de lo que se ve.
  const heroHasH1 = config.heroEnabled && config.heroMode !== 'image_only' && Boolean(config.heroTitle);
  const { products, isLoading } = useProducts();
  const { sections: customSections, isLoading: customLoading } = useCustomSections();
  // Las tres secciones de productos, COMPLETAS (sin cortar). El corte lo hace
  // ProductsSection sobre las cards ya expandidas por color, con el máximo que
  // configuró el comercio; el resto queda detrás del "Ver más productos".
  const { featured, newArrivals, offers } = useHomeSections(products);

  // Gate de pintado: sin productos no hay grillas ni categorías, así que la
  // tienda espera al catálogo antes de mostrarse (ver FirstPaintContext). Las
  // secciones personalizadas también, porque se intercalan en cualquier posición
  // del orden y aparecer después corría todo lo que tienen abajo.
  useFirstPaintGate('home-products', isLoading);
  useFirstPaintGate('home-custom-sections', customLoading);

  const productSkeleton = (
    <div className="mx-auto max-w-none px-6 py-8 md:py-16">
      <ProductGridSkeleton />
    </div>
  );

  // Nodo por sección (null = no se muestra: deshabilitada, sin datos o no-PRO).
  // Las secciones PRO se gatean con isPro; las demás por su flag (homeSectionEnabled).
  const on = (key: FixedHomeKey) => homeSectionEnabled(key, config);
  const nodes: Record<string, ReactNode> = {
    hero: on('hero') ? <Hero /> : null,
    // Acoplada al hero (sin gap), como su parte inferior, con color de fondo configurable.
    trust_badges: on('trust_badges') ? (
      <TrustBadges attached background={config.trustBadgesBgColor || undefined} />
    ) : null,
    categories: on('categories') ? <CategoriesSection products={products} /> : null,
    featured: on('featured')
      ? isLoading
        ? productSkeleton
        : <ProductsSection {...config.sectionHeadings.featured} products={featured} maxItems={config.sectionMaxItems} display={config.sectionDisplayModes.featured} linkTo={sectionListPath('featured')} />
      : null,
    new_arrivals:
      on('new_arrivals') && !isLoading
        ? <ProductsSection {...config.sectionHeadings.new_arrivals} products={newArrivals} maxItems={config.sectionMaxItems} display={config.sectionDisplayModes.new_arrivals} linkTo={sectionListPath('new_arrivals')} />
        : null,
    // Ofertas: se muestra sólo si el comercio no la apagó Y hay productos en
    // promoción para el canal. La membresía sale de las promos, no del admin.
    // `section_offers` nace en true: la sección ya existía sin flag, así que el
    // default tiene que reproducir lo que las 66 tiendas ven hoy.
    offers: on('offers') && !isLoading && offers.length > 0
      ? <ProductsSection {...config.sectionHeadings.offers} products={offers} maxItems={config.sectionMaxItems} display={config.sectionDisplayModes.offers} linkTo={sectionListPath('offers')} />
      : null,
    // Outfits son exclusivos de la tienda minorista (no aplican a mayorista).
    outfits: on('outfits') ? <OutfitsSection /> : null,
    stories: on('stories') ? <StoriesSection /> : null,
    // Videos verticales de la tienda (catalog_reels, placement='home'). No
    // renderiza nada si el comercio todavía no cargó ninguno.
    reels: on('reels') ? <ReelsSection /> : null,
    social_proof: on('social_proof') ? <SocialProofSection /> : null,
    newsletter: on('newsletter') ? <NewsletterSection /> : null,
  };

  // Secciones personalizadas: cada una se referencia en sections_order como
  // `custom:<uuid>`. Las agregamos al mapa de nodos para que se intercalen.
  const customKeys: string[] = [];
  // Secciones que NO se revelan con fade (ver el render de abajo).
  const noReveal = new Set<string>();
  for (const cs of customSections) {
    const key = customSectionKey(cs.id);
    customKeys.push(key);
    if (customSectionSkipsReveal(cs)) noReveal.add(key);
    nodes[key] = customSectionNode(cs);
  }

  // Orden configurado en el admin (sections_order), con las secciones fijas que
  // falten insertadas en su posición de diseño, y las custom al final.
  const orderedKeys = orderHomeKeys(config.sectionsOrder, customKeys);

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
      {typoVersion === 'v2' && !heroHasH1 && <h1 className="sr-only">{config.name}</h1>}
      {/* Banner de promoción de tienda completa (scope 'all'), arriba del contenido. */}
      <PromoBannerAuto />
      {orderedKeys.map((key) => {
        const node = nodes[key];
        if (!node) return null;
        // Hero y trust badges van arriba del fold: se muestran de una, sin fade
        // (animarlos perjudicaría la carga inicial y el LCP). Las franjas finas
        // (barras de anuncios, separadores) tampoco: ver `noReveal`.
        // EDITOR E3.0: PreviewSection marca la sección para la selección visual
        // SÓLO dentro del diseñador; en la tienda pública devuelve el nodo tal cual.
        if (key === 'hero' || key === 'trust_badges' || noReveal.has(key)) {
          return (
            <PreviewSection key={key} id={key}>
              {node}
            </PreviewSection>
          );
        }
        return (
          <PreviewSection key={key} id={key}>
            <Reveal>{node}</Reveal>
          </PreviewSection>
        );
      })}
    </div>
  );
}
