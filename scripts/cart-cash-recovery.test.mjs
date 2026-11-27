// P1.2-FIN0-A.2: contado de lista de líneas guardadas antes de FIN0-A
// (src/lib/cartCashRecovery.ts + src/lib/cartCashLine.ts).
//
// Corre con `npm run test:cart-cash-recovery`. Regla: se completa
// `unit_price_cash_original` SÓLO si la línea, rearmada hoy con el catálogo
// vigente, da exactamente lo guardado. Cualquier diferencia = null (la línea no
// se toca). Precios reales de Rosario: tarjeta $35.715, contado $25.000.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(repoRoot, 'node_modules/.cache/cart-cash-recovery-test');
mkdirSync(CACHE_DIR, { recursive: true });
const outfile = resolve(CACHE_DIR, `rec-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `export { recoverCashOriginal } from './src/lib/cartCashRecovery.ts';
      export { needsCashOriginal, cashRecoverySignature } from './src/lib/cartCashLine.ts';`,
    resolveDir: repoRoot,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  packages: 'external',
  alias: { '@': resolve(repoRoot, 'src') },
  define: { 'import.meta.env': '{}' },
  logLevel: 'silent',
  jsx: 'automatic',
});
const T = await import(pathToFileURL(outfile).href);

const PID = 'remera';
const product = (over = {}) => ({
  id: PID,
  categories: ['Remeras'],
  retail_price: 35715,
  retail_price_card: 35715,
  retail_price_transfer: 25000,
  compare_at_price: null,
  size_price_adjustments: null,
  product_variants: [
    { id: 'v-l', size: 'L', color: 'Logo blanco' },
    { id: 'v-xxl', size: 'XXL', color: 'Logo blanco' },
    { id: 'v-rojo', size: 'L', color: 'Logo rojo' },
  ],
  ...over,
});
const auto = (over = {}) => ({
  id: 'promo-auto', name: 'Automática', promo_type: 'automatic', min_quantity: null, discount_type: 'percentage',
  discount_value_minorista: 20, discount_value_mayorista: 20, channel: 'both', scope: 'products', is_active: true,
  stackable_with_coupons: true, max_discount_amount: null, ecommerce_promotion_items: [{ item_type: 'product', item_id: PID }],
  ...over,
});
const qty = { ...auto(), id: 'promo-qty', name: 'Llevá 2', promo_type: 'quantity', min_quantity: 2, scope: 'all', discount_value_minorista: 15, ecommerce_promotion_items: [] };
/** Línea vieja (sin contado de lista), tal como la guardaba la ficha con la promo del 20 %. */
const old = (over = {}) => ({
  product_id: PID, variant_id: 'v-l', name: 'Remera', categories: ['Remeras'], size: 'L', color: 'Logo blanco',
  unit_price: 28572, unit_price_cash: 20000, promo_id: 'promo-auto', promo_name: 'Automática', unit_price_original: 35715,
  promo_stackable: true, qty: 2, image_url: null, ...over,
});
const rec = (line, prod = product(), promos = [auto(), qty]) => T.recoverCashOriginal(line, prod, promos);

test('carrito antiguo recuperable: devuelve el contado de lista vigente', () => {
  assert.equal(rec(old()), 25000);
  // La promo por cantidad (otra de la lista) no interfiere.
  assert.equal(rec(old(), product(), [auto()]), 25000);
});

test('cambió el precio de tarjeta: no se recupera', () => {
  assert.equal(rec(old(), product({ retail_price_card: 36000 })), null);
});

test('cambió sólo el contado: no se recupera (la tarjeta no alcanza para deducirlo)', () => {
  assert.equal(rec(old(), product({ retail_price_transfer: 24000 })), null);
});

test('cambio de talle: ajuste por talle vigente igual se recupera; si cambió el ajuste, no', () => {
  const adj = { XXL: { type: 'percent', value: 10 } };
  // 35.715 × 1,1 = 39.286,5 → promo 20 % = 31.429; contado 27.500 → 22.000.
  const xxl = old({ variant_id: 'v-xxl', size: 'XXL', unit_price: 31429, unit_price_cash: 22000, unit_price_original: 39286.5 });
  assert.equal(rec(xxl, product({ size_price_adjustments: adj })), 27500);
  assert.equal(rec(xxl, product({ size_price_adjustments: { XXL: { type: 'percent', value: 15 } } })), null);
  assert.equal(rec(xxl, product()), null);
  // La variante ya no tiene ese talle.
  const p = product({ product_variants: [{ id: 'v-xxl', size: 'XL', color: 'Logo blanco' }] });
  assert.equal(rec(xxl, p), null);
});

test('promo vencida o modificada: no se recupera', () => {
  assert.equal(rec(old(), product(), [qty]), null); // vencida (ya no viene)
  assert.equal(rec(old(), product(), [auto({ discount_value_minorista: 25 }), qty]), null); // otro %
  assert.equal(rec(old(), product(), [auto({ name: 'Otra' }), qty]), null);
  assert.equal(rec(old(), product(), [auto({ stackable_with_coupons: false }), qty]), null);
  assert.equal(rec(old(), product(), [auto({ id: 'otra-promo' }), qty]), null);
  // Alcance: la promo dejó de incluir al producto.
  assert.equal(rec(old(), product(), [auto({ ecommerce_promotion_items: [{ item_type: 'product', item_id: 'otro' }] }), qty]), null);
});

test('promoción por color: se recupera en el color alcanzado, no en otro', () => {
  const byColor = auto({ ecommerce_promotion_items: [{ item_type: 'product_color', item_id: `${PID}|Logo blanco` }] });
  assert.equal(rec(old(), product(), [byColor, qty]), 25000);
  const rojo = old({ variant_id: 'v-rojo', color: 'Logo rojo' });
  assert.equal(rec(rojo, product(), [byColor, qty]), null);
});

test('producto ausente o de otra tienda: no se recupera', () => {
  assert.equal(rec(old(), null), null);
  assert.equal(rec(old(), product({ id: 'otro-producto' })), null);
});

test('variantes repetidas o cambiadas: no se recupera', () => {
  const dup = product({ product_variants: [{ id: 'v-l', size: 'L', color: 'Logo blanco' }, { id: 'v-l', size: 'L', color: 'Logo blanco' }] });
  assert.equal(rec(old(), dup), null);
  assert.equal(rec(old(), product({ product_variants: [] })), null);
  assert.equal(rec(old(), product({ product_variants: [{ id: 'v-l', size: 'L', color: 'Logo rojo' }] })), null);
  // Otra variante con el mismo talle y color no confunde: se busca por id.
  const twin = product({ product_variants: [{ id: 'v-l', size: 'L', color: 'Logo blanco' }, { id: 'v-l2', size: 'L', color: 'Logo blanco' }] });
  assert.equal(rec(old(), twin), 25000);
});

test('cambiaron las categorías: no se recupera', () => {
  assert.equal(rec(old(), product({ categories: ['Remeras', 'Ofertas'] })), null);
  assert.equal(rec(old({ categories: undefined }), product()), null);
});

test('no son candidatas: escalones, outfit, mayorista, sin promo, ya completas', () => {
  const lines = [
    old({ source: 'tier', tierGroupId: 'g1', tierLabel: 'Lleva 2 — 15% OFF' }),
    old({ outfit_id: 'o1', promo_id: undefined }),
    old({ outfit_id: 'o1' }),
    old({ source: 'curva', curves: 1 }),
    old({ source: 'suelto' }),
    old({ promo_id: undefined, promo_name: undefined, unit_price: 35715, unit_price_original: undefined, unit_price_cash: 25000 }),
    old({ unit_price_cash: undefined }),
    old({ unit_price_cash_original: 25000 }),
  ];
  for (const l of lines) {
    assert.equal(T.needsCashOriginal(l), false, JSON.stringify(l));
    assert.equal(rec(l), null);
  }
  assert.equal(T.needsCashOriginal(old()), true);
});

test('la huella ignora la cantidad y cambia con cualquier dato de precio', () => {
  const s = T.cashRecoverySignature(old());
  assert.equal(T.cashRecoverySignature(old({ qty: 5 })), s);
  for (const over of [{ unit_price: 1 }, { unit_price_cash: 1 }, { unit_price_original: 1 }, { promo_id: 'x' }, { size: 'M' }, { color: 'x' }, { variant_id: 'x' }, { categories: ['x'] }]) {
    assert.notEqual(T.cashRecoverySignature(old(over)), s, JSON.stringify(over));
  }
});
