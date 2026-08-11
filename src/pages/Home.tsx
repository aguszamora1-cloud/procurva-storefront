import { Fragment, type ReactNode } from 'react';
import { useStore } from '@/context/StoreProvider';
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
import { CustomBannerSection } from '@/components/home/CustomBannerSection';
import { CustomTextSection } from '@/components/home/CustomTextSection';
import { CustomMarqueeSection } from '@/components/home/CustomMarqueeSection';
import { CustomProductsSection } from '@/components/home/CustomProductsSection';
import { CustomCountdownSection } from '@/components/home/CustomCountdownSection';
import { CustomCtaSection } from '@/components/home/CustomCtaSection';
import { CustomSplitSection } from '@/components/home/CustomSplitSection';
import { CustomVideoSection } from '@/components/home/CustomVideoSection';
import { CustomFaqSection } from '@/components/home/CustomFaqSection';
import { CustomDividerSection } from '@/components/home/CustomDividerSection';
import { CustomCategoriesSection } from '@/components/home/CustomCategoriesSection';
import { CustomLocationsSection } from '@/components/home/CustomLocationsSection';
import { PromoBannerAuto } from '@/components/PromoBannerAuto';
import { useCustomSections } from '@/hooks/useCustomSections';
import { ProductGridSkeleton } from '@/components/ProductGrid';
import { Reveal } from '@/components/Reveal';

/**
 * Orden por defecto de las secciones del home. Es también el ORDEN DE DISEÑO que
 * usa `withMissingSections` para ubicar las que falten en un orden guardado.
 *
 * Sólo keys que existan en el mapa `nodes`. Antes también listaba `upsell` y
 * `probador`, que son features de la FICHA DE PRODUCTO y no tienen sección acá:
 * entraban a `orderedKeys` y renderizaban `undefined` (inocuo, pero es la misma
 * drift de listas paralelas que veníamos arrastrando). Ojo al agregar una key:
 * si no está en `nodes`, no se renderiza.
 */
const DEFAULT_SECTION_ORDER = [
  'hero',
  'trust_badges',
  'categories',
  'featured',
  'new_arrivals',
  'offers',
  'outfits',
  'reels',
  'stories',
  'social_proof',
  'newsletter',
];

/**
 * Orden guardado + las secciones que falten, cada una en su POSICIÓN DE DISEÑO.
 *
 * Una sección falta cuando se agregó al código después de que el comercio guardó
 * su orden. Antes se appendeaban al final, y eso hacía que cada sección nueva
 * aterrizara abajo de todo sin que nadie se enterara: a un tenant le dejó Ofertas
 * y Videos debajo del Newsletter, al fondo de la home.
 *
 * La ubicación sale de anclar por PREDECESORES: la sección se inserta después del
 * último de los que la preceden en DEFAULT_SECTION_ORDER y ya están en la lista.
 * Anclar así (en vez de reimponer el orden por defecto) respeta lo que el comercio
 * movió a mano: si subió Outfits arriba de Categorías, ahí se queda.
 *
 * Las secciones custom NO pasan por acá: van al final, porque son contenido nuevo
 * y no tienen posición de diseño que preservar (mismo criterio que el layout de la
 * ficha de producto).
 */
function withMissingSections(saved: string[], available: Record<string, ReactNode>): string[] {
  const out = saved.filter((k) => k in available);
  for (const key of DEFAULT_SECTION_ORDER) {
    if (!(key in available) || out.includes(key)) continue;
    let at = 0;
    for (const prev of DEFAULT_SECTION_ORDER) {
      if (prev === key) break;
      const i = out.indexOf(prev);
      if (i >= 0 && i + 1 > at) at = i + 1;
    }
    out.splice(at, 0, key);
  }
  return out;
}

