// Layout personalizable de la ficha de producto. Es el consumo (storefront) del
// modelo que edita el admin (procurva2 components/catalog/editor/productLayout.ts):
// dos zonas ordenables (columna derecha / debajo del producto). Cada token de un
// array es (a) un id de bloque predefinido (ver KNOWN_ELEMENT_IDS) o (b) una
// referencia a una sección custom del detalle con el prefijo `custom:<uuid>`.
//
// FASE 0 (híbrido + núcleo fijo): el storefront sólo consume el ORDEN de la zona
// `below_product` (bloques + custom sections de ese slot). La columna derecha
// (precio/talle/color/agregar/WhatsApp) se mantiene fija; el resto de los slots
// de custom sections (above_description/below_description/below_gallery) siguen
// renderizando por su mecanismo legacy.

export interface ProductLayout {
  right_column: string[];
  below_product: string[];
}

/** IDs de bloques predefinidos válidos (deben coincidir con PRODUCT_ELEMENTS del admin). */
export const KNOWN_ELEMENT_IDS = [
  'sizes',
  'colors',
  'add_to_cart',
  'whatsapp',
  'shipping_promise',
  'purchase_flow',
  'reviews',
  'upsells',
  'related',
  'size_guide',
  'virtual_try',
  'quantity_promo',
] as const;

/** Layout por defecto (idéntico al DEFAULT_PRODUCT_LAYOUT del admin). */
export const DEFAULT_PRODUCT_LAYOUT: ProductLayout = {
  right_column: ['sizes', 'colors', 'add_to_cart', 'shipping_promise', 'whatsapp'],
  below_product: ['purchase_flow', 'reviews', 'upsells', 'related'],
};

/** Prefijo de los tokens que referencian una sección custom (`custom:<uuid>`). */
export const CUSTOM_SECTION_PREFIX = 'custom:';
export const isCustomToken = (t: string): boolean => t.startsWith(CUSTOM_SECTION_PREFIX);
export const customTokenId = (t: string): string => t.slice(CUSTOM_SECTION_PREFIX.length);

const isValidToken = (t: string): boolean =>
  (KNOWN_ELEMENT_IDS as readonly string[]).includes(t) ||
  (isCustomToken(t) && t.length > CUSTOM_SECTION_PREFIX.length);

/**
 * Resuelve el `product_layout` crudo (JSONB) a un ProductLayout saneado, o `null`
 * si el tenant no configuró uno (o vino inválido). El `null` es significativo: el
 * storefront usa el render legacy fijo cuando no hay layout, garantizando que los
 * tenants sin layout se vean idénticos a antes. Preserva los tokens `custom:` y
 * deduplica entre ambas zonas.
 */
export function resolveProductLayoutOrNull(raw: unknown): ProductLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const pl = raw as { right_column?: unknown; below_product?: unknown };
  if (!Array.isArray(pl.right_column) || !Array.isArray(pl.below_product)) return null;
  const seen = new Set<string>();
  const clean = (arr: unknown[]): string[] =>
    arr.filter(
      (t): t is string => typeof t === 'string' && isValidToken(t) && !seen.has(t) && (seen.add(t), true),
    );
  return { right_column: clean(pl.right_column), below_product: clean(pl.below_product) };
}
