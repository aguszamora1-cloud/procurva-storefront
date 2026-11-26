// P1.2-FIN0-A: precio de las líneas del carrito con la promo POR CANTIDAD
// (src/lib/cart.ts priceCartItems), lo que cobra el checkout.
//
// Corre con `npm run test:cart-pricing`. Regla comercial: la promo automática (o
// un precio ya rebajado, como el combo de un outfit) y la promo por cantidad NO
// se acumulan. En cada medio de pago queda la más conveniente, calculada sobre
// la base de lista de ESE medio. El descuento de contado (transferencia) es un
// precio propio del producto, no un porcentaje: se respeta tal cual.
//
// Precios reales de Rosario Sportwear: tarjeta $35.715, contado $25.000.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(repoRoot, 'node_modules/.cache/cart-pricing-test');
mkdirSync(CACHE_DIR, { recursive: true });
const outfile = resolve(CACHE_DIR, `cart-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `export { priceCartItems, cartLineKey } from './src/lib/cart.ts';
      export { computeQuantityPromos } from './src/lib/promotions.ts';
      export { buildSingleCartItem } from './src/lib/tierPurchase.ts';`,
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
const promo = (over) => ({
  id: 'promo-auto', name: 'Automática', promo_type: 'automatic', min_quantity: null, discount_type: 'percentage',
  discount_value_minorista: 20, discount_value_mayorista: 20, channel: 'both', scope: 'products', is_active: true,
  stackable_with_coupons: true, max_discount_amount: null, ecommerce_promotion_items: [{ item_type: 'product', item_id: PID }],
  ...over,
});
const qtyPromo = (pct, over = {}) =>
  promo({ id: 'promo-qty', name: 'Llevá 2', promo_type: 'quantity', min_quantity: 2, scope: 'all', discount_value_minorista: pct, discount_value_mayorista: pct, ecommerce_promotion_items: [], ...over });

/** Lo mismo que hace useCartPromos: las líneas «Lleva N» no entran a la promo por cantidad. */
function price(items, promotions, storeType = 'retail') {
  const lines = items
    .filter((it) => it.source !== 'tier')
    .map((it) => ({
      key: T.cartLineKey(it),
      productId: it.product_id,
      categories: it.categories ?? [],
      color: it.color ?? null,
      qty: it.qty,
      unitPriceBase: it.unit_price,
      unitPriceOriginal: it.unit_price_original ?? it.unit_price,
    }));
  return T.priceCartItems(items, T.computeQuantityPromos(lines, promotions, storeType), storeType);
}

const line = (over) => ({ product_id: PID, variant_id: 'v-l', name: 'Remera', categories: ['Remeras'], size: 'L', color: 'Logo blanco', qty: 2, image_url: null, ...over });
/** Suelto sin promo automática (así lo arma la ficha). */
const plain = (over) => line({ unit_price: 35715, unit_price_cash: 25000, ...over });
/** Suelto con promo automática del 20 %, como lo arma buildSingleCartItem DESPUÉS del cambio. */
const auto20 = (over) => line({ unit_price: 28572, unit_price_cash: 20000, promo_id: 'promo-auto', promo_name: 'Automática', unit_price_original: 35715, unit_price_cash_original: 25000, promo_stackable: true, ...over });
/** Suelto con promo automática del 10 %. */
const auto10 = (over) => line({ unit_price: 32144, unit_price_cash: 22500, promo_id: 'promo-auto', promo_name: 'Automática', unit_price_original: 35715, unit_price_cash_original: 25000, promo_stackable: true, ...over });
const withoutCashOriginal = (it) => { const c = { ...it }; delete c.unit_price_cash_original; return c; };
const pick = (it) => ({ card: it.unit_price, cash: it.unit_price_cash, promo: it.promo_id ?? null });

test('promo por cantidad sola: baja tarjeta y contado, cada uno sobre su lista', () => {
  const [r] = price([plain()], [qtyPromo(15)]);
  assert.deepEqual(pick(r), { card: 30358, cash: 21250, promo: 'promo-qty' });
  assert.equal(r.unit_price_original, 35715);
});

test('sin promos: la línea queda igual', () => {
  const it = plain();
  assert.equal(price([it], [])[0], it);
});

test('promo automática sola (la de cantidad no llega al mínimo): la línea queda igual', () => {
  const it = auto20({ qty: 1 });
  assert.equal(price([it], [promo({}), qtyPromo(15)])[0], it);
});

test('automática 20 % + cantidad 15 %: gana la automática en los dos medios, sin acumular', () => {
  const it = auto20();
  const [r] = price([it], [promo({}), qtyPromo(15)]);
  // Antes el contado acumulaba: 20.000 × 0,85 = 17.000.
  assert.deepEqual(pick(r), { card: 28572, cash: 20000, promo: 'promo-auto' });
  // Ni el precio ni los datos de la promo que ya tenía la línea se tocan.
  assert.equal(r, it);
});

test('automática 10 % + cantidad 30 %: gana la de cantidad, calculada sobre la lista de cada medio', () => {
  const [r] = price([auto10()], [promo({ discount_value_minorista: 10 }), qtyPromo(30)]);
  // Tarjeta: 35.715 × 0,7 = 25.001. Contado: 25.000 × 0,7 = 17.500 (antes 22.500 × 0,7 = 15.750).
  assert.deepEqual(pick(r), { card: 25001, cash: 17500, promo: 'promo-qty' });
  assert.equal(r.unit_price_original, 35715);
});

test('carrito guardado antes del cambio (sin contado de lista): nunca acumula', () => {
  // Gana la automática: queda igual.
  const a = withoutCashOriginal(auto20());
  assert.equal(price([a], [promo({}), qtyPromo(15)])[0], a);
  // Gana la de cantidad en tarjeta: el contado no conoce su lista, así que conserva
  // la automática (22.500), con tope en el nuevo precio de tarjeta.
  const [b] = price([withoutCashOriginal(auto10())], [promo({ discount_value_minorista: 10 }), qtyPromo(30)]);
  assert.deepEqual(pick(b), { card: 25001, cash: 22500, promo: 'promo-qty' });
  const [c] = price([withoutCashOriginal(auto10())], [promo({ discount_value_minorista: 10 }), qtyPromo(80)]);
  assert.deepEqual(pick(c), { card: 7143, cash: 7143, promo: 'promo-qty' });
});

test('escalones «Lleva N»: no reciben la promo por cantidad', () => {
  const tier = (v) => line({ variant_id: v, qty: 1, unit_price: 30358, unit_price_cash: 21250, unit_price_original: 35715, source: 'tier', tierGroupId: 'g1', tierLabel: 'Lleva 2 — 15% OFF' });
  const items = [tier('a'), tier('b')];
  const out = price(items, [qtyPromo(15)]);
  assert.equal(out[0], items[0]);
  assert.equal(out[1], items[1]);
});

test('precio por talle: la promo por cantidad parte del precio del talle', () => {
  const [r] = price([plain({ size: 'XXL', unit_price: 39286.5, unit_price_cash: 27500 })], [qtyPromo(15)]);
  assert.deepEqual(pick(r), { card: 33394, cash: 23375, promo: 'promo-qty' });
});

test('mayorista (sin contado): curva y pack bajan con el % mayorista', () => {
  const curva = line({ qty: 5, unit_price: 11500, source: 'curva', curves: 1 });
  const pack = line({ variant_id: 'pk-S', qty: 3, unit_price: 4000, source: 'pack', packId: 'pk' });
  const [c, p] = price([curva, pack], [qtyPromo(15, { discount_value_minorista: 99 })], 'wholesale');
  assert.deepEqual(pick(c), { card: 9775, cash: undefined, promo: 'promo-qty' });
  assert.deepEqual(pick(p), { card: 3400, cash: undefined, promo: 'promo-qty' });
});

test('combo de outfit (precio ya rebajado, sin contado de lista): no acumula en contado', () => {
  const outfit = line({ unit_price: 30000, unit_price_cash: 21000, unit_price_original: 35715, outfit_id: 'o1' });
  // La de cantidad 15 % (30.358) no mejora el combo: queda igual.
  assert.equal(price([outfit], [qtyPromo(15)])[0], outfit);
});

test('buildSingleCartItem guarda el contado de lista sólo cuando la promo automática lo rebajó', () => {
  const base = { product: { id: PID, name: 'Remera' }, categories: ['Remeras'], variant: { id: 'v-l', size: 'L', color: 'Logo blanco', image_url: null }, fallbackImage: null };
  const conPromo = T.buildSingleCartItem({ ...base, finalPrice: 28572, finalCash: 20000, mainPrice: 35715, cashPrice: 25000, promo: promo({}) });
  assert.equal(conPromo.unit_price_cash, 20000);
  assert.equal(conPromo.unit_price_cash_original, 25000);
  const sinPromo = T.buildSingleCartItem({ ...base, finalPrice: 35715, finalCash: 25000, mainPrice: 35715, cashPrice: 25000, promo: null });
  assert.equal('unit_price_cash_original' in sinPromo, false);
  const sinContado = T.buildSingleCartItem({ ...base, finalPrice: 28572, finalCash: null, mainPrice: 35715, cashPrice: null, promo: promo({}) });
  assert.equal('unit_price_cash_original' in sinContado, false);
});