export function Home() {
  const config = useStore();
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
        : <ProductsSection {...config.sectionHeadings.featured} products={featured} maxItems={config.sectionMaxItems} display={config.sectionDisplayModes.featured} linkTo={sectionListPath('featured')} />
      : null,
    new_arrivals:
      config.sections.newArrivals && !isLoading
        ? <ProductsSection {...config.sectionHeadings.new_arrivals} products={newArrivals} maxItems={config.sectionMaxItems} display={config.sectionDisplayModes.new_arrivals} linkTo={sectionListPath('new_arrivals')} />
        : null,
    // Ofertas: se muestra sólo si el comercio no la apagó Y hay productos en
    // promoción para el canal. La membresía sale de las promos, no del admin.
    // `section_offers` nace en true: la sección ya existía sin flag, así que el
    // default tiene que reproducir lo que las 66 tiendas ven hoy.
    offers: config.sections.offers && !isLoading && offers.length > 0
      ? <ProductsSection {...config.sectionHeadings.offers} products={offers} maxItems={config.sectionMaxItems} display={config.sectionDisplayModes.offers} linkTo={sectionListPath('offers')} />
      : null,
    // Outfits son exclusivos de la tienda minorista (no aplican a mayorista).
    outfits: config.storeType !== 'wholesale' && config.isPro && config.sections.outfits ? <OutfitsSection /> : null,
    stories: config.isPro && config.sections.stories ? <StoriesSection /> : null,
    // Videos verticales de la tienda (catalog_reels, placement='home'). No
    // renderiza nada si el comercio todavía no cargó ninguno.
    reels: config.isPro && config.sections.reels ? <ReelsSection /> : null,
    social_proof: config.isPro && config.sections.socialProof ? <SocialProofSection /> : null,
    newsletter: config.isPro && config.sections.newsletter ? <NewsletterSection /> : null,
  };

  // Secciones personalizadas: cada una se referencia en sections_order como
  // `custom:<uuid>`. Las agregamos al mapa de nodos para que se intercalen.
  const customKeys: string[] = [];
  // Secciones que NO se revelan con fade (ver el render de abajo).
  const noReveal = new Set<string>();
  for (const cs of customSections) {
    const key = `custom:${cs.id}`;
    customKeys.push(key);
    // Franjas finas de color a sangre: el fade del Reveal no se lee como una
    // animación sino como un hueco blanco entre la sección de arriba y la de
    // abajo (el placeholder ocupa el alto en opacity-0). En una barra de ~40px
    // no hay nada que "revelar": tiene que estar pintada desde el principio.
    if (cs.section_type === 'marquee' || cs.section_type === 'divider') noReveal.add(key);
    // Switch (no ternario): un section_type que este build no conoce todavía
    // debe NO renderizar nada. Con el ternario anterior caía en el `else` y se
    // dibujaba como sección de texto (encabezado y cuerpo vacíos).
    switch (cs.section_type) {
      case 'banner':
        nodes[key] = <CustomBannerSection section={cs} />;
        break;
      case 'text':
        nodes[key] = <CustomTextSection section={cs} />;
        break;
      case 'marquee':
        nodes[key] = <CustomMarqueeSection section={cs} />;
        break;
      case 'products':
        nodes[key] = <CustomProductsSection section={cs} />;
        break;
      case 'countdown':
        nodes[key] = <CustomCountdownSection section={cs} />;
        break;
      case 'cta':
        nodes[key] = <CustomCtaSection section={cs} />;
        break;
      case 'split':
        nodes[key] = <CustomSplitSection section={cs} />;
        break;
      case 'video':
        nodes[key] = <CustomVideoSection section={cs} />;
        break;
      case 'faq':
        nodes[key] = <CustomFaqSection section={cs} />;
        break;
      case 'divider':
        nodes[key] = <CustomDividerSection section={cs} />;
        break;
      case 'categories':
        nodes[key] = <CustomCategoriesSection section={cs} />;
        break;
      case 'locations':
        nodes[key] = <CustomLocationsSection section={cs} />;
        break;
      default:
        nodes[key] = null;
    }
  }

  // Orden configurado en el admin (sections_order), con las secciones fijas que
  // falten insertadas en su posición de diseño, y las custom al final.
  const orderedKeys = [
    ...withMissingSections(config.sectionsOrder, nodes),
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
        // (animarlos perjudicaría la carga inicial y el LCP). Las franjas finas
        // (barras de anuncios, separadores) tampoco: ver `noReveal`.
        if (key === 'hero' || key === 'trust_badges' || noReveal.has(key)) {
          return <Fragment key={key}>{node}</Fragment>;
        }
        return <Reveal key={key}>{node}</Reveal>;
      })}
    </div>
  );
}
