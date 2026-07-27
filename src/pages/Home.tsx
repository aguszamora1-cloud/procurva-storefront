import { Fragment, useMemo, type ReactNode } from 'react';
import { useStore } from '@/context/StoreProvider';
import { useProducts } from '@/hooks/useProducts';
import { useFeaturedSections } from '@/hooks/useFeaturedSections';
import { useTopSelling } from '@/hooks/useTopSelling';
import { usePromotions } from '@/context/PromotionsContext';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import type { Product } from '@/lib/types';
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
  const { sections: customSections, isLoading: customLoading } = useCustomSections();
  // Pins (productos fijados) por canal, desde storefront_featured_products.
  const fs = useFeaturedSections();
  // Ranking de ventas para la regla automática de Destacados.
  const top = useTopSelling();
  const { promoForProduct, priceFor } = usePromotions();

  // Gate de pintado: sin productos no hay grillas ni categorías, así que la
  // tienda espera al catálogo antes de mostrarse (ver FirstPaintContext). Las
  // secciones personalizadas también, porque se intercalan en cualquier posición
  // del orden y aparecer después corría todo lo que tienen abajo.
  useFirstPaintGate('home-products', isLoading);
  useFirstPaintGate('home-custom-sections', customLoading);

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
    // Ofertas: se muestra sólo si el comercio no la apagó Y hay productos en
    // promoción para el canal. La membresía sale de las promos, no del admin.
    // `section_offers` nace en true: la sección ya existía sin flag, así que el
    // default tiene que reproducir lo que las 66 tiendas ven hoy.
    offers: config.sections.offers && !isLoading && offers.length > 0
      ? <ProductsSection label="Aprovechá" title="Ofertas" products={offers} linkTo="/productos" />
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
  for (const cs of customSections) {
    const key = `custom:${cs.id}`;
    customKeys.push(key);
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
        // (animarlos perjudicaría la carga inicial y el LCP).
        if (key === 'hero' || key === 'trust_badges') return <Fragment key={key}>{node}</Fragment>;
        return <Reveal key={key}>{node}</Reveal>;
      })}
    </div>
  );
}
