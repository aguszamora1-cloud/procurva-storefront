import type { Product } from './types';
import { toCatalogCards } from './utils';

/**
 * Armado de las secciones de productos del home (Destacados / Nuevos ingresos /
 * Ofertas), en funciones puras para que las compartan el home y el listado.
 *
 * Vivía adentro de Home.tsx. Se extrajo porque el botón "Ver más productos"
 * manda a /productos?seccion=…, y ese listado tiene que mostrar EXACTAMENTE el
 * mismo conjunto que la sección: si el criterio estuviera escrito dos veces, se
 * desincronizaría a la primera modificación.
 */

/** Las tres secciones de productos del home. Espeja `section` de storefront_featured_products. */
export type HomeSectionKey = 'featured' | 'new_arrivals' | 'offers';

/** Valor de `?seccion=` en /productos por sección (en castellano, como el resto de la URL). */
export const SECTION_PARAM: Record<HomeSectionKey, string> = {
  featured: 'destacados',
  new_arrivals: 'nuevos',
  offers: 'ofertas',
};

const PARAM_TO_SECTION: Record<string, HomeSectionKey> = {
  destacados: 'featured',
  nuevos: 'new_arrivals',
  ofertas: 'offers',
};

/** Ruta del listado con el conjunto de una sección. */
export const sectionListPath = (key: HomeSectionKey): string => `/productos?seccion=${SECTION_PARAM[key]}`;

/** Sección a la que apunta un `?seccion=`, o null si el valor no corresponde a ninguna. */
export function sectionFromParam(value: string | null | undefined): HomeSectionKey | null {
  if (!value) return null;
  return PARAM_TO_SECTION[value.trim().toLowerCase()] ?? null;
}

/**
 * Productos de una sección: primero los FIJADOS por el comercio (en el orden del
 * admin, sólo los que existen en el catálogo cargado), después el resto por la
 * regla automática de la sección, sin duplicar.
 *
 * SIN LÍMITE a propósito: el corte se hace después de expandir las cards por
 * color (ver limitSectionCards). Cortar acá era el bug que esto viene a
 * arreglar — 12 productos de 3 colores son 36 cards.
 */
export function buildSectionProducts(
  products: Product[],
  pinIds: string[],
  autoOrdered: Product[],
): Product[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const pinned = pinIds.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  const pinnedSet = new Set(pinned.map((p) => p.id));
  const rest = autoOrdered.filter((p) => !pinnedSet.has(p.id));
  return [...pinned, ...rest];
}

export interface LimitedSectionCards {
  /** Las cards a renderizar, ya cortadas. */
  cards: Product[];
  /** Total de cards de la sección antes del corte. */
  total: number;
  /** Si quedaron cards afuera (habilita el botón "Ver más productos"). */
  hasMore: boolean;
}

/**
 * Cards visibles de una sección: expande los productos con
 * display_variants_separately en una card por color y recién ahí corta.
 *
 * El corte cuenta CARDS, que es lo que ve el visitante. `toCatalogCards` además
 * manda las agotadas al fondo del conjunto entero, así que el corte se lleva las
 * disponibles primero.
 */
export function limitSectionCards(products: Product[], max: number): LimitedSectionCards {
  const cards = toCatalogCards(products);
  return {
    cards: max > 0 ? cards.slice(0, max) : cards,
    total: cards.length,
    hasMore: max > 0 && cards.length > max,
  };
}
