// Layout personalizable de la ficha de producto. Es el consumo (storefront) del
// modelo que edita el admin (procurva2 components/catalog/editor/productLayout.ts):
// dos zonas ordenables (columna derecha / debajo del producto). Cada token de un
// array es (a) un id de bloque predefinido (ver KNOWN_ELEMENT_IDS) o (b) una
// referencia a una sección custom del detalle con el prefijo `custom:<uuid>`.
//
// FASE 1: el storefront consume el orden de LAS DOS zonas. `below_product` se
// recorre en BelowProductBlocks y `right_column` en la columna del detalle
// (sólo canal MINORISTA: en mayorista manda el WholesalePurchasePanel y el
// orden es fijo, igual que en el editor). Los bloques de la columna que no son
// elementos del layout (precio, cupón, escalones, calculadora de envío,
// descripción…) van anclados a un token — ver ProductDetail.tsx.
//
// Los slots de custom sections above_description/below_description/below_gallery
// siguen renderizando por su mecanismo legacy (híbrido).

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
  'reels',
  'reviews',
  'upsells',
  'related',
  'size_guide',
  'virtual_try',
  'quantity_promo',
] as const;

/**
 * Layout por defecto (idéntico al DEFAULT_PRODUCT_LAYOUT del admin).
 *
 * Cumple DOS funciones y las dos exigen que reproduzca exactamente el orden que
 * pinta ProductDetail.tsx:
 *  1. Es lo que se usa para renderizar cuando el tenant NO configuró layout.
 *  2. Es el orden de referencia para reinsertar tokens (ver `reinsertByReference`):
 *     el núcleo que alguien ocultó y las anclas de los bloques fijos.
 * Cualquier diferencia con el JSX se convierte en una ficha reordenada sin que
 * nadie lo haya pedido. Si tocás el orden de la columna, actualizá los dos
 * (y el gemelo del admin).
 *
 * OJO con colores/talles: el orden real es COLOR y después TALLE. Elegir color
 * resetea el talle, así que al revés el comprador elige un talle que después se
 * le borra. El default decía `sizes, size_guide, colors`, que nunca fue lo que
 * el JSX pintaba — con la Fase 0 daba igual (la columna era fija), con la Fase 1
 * le habría dado vuelta la ficha a todo el que sembró ese default.
 */
export const DEFAULT_PRODUCT_LAYOUT: ProductLayout = {
  right_column: [
    'quantity_promo',
    'colors',
    'sizes',
    'size_guide',
    'shipping_promise',
    'add_to_cart',
    'whatsapp',
    'virtual_try',
    'upsells',
    'purchase_flow',
  ],
  below_product: ['reels', 'reviews', 'related'],
};

/**
 * NÚCLEO: sin estos elementos el producto no se puede comprar (no hay cómo
 * elegir la variante ni cómo agregarla). El editor no deja ocultarlos, pero un
 * layout viejo puede tenerlos fuera; acá se reinsertan. Es la misma clase de red
 * de seguridad que FULL_WIDTH_IDS: preferimos ignorar la config a dejar una
 * ficha imposible de comprar.
 */
export const CORE_RIGHT_IDS: readonly string[] = ['colors', 'sizes', 'add_to_cart'];

/**
 * Tokens que pueden vivir en `below_product`. El resto son de columna: el
 * switch de BelowProductBlocks no los conoce, así que un 'sizes' arrastrado
 * ahí no se renderizaba en ningún lado (el mismo bug de 'reels', al revés).
 */
const BELOW_ALLOWED: readonly string[] = ['reels', 'reviews', 'related', 'purchase_flow'];

/**
 * Reinserta `missing` dentro de `order` en la posición que ocupan en `reference`:
 * justo detrás del vecino previo de `reference` que sí esté presente (o al
 * principio si no hay ninguno). Sirve para meter algo de vuelta "donde iba" sin
 * mandarlo al final, que es lo que rompe la ficha.
 */
export function reinsertByReference(order: string[], missing: string[], reference: readonly string[]): string[] {
  const out = [...order];
  // En orden de `reference`: así, al insertar varios, cada uno ya ve a los
  // anteriores colocados y no se invierten entre sí.
  for (const id of [...missing].sort((a, b) => reference.indexOf(a) - reference.indexOf(b))) {
    const refIdx = reference.indexOf(id);
    if (refIdx < 0) {
      out.push(id);
      continue;
    }
    let at = 0;
    for (let i = refIdx - 1; i >= 0; i--) {
      const j = out.indexOf(reference[i]);
      if (j >= 0) {
        at = j + 1;
        break;
      }
    }
    out.splice(at, 0, id);
  }
  return out;
}

/**
 * Bloques de ANCHO COMPLETO: sólo tienen sentido en `below_product`.
 *
 * Este archivo consume únicamente el orden de `below_product` — la columna
 * derecha es fija (ver la nota de la Fase 0 arriba). Así que un bloque de ancho
 * completo guardado en `right_column` no se renderiza en ningún lado y la
 * sección desaparece de la tienda sin aviso. Pasó con 'reels'.
 *
 * Debe coincidir con los `fullWidth: true` de
 * procurva2/components/catalog/editor/productLayout.ts.
 */
const FULL_WIDTH_IDS: readonly string[] = ['reels', 'reviews', 'related'];

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
  const right = clean(pl.right_column);
  const below = clean(pl.below_product);

  // RED DE SEGURIDAD, en los dos sentidos. Un token guardado en la zona que no
  // le corresponde no lo renderiza NADIE, así que el bloque desaparece de la
  // tienda sin aviso (pasó con 'reels'). En vez de descartarlo —que es
  // exactamente el bug— se MUEVE a la zona donde sí se pinta:
  //  - los de ancho completo en la columna  -> al principio de below_product
  //  - los de columna en below_product      -> a su lugar en la columna
  const fullWidthInRight = right.filter((t) => FULL_WIDTH_IDS.includes(t));
  const columnOnlyInBelow = below.filter((t) => !isCustomToken(t) && !BELOW_ALLOWED.includes(t));

  let rightFinal = right.filter((t) => !FULL_WIDTH_IDS.includes(t));
  rightFinal = reinsertByReference(rightFinal, columnOnlyInBelow, DEFAULT_PRODUCT_LAYOUT.right_column);
  // Núcleo que quedó fuera de las dos zonas (ver CORE_RIGHT_IDS).
  rightFinal = reinsertByReference(
    rightFinal,
    CORE_RIGHT_IDS.filter((id) => !rightFinal.includes(id)),
    DEFAULT_PRODUCT_LAYOUT.right_column,
  );

  return {
    right_column: rightFinal,
    below_product: [...fullWidthInRight, ...below.filter((t) => isCustomToken(t) || BELOW_ALLOWED.includes(t))],
  };
}
