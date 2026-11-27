/**
 * Atelier 2 · A2: inicio (referencia: maqueta v2.1 aprobada).
 *
 * Secciones propias: portada, categorías, destacados, recién llegados y ofertas.
 * Todas respetan el editor de la tienda:
 *   - visibilidad: los mismos interruptores que Classic (homeSectionEnabled, vía
 *     useStoreHomeExtras().on);
 *   - orden: el de `sections_order` (orderHomeKeys), también para las propias;
 *     el contenido del comercio (secciones personalizadas, reseñas, newsletter,
 *     videos, historias) se ubica entre ellas con placeAroundNatives,
 *     igual que en las otras plantillas. El newsletter aparece SÓLO ahí, cuando
 *     está habilitado: no hay uno fijo en el pie.
 *     La barra de insignias (beneficios) no se pinta: ver facts.ts.
 *   - títulos: los que escribió el comercio (useHeading), o uno corto.
 * Datos: productos, fijados y más vendidos (useHomeSections), categorías con su
 * imagen. Sin textos, etiquetas ni promociones inventadas.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { useProducts } from '@/hooks/useProducts';
import { useHomeSections } from '@/hooks/useHomeSections';
import { useCategories, type CategoryInfo } from '@/hooks/useCategories';
import { StoreImage } from '@/components/StoreImage';
import { Seo } from '@/components/Seo';
import { orderHomeKeys, type FixedHomeKey } from '@/lib/homeOrder';
import { mainImage } from '@/lib/utils';
import type { Product } from '@/lib/types';
import { categoryHref, categoryImage, isSoldOut, useHeading } from '../shared/commerce';
import { useStoreHomeExtras, type TemplateNatives } from '../shared/StoreContent';
import { Atelier2Card, Atelier2CardSkeleton } from './Card';
import { Atelier2Hero } from './Hero';
import { useAtelier2Palette } from './palette';
import { trustBadgesBacked } from './facts';

/** Bloques propios de Atelier 2. Su orden en pantalla sale de sections_order. */
const NATIVE_KEYS: readonly FixedHomeKey[] = ['hero', 'categories', 'featured', 'new_arrivals', 'offers'];

