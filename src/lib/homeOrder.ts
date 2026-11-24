/**
 * Orden y visibilidad de las secciones del home, en funciones puras.
 *
 * Vivía adentro de pages/Home.tsx (Classic). Se extrajo en T5 para que las
 * plantillas (src/templates) muestren el contenido que el comercio cargó con
 * EXACTAMENTE el mismo criterio que Classic: si estuviera escrito dos veces, a la
 * primera modificación una tienda vería secciones distintas según la plantilla.
 * Lo prueba scripts/home-order.test.mjs.
 *
 * Sin imports de React ni de Supabase: Node lo importa directo en las pruebas.
 */

/**
 * Orden por defecto de las secciones del home. Es también el ORDEN DE DISEÑO que
 * usa `withMissingSections` para ubicar las que falten en un orden guardado.
 *
 * Sólo keys que existan en el mapa de nodos del home. Antes también listaba
 * `upsell` y `probador`, que son features de la FICHA DE PRODUCTO y no tienen
 * sección acá: entraban a `orderedKeys` y renderizaban `undefined` (inocuo, pero
 * es la misma drift de listas paralelas que veníamos arrastrando). Ojo al agregar
 * una key: si no está en el mapa de nodos, no se renderiza.
 */
export const DEFAULT_SECTION_ORDER = [
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
] as const;

export type FixedHomeKey = (typeof DEFAULT_SECTION_ORDER)[number];

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
 *
 * `available`: las keys que existen en el mapa de nodos (aunque su nodo sea null).
 */
export function withMissingSections(saved: readonly string[], available: ReadonlySet<string>): string[] {
  const out = saved.filter((k) => available.has(k));
  for (const key of DEFAULT_SECTION_ORDER) {
    if (!available.has(key) || out.includes(key)) continue;
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

/** Key de una sección personalizada en `sections_order`. */
export const customSectionKey = (id: string): string => `custom:${id}`;

/**
 * Orden final del home: el configurado en el admin (sections_order), con las
 * secciones fijas que falten insertadas en su posición de diseño, y las custom
 * que el orden guardado no nombra, al final (en el orden en que llegan).
 *
 * `customKeys`: `custom:<uuid>` de las secciones personalizadas activas.
 */
export function orderHomeKeys(sectionsOrder: readonly string[], customKeys: readonly string[]): string[] {
  const available = new Set<string>([...DEFAULT_SECTION_ORDER, ...customKeys]);
  return [...withMissingSections(sectionsOrder, available), ...customKeys.filter((k) => !sectionsOrder.includes(k))];
}

/** Lo que necesitan las reglas de visibilidad (un subconjunto de StoreConfig). */
export interface HomeVisibilityConfig {
  heroEnabled: boolean;
  isPro: boolean;
  storeType: string | null | undefined;
  sections: {
    trustBadges: boolean;
    categories: boolean;
    featured: boolean;
    newArrivals: boolean;
    offers: boolean;
    outfits: boolean;
    stories: boolean;
    reels: boolean;
    socialProof: boolean;
    newsletter: boolean;
  };
}

/**
 * ¿El comercio tiene prendida esta sección fija? Es la regla de Classic, sin los
 * datos: una sección prendida puede igual no pintar nada (Ofertas sin productos
 * en promo, Videos sin videos cargados, …); eso lo decide cada componente.
 * Las secciones PRO se gatean con isPro; las demás sólo por su flag.
 */
export function homeSectionEnabled(key: FixedHomeKey, c: HomeVisibilityConfig): boolean {
  switch (key) {
    case 'hero':
      return c.heroEnabled;
    case 'trust_badges':
      return c.sections.trustBadges;
    case 'categories':
      return c.sections.categories;
    case 'featured':
      return c.sections.featured;
    case 'new_arrivals':
      return c.sections.newArrivals;
    // `section_offers` nace en true: la sección ya existía sin flag.
    case 'offers':
      return c.sections.offers;
    // Outfits son exclusivos de la tienda minorista (no aplican a mayorista).
    case 'outfits':
      return c.storeType !== 'wholesale' && c.isPro && c.sections.outfits;
    case 'stories':
      return c.isPro && c.sections.stories;
    case 'reels':
      return c.isPro && c.sections.reels;
    case 'social_proof':
      return c.isPro && c.sections.socialProof;
    case 'newsletter':
      return c.isPro && c.sections.newsletter;
    default:
      return false;
  }
}

/**
 * Plantillas: ubica el contenido del comercio alrededor de los bloques propios de
 * la plantilla.
 *
 * Una plantilla tiene su propia composición (portada, ingresos, categorías…) en
 * su propio orden: eso es su diseño y no se reordena. Lo demás que el comercio
 * cargó (secciones personalizadas, reseñas, newsletter, videos, historias,
 * beneficios) se ubica respecto de esos bloques con el orden de la tienda: cada
 * sección va DESPUÉS del último bloque propio que la precede en el orden de
 * Classic. Si ninguno la precede, va arriba de todo (como una franja de anuncio
 * puesta antes de la portada).
 *
 * `natives`: los grupos de keys que pinta cada bloque propio, en el orden en que
 *   la plantilla los pinta (un bloque puede cubrir varias keys, ej. las pestañas
 *   de Momentum cubren Destacados, Nuevos y Ofertas).
 * `extras`: las keys que la plantilla delega en los componentes de Classic.
 *
 * Devuelve `natives.length + 1` listas: la 0 va antes del primer bloque propio y
 * la i+1 inmediatamente después del bloque i. Cada extra aparece una sola vez y
 * cada lista conserva el orden de la tienda. Las keys que no son ni propias ni
 * extras (ej. outfits en la v1) no aparecen y no anclan nada.
 */
export function placeAroundNatives(
  ordered: readonly string[],
  natives: readonly (readonly string[])[],
  extras: ReadonlySet<string>,
): string[][] {
  const group = new Map<string, number>();
  natives.forEach((keys, i) => keys.forEach((k) => group.set(k, i)));
  const out: string[][] = Array.from({ length: natives.length + 1 }, () => []);
  let anchor = 0;
  for (const key of ordered) {
    const g = group.get(key);
    if (g !== undefined) {
      anchor = g + 1;
      continue;
    }
    if (extras.has(key)) out[anchor].push(key);
  }
  return out;
}
