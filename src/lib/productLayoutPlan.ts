// Orden de la ficha de producto: QUÉ va y en qué orden, sin dibujar nada.
//
// Lo usan la ficha de Classic (pages/ProductDetail.tsx) y las plantillas, para
// que el orden que el comercio arma en el editor se respete igual en todas. Es
// el algoritmo que vivía dentro de ProductDetail.tsx (buildRightColumn y
// BelowProductBlocks), movido sin cambios: el comportamiento de Classic queda
// idéntico (scripts/product-layout-plan.test.mjs lo compara con la copia
// original sobre miles de diseños).
//
// No reemplaza a lib/productLayout.ts (el contrato con el editor, con su espejo
// en el ERP): usa sus piezas (DEFAULT_PRODUCT_LAYOUT, reinsertByReference,
// isCustomToken) y no las cambia.
//
// Qué depende del estado y queda en quien dibuja:
//  - las filas por unidad (sólo si están abiertas): van en el grupo `unitRows`;
//  - un grupo cuyos bloques no tienen nada que mostrar no se emite.

import { DEFAULT_PRODUCT_LAYOUT, customTokenId, isCustomToken, reinsertByReference } from './productLayout';

/**
 * Grupos visuales de la columna derecha. Los tokens de un mismo grupo que queden
 * CONSECUTIVOS se pintan juntos (son partes de una misma decisión). Si el
 * comercio los separa en el editor, cada corrida arma su propio grupo.
 */
export const RIGHT_GROUP: Readonly<Record<string, 'variant' | 'cta'>> = {
  colors: 'variant',
  sizes: 'variant',
  size_guide: 'variant',
  add_to_cart: 'cta',
  whatsapp: 'cta',
  virtual_try: 'cta',
};

/** Tokens que la columna derecha sabe pintar (reels/reviews/related en su variante de columna). */
export const RIGHT_TOKENS: readonly string[] = [
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
  'reels',
  'reviews',
  'related',
];

/**
 * Tokens que anclan un bloque FIJO (no es un elemento del layout): el bloque va
 * justo después del token y, si el comercio oculta el ancla, se reinserta donde
 * lo pone el diseño por defecto. En Classic: escalones (quantity_promo), «N
 * personas viendo» (shipping_promise) y look + secciones de columna +
 * calculadora de envío + insignias (upsells).
 */
export const RIGHT_ANCHORS = ['quantity_promo', 'shipping_promise', 'upsells'] as const;
export type RightAnchor = (typeof RIGHT_ANCHORS)[number];

export type RightStep =
  | {
      kind: 'group';
      group: 'variant' | 'cta';
      tokens: string[];
      /** Primera corrida de variantes: ahí van las filas por unidad cuando están abiertas. */
      unitRows: boolean;
    }
  | {
      kind: 'token';
      token: string;
      /** false = ancla oculta por el comercio: sólo se dibuja su bloque fijo. */
      visible: boolean;
      anchor: boolean;
    };

const isAnchor = (t: string): t is RightAnchor => (RIGHT_ANCHORS as readonly string[]).includes(t);

/**
 * Orden de la columna derecha a partir del `right_column` efectivo (el del
 * producto, o el de la tienda, o DEFAULT_PRODUCT_LAYOUT.right_column).
 */
export function planRightColumn(rightColumn: readonly string[]): RightStep[] {
  // Orden efectivo = los tokens visibles + los ocultos que anclan un bloque
  // fijo, reinsertados donde van. Sin esto, ocultar "Complementarios" se
  // llevaba puesta la calculadora de envío.
  const visible = rightColumn.filter((t) => RIGHT_TOKENS.includes(t));
  const anchors = RIGHT_ANCHORS.filter((t) => !visible.includes(t));
  const order = reinsertByReference(visible, anchors, DEFAULT_PRODUCT_LAYOUT.right_column);

  const steps: RightStep[] = [];
  let unitRowsPlaced = false;
  for (let i = 0; i < order.length; i++) {
    const group = RIGHT_GROUP[order[i]];
    if (group) {
      const run: string[] = [];
      while (i < order.length && RIGHT_GROUP[order[i]] === group) run.push(order[i++]);
      i--;
      // Las filas por unidad encabezan la PRIMERA corrida de variantes.
      const unitRows = group === 'variant' && !unitRowsPlaced;
      if (unitRows) unitRowsPlaced = true;
      steps.push({ kind: 'group', group, tokens: run, unitRows });
      continue;
    }
    steps.push({ kind: 'token', token: order[i], visible: visible.includes(order[i]), anchor: isAnchor(order[i]) });
  }
  return steps;
}

export type BelowStep =
  | { kind: 'block'; token: string }
  | { kind: 'custom'; id: string; key: string };

/**
 * Zona «debajo del producto» en el orden de `below_product`: bloques
 * predefinidos (quien dibuja ignora los que no conoce) y referencias
 * `custom:<id>` a secciones de este slot que existan. Las secciones visibles del
 * slot que el layout no referencia van al final (secciones creadas después de
 * armar el diseño).
 */
export function planBelowProduct(belowProduct: readonly string[], customIds: readonly string[]): BelowStep[] {
  const known = new Set(customIds);
  const referenced = new Set<string>();
  const steps: BelowStep[] = [];
  for (const token of belowProduct) {
    if (isCustomToken(token)) {
      const id = customTokenId(token);
      if (known.has(id)) {
        referenced.add(id);
        steps.push({ kind: 'custom', id, key: token });
      }
      continue;
    }
    steps.push({ kind: 'block', token });
  }
  for (const id of customIds) {
    if (!referenced.has(id)) steps.push({ kind: 'custom', id, key: `unref-${id}` });
  }
  return steps;
}