function SectionHead({ id, title, to }: { id: string; title: string; to?: string }) {
  return (
    <div className="a2-sh">
      <h2 id={id}>{title}</h2>
      {to && (
        <Link to={to} className="a2-sh__a">
          Ver todo
          <ArrowRight aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function CategoryIndex({ categories, products, total }: { categories: CategoryInfo[]; products: Product[]; total: number }) {
  const [active, setActive] = useState(0);
  const images = useMemo(() => categories.map((c) => categoryImage(c, products)), [categories, products]);
  return (
    <section className="a2-wrap a2-sec a2-idx" aria-labelledby="a2-idx-t">
      <div className="a2-idx__l">
        <div className="a2-sh">
          <h2 id="a2-idx-t">Categorías</h2>
        </div>
        <ul>
          {categories.map((c, i) => (
            <li key={c.name}>
              <Link
                to={categoryHref(c.name)}
                aria-current={i === active ? 'true' : undefined}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
              >
                <span className="a2-idx__th">{images[i] && <StoreImage src={images[i]} alt="" width={96} height={120} />}</span>
                <span className="a2-idx__n">{c.name}</span>
                <span className="a2-idx__c">{c.count}</span>
                <ArrowRight aria-hidden="true" />
              </Link>
            </li>
          ))}
          <li>
            <Link to="/productos" className="a2-idx__all">
              <span className="a2-idx__n">Ver todos los productos</span>
              <span className="a2-idx__c">{total}</span>
              <ArrowRight aria-hidden="true" />
            </Link>
          </li>
        </ul>
      </div>
      <div className="a2-idx__img" aria-hidden="true">
        {images.map((src, i) =>
          src && (i === active || i === 0) ? <StoreImage key={categories[i].name} src={src} alt="" width={900} height={1125} data-on={i === active || undefined} /> : null,
        )}
      </div>
    </section>
  );
}

export function Atelier2Home() {
  const config = useStore();
  const { ink, newsletterInk } = useAtelier2Palette();
  const { products, isLoading } = useProducts();
  const { featured, newArrivals, offers } = useHomeSections(products);
  const { categories } = useCategories(products);
  useFirstPaintGate('tpl-home', isLoading);

  const orderKey = config.sectionsOrder.join('|');
  const natives: TemplateNatives = useMemo(() => {
    const ordered = orderHomeKeys(config.sectionsOrder, []).filter((k): k is FixedHomeKey => NATIVE_KEYS.includes(k as FixedHomeKey));
    return ordered.map((k) => [k]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey]);
  // Insignias de confianza: ocultas en Atelier 2 (facts.ts · trustBadgesBacked).
  const store = useStoreHomeExtras(natives, ink, { newsletterInk, hideTrustBadges: !trustBadgesBacked() });

  const featTitle = useHeading('featured', 'Destacados');
  const newTitle = useHeading('new_arrivals', 'Recién llegados');
  const offersTitle = useHeading('offers', 'Ofertas');

  // Catálogo chico: una fila de destacados, para que «Recién llegados» no repita productos.
  const feat = useMemo(() => featured.slice(0, products.length < 24 ? 4 : 8), [featured, products.length]);
  const fresh = useMemo(() => {
    const usable = newArrivals.filter((p) => mainImage(p) && !isSoldOut(p));
    const distinct = usable.filter((p) => !feat.some((f) => f.id === p.id));
    // Sólo se evita repetir si alcanza para la composición; si no, se muestran igual.
    const list = distinct.length >= 3 ? distinct : usable;
    return list.slice(0, list.length >= 5 ? 5 : list.length >= 3 ? 3 : list.length);
  }, [newArrivals, feat]);
  const offerRow = useMemo(() => offers.slice(0, 4), [offers]);

  const block = (key: FixedHomeKey) => {
    if (!store.on(key)) return null;
    switch (key) {
      case 'hero':
        return <Atelier2Hero products={products} categories={categories.length} />;
      case 'categories':
        return categories.length > 1 ? <CategoryIndex categories={categories} products={products} total={products.length} /> : null;
      case 'featured':
        if (isLoading) return <Atelier2CardSkeleton />;
        return feat.length > 0 ? (
          <section className="a2-wrap a2-sec" aria-labelledby="a2-feat-t">
            <SectionHead id="a2-feat-t" title={featTitle} to="/productos" />
            <div className="a2-grid">
              {feat.map((p, i) => (
                <Atelier2Card key={p.card_key ?? p.id} product={p} priority={i < 2} />
              ))}
            </div>
          </section>
        ) : null;
      case 'new_arrivals':
        if (isLoading) return null;
        return fresh.length > 0 ? (
          <section className="a2-wrap a2-sec" aria-labelledby="a2-new-t">
            <SectionHead id="a2-new-t" title={newTitle} to="/productos?orden=nuevos" />
            <div className="a2-fresh" data-n={fresh.length}>
              {fresh.map((p, i) => (
                <Atelier2Card key={p.card_key ?? p.id} product={p} big={i === 0 && fresh.length >= 3} />
              ))}
            </div>
          </section>
        ) : null;
      case 'offers':
        if (isLoading) return null;
        return offerRow.length > 0 ? (
          <section className="a2-wrap a2-sec" aria-labelledby="a2-off-t">
            <SectionHead id="a2-off-t" title={offersTitle} to="/productos" />
            <div className="a2-grid a2-grid--row">
              {offerRow.map((p) => (
                <Atelier2Card key={p.card_key ?? p.id} product={p} />
              ))}
            </div>
          </section>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="a2-home">
      <Seo title={config.metaTitle || config.name} description={config.metaDescription || config.tagline || config.name} image={config.ogImageUrl} slug={config.slug} siteName={config.name} path="/" />
      {store.slot(0)}
      {natives.map(([key], i) => (
        <div key={key} className="a2-native" data-native={key}>
          {block(key)}
          {store.slot(i + 1)}
        </div>
      ))}
    </div>
  );
}
