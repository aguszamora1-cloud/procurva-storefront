// P1.2-FIN0-B: importes del carrito (src/lib/cartAmounts.ts) contra lo que cobra
// el checkout.
//
// Corre con `npm run test:cart-amounts`. El checkout suma los `pricedItems`
// (priceCartItems) por medio de pago y evalúa el envío gratis contra ese
// subtotal sin cupón: acá se arma lo mismo y se compara con las filas, el
// subtotal y el envío gratis que muestra el carrito.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(repoRoot, 'node_modules/.cache/cart-amounts-test');
mkdirSync(CACHE_DIR, { recursive: true });
const outfile = resolve(CACHE_DIR, `amounts-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `export * from './src/lib/cartAmounts.ts';
      export { cartTotals } from './src/templates/shared/cartRows.ts';
      export { cartLineKey, priceCartItems } from './src/lib/cart.ts';
      export { computeQuantityPromos } from './src/lib/promotions.ts';
      export { evalFreeShipping } from './src/lib/shipping.ts';`,
    resolveDir: repoRoot,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  packages: 'external',
  alias: { '@': resolve(repoRoot, 'src') },
  // lib/shipping importa el cliente de Supabase: URL local inexistente, nunca se usa.
  define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'http://127.0.0.1:9', VITE_SUPABASE_ANON_KEY: 'prueba' }) },
  logLevel: 'silent',
});
const {
  cartAmountRows, cartSubtotalAmount, freeShippingBase, sumCartSubtotals, cartTotals,
  cartLineKey, priceCartItems, computeQuantityPromos, evalFreeShipping,
} = await import(pathToFileURL(outfile).href);

// ── Helpers: lo mismo que hooks/useCartPromos + hooks/useCartCoupon ───────────
const promo = (over) => ({
  id: 'q', company_id: 'c', name: 'Llevá 2', description: null, promo_type: 'quantity', min_quantity: 2,
  discount_type: 'percentage', discount_value_minorista: 15, discount_value_mayorista: 15, channel: 'both', scope: 'all',
  starts_at: null, ends_at: null, stackable_with_coupons: true, min_purchase_amount: null, max_discount_amount: null,
  badge_text: null, badge_color: null, show_countdown: null, banner_image_url: null, is_active: true,
  ecommerce_promotion_items: [],
  ...over,
});
function view(items, promos, storeType = 'retail') {
  const lines = items
    .filter((it) => it.source !== 'tier')
    .map((it) => ({
      key: cartLineKey(it), productId: it.product_id, categories: it.categories ?? [], color: it.color ?? null,
      qty: it.qty, unitPriceBase: it.unit_price, unitPriceOriginal: it.unit_price_original ?? it.unit_price,
    }));
  const byLine = computeQuantityPromos(lines, promos, storeType);
  const priced = priceCartItems(items, byLine, storeType);
  return { byLine, priced, sums: { ...sumCartSubtotals(priced), discountCash: 0, discountCard: 0 } };
}
/** Lo que suma el checkout (Checkout.tsx: cardSubtotal / cashSubtotal). */
const checkout = (priced) => ({
  card: priced.reduce((s, i) => s + i.unit_price * i.qty, 0),
  cash: priced.reduce((s, i) => s + (typeof i.unit_price_cash === 'number' ? i.unit_price_cash : i.unit_price) * i.qty, 0),
});
const ALL = { priceDisplay: 'all', cashLabel: 'en efectivo', priceEmphasis: 'cash' };
const CARD_FIRST = { ...ALL, priceEmphasis: 'card' };
const CONTADO = { priceDisplay: 'contado', cashLabel: 'en efectivo' };
const CARD = { priceDisplay: 'card', cashLabel: 'en efectivo' };

const base = { name: 'Remera', image_url: null, categories: ['Remeras'], size: 'M', color: 'Negro' };
// Línea con promo automática 20% (como la arma la ficha): tarjeta 28572 → 22858;
// contado 20000 (el de transferencia, menor que el de tarjeta con la promo).
const auto20 = (over) => ({
  ...base, product_id: 'p1', variant_id: 'v1', qty: 2, unit_price: 22858, unit_price_original: 28572, unit_price_cash: 20000,
  promo_id: 'auto', promo_name: 'Auto 20', promo_stackable: true, ...over,
});
const suelto = (over) => ({ ...base, product_id: 'p2', variant_id: 'v2', qty: 2, unit_price: 35715, unit_price_cash: 25000, ...over });

// ── Casos de FIN0 ─────────────────────────────────────────────────────────────
test('caso 01/03: la promo por cantidad baja el contado en el carrito igual que en el checkout', () => {
  const items = [suelto()];
  const { byLine, priced, sums } = view(items, [promo()]);
  const co = checkout(priced);
  assert.equal(co.cash, 42500); // 25000 × 0,85 × 2
  const sub = cartSubtotalAmount(sums, ALL);
  assert.equal(sub.big, co.cash);
  assert.equal(sub.small, co.card);
  const [row] = cartAmountRows(items, priced, byLine, ALL);
  assert.deepEqual(row.price, { big: 42500, small: co.card, smallLabel: 'con tarjeta', strike: 50000, isCash: true });
  assert.equal(row.qtyPromo, true);
});

test('caso 06: automática 20% + cantidad 15%: gana la automática, sin tachado ni descuento nuevo', () => {
  const items = [auto20()];
  const { byLine, priced, sums } = view(items, [promo()]);
  assert.equal(byLine.get(cartLineKey(items[0])).active, true);
  assert.deepEqual(priced, items);
  const [row] = cartAmountRows(items, priced, byLine, ALL);
  assert.deepEqual(row.price, { big: 40000, small: 45716, smallLabel: 'con tarjeta', strike: null, isCash: true });
  assert.equal(row.qtyPromo, false);
  assert.equal(cartSubtotalAmount(sums, ALL).big, checkout(priced).cash);
});

test('caso 17: línea nueva con el contado de lista, gana la de cantidad en contado', () => {
  const items = [auto20({ unit_price: 25715, unit_price_original: 28572, unit_price_cash: 22500, unit_price_cash_original: 25000 })];
  const { byLine, priced, sums } = view(items, [promo({ discount_value_minorista: 30 })]);
  const co = checkout(priced);
  assert.equal(co.cash, 35000); // 25000 × 0,70 × 2
  const [row] = cartAmountRows(items, priced, byLine, ALL);
  assert.equal(row.price.big, 35000);
  assert.equal(row.price.strike, 45000); // contado de antes: 22500 × 2
  assert.equal(cartSubtotalAmount(sums, ALL).big, co.cash);
});

test('caso 07: carrito viejo sin contado de lista: el resguardo de FIN0-A, igual en carrito y checkout', () => {
  const items = [auto20({ unit_price: 25715, unit_price_original: 28572, unit_price_cash: 22500 })];
  const { byLine, priced, sums } = view(items, [promo({ discount_value_minorista: 30 })]);
  const co = checkout(priced);
  // Sin base de contado: min(contado, tarjeta con la promo) = min(22500, 20000).
  assert.equal(priced[0].unit_price_cash, 20000);
  assert.equal(cartSubtotalAmount(sums, ALL).big, co.cash);
  const [row] = cartAmountRows(items, priced, byLine, ALL);
  assert.equal(row.price.big, co.cash);
});

test('caso 08: precio por talle: cada línea con su precio, suma igual al checkout', () => {
  const items = [suelto(), suelto({ variant_id: 'v3', size: 'XXL', unit_price: 39286, unit_price_cash: 27500 })];
  const { byLine, priced, sums } = view(items, [promo()]);
  const rows = cartAmountRows(items, priced, byLine, ALL);
  assert.deepEqual(rows.map((r) => r.price.big), [42500, 46750]);
  assert.equal(rows.reduce((s, r) => s + r.price.big, 0), cartSubtotalAmount(sums, ALL).big);
  assert.equal(cartSubtotalAmount(sums, ALL).big, checkout(priced).cash);
});

test('caso 09: cupón: subtotal con el cupón y el de antes tachado; sin cupón, sin tachado', () => {
  const sums = { cashSubtotal: 145000, cardSubtotal: 207148, discountCash: 14500, discountCard: 20715 };
  assert.deepEqual(cartSubtotalAmount(sums, ALL), {
    big: 130500, small: 186433, smallLabel: 'con tarjeta', isCash: true, strike: 145000, couponActive: true,
  });
  const none = cartSubtotalAmount({ ...sums, discountCash: 0, discountCard: 0 }, ALL);
  assert.equal(none.strike, null);
  assert.equal(none.couponActive, false);
  // Las plantillas muestran el código sólo si el cupón bajó el subtotal.
  assert.equal(cartTotals(sums, { ...ALL, freeShippingFrom: 0 }, 'PRUEBA10').couponCode, 'PRUEBA10');
  assert.equal(cartTotals({ ...sums, discountCash: 0, discountCard: 0 }, { ...ALL, freeShippingFrom: 0 }, 'PRUEBA10').couponCode, null);
});

test('cupón que no aplica (no acumulable): igual al checkout, sin tachado', () => {
  const sums = { cashSubtotal: 40000, cardSubtotal: 45716, discountCash: 0, discountCard: 0 };
  const sub = cartSubtotalAmount(sums, ALL);
  assert.equal(sub.big, 40000);
  assert.equal(sub.strike, null);
});

// ── Envío gratis ──────────────────────────────────────────────────────────────
test('envío gratis: umbrales alrededor de $145.000 (contado del caso 01)', () => {
  const sums = { cashSubtotal: 145000, cardSubtotal: 207148, discountCash: 0, discountCard: 0 };
  for (const [from, reached, left] of [[144999, true, 0], [145000, true, 0], [145001, false, 1], [150000, false, 5000]]) {
    const t = cartTotals(sums, { ...ALL, freeShippingFrom: from });
    // El checkout en contado (el medio más barato) con el mismo subtotal sin cupón.
    const co = evalFreeShipping(from, sums.cashSubtotal);
    assert.equal(t.freeShippingLeft === 0, reached, `umbral ${from}`);
    assert.equal(co.reached, reached, `checkout ${from}`);
    assert.equal(t.freeShippingLeft, left, `umbral ${from}`);
  }
});

test('envío gratis: el cupón no cuenta (como en el checkout)', () => {
  const sums = { cashSubtotal: 145000, cardSubtotal: 207148, discountCash: 14500, discountCard: 20715 };
  assert.equal(freeShippingBase(sums), 145000);
  assert.equal(cartTotals(sums, { ...ALL, freeShippingFrom: 145000 }).freeShippingLeft, 0);
});

test('envío gratis: si el carrito dice gratis, el checkout lo da con cualquier medio de pago', () => {
  const sums = { cashSubtotal: 100000, cardSubtotal: 130000, discountCash: 0, discountCard: 0 };
  for (const cfg of [ALL, CARD_FIRST, CONTADO, CARD]) {
    for (const from of [99999, 100000, 100001, 129999, 130000, 130001]) {
      const cartSaysFree = cartTotals(sums, { ...cfg, freeShippingFrom: from }).freeShippingLeft === 0;
      const cashFree = evalFreeShipping(from, sums.cashSubtotal).reached;
      const cardFree = evalFreeShipping(from, sums.cardSubtotal).reached;
      if (cartSaysFree) assert.ok(cashFree && cardFree, `${cfg.priceDisplay} ${from}`);
      assert.equal(cartSaysFree, cashFree, `${cfg.priceDisplay} ${from}`);
    }
  }
});

// ── Presentación ──────────────────────────────────────────────────────────────
test('con la tarjeta grande, el tachado de la promo por cantidad es de tarjeta', () => {
  const items = [suelto()];
  const { byLine, priced } = view(items, [promo()]);
  const [row] = cartAmountRows(items, priced, byLine, CARD_FIRST);
  assert.equal(row.price.big, priced[0].unit_price * 2);
  assert.equal(row.price.strike, 35715 * 2);
  assert.equal(row.price.small, 42500);
});

test('sólo contado: sin segunda línea; sólo tarjeta: tarjeta sin contado', () => {
  const items = [suelto()];
  const { byLine, priced } = view(items, [promo()]);
  const [c] = cartAmountRows(items, priced, byLine, CONTADO);
  assert.deepEqual([c.price.big, c.price.small, c.price.strike], [42500, null, 50000]);
  const [t] = cartAmountRows(items, priced, byLine, CARD);
  assert.deepEqual([t.price.big, t.price.small, t.price.strike, t.price.isCash], [priced[0].unit_price * 2, null, 35715 * 2, false]);
});

test('sin promos: filas y subtotal sin cambios ni tachados', () => {
  const items = [suelto(), auto20()];
  const { byLine, priced, sums } = view(items, []);
  const rows = cartAmountRows(items, priced, byLine, ALL);
  assert.deepEqual(rows.map((r) => r.price.strike), [null, null]);
  assert.equal(cartSubtotalAmount(sums, ALL).big, 50000 + 40000);
});

// ── Grupos que no cambian de precio ───────────────────────────────────────────
test('«Lleva 2» / «Lleva 3»: precio propio y tachado de lista, sin la promo por cantidad', () => {
  const tier = (g, price, cash, qty = 1, v = 'vt') => ({
    ...base, product_id: 'pt', variant_id: v, qty, unit_price: price, unit_price_original: 10000, unit_price_cash: cash,
    source: 'tier', tierGroupId: g, tierLabel: 'Lleva N',
  });
  const items = [tier('g2', 8500, 7650, 2), tier('g3', 8000, 7200, 2, 'vt1'), tier('g3', 8000, 7200, 1, 'vt2')];
  const { byLine, priced, sums } = view(items, [promo({ scope: 'all' })]);
  assert.deepEqual(priced, items);
  const rows = cartAmountRows(items, priced, byLine, ALL);
  assert.deepEqual(rows.map((r) => [r.price.big, r.price.small, r.price.strike]), [[15300, 17000, 20000], [21600, 24000, 30000]]);
  assert.equal(cartSubtotalAmount(sums, ALL).big, 15300 + 21600);
});

test('mayorista: curva, curva surtida y pack sin promos quedan igual', () => {
  const curva = ['S', 'M', 'L'].map((size, i) => ({ ...base, size, product_id: 'pc', variant_id: `c${i}`, unit_price: 5000, qty: 1, source: 'curva', curves: 1 }));
  const pack = ['S', 'M'].map((size, i) => ({ ...base, size, product_id: 'pp', variant_id: `p${i}`, unit_price: 4000, qty: 3, source: 'pack', packId: 'k', packLabel: 'Pack x6', packs: 1 }));
  const surtida = { ...base, product_id: 'ps', variant_id: null, size: null, color: null, unit_price: 4500, qty: 6, source: 'curva_surtida', curves: 1, lineId: 'l1' };
  const items = [...curva, ...pack, surtida];
  const { byLine, priced, sums } = view(items, [], 'wholesale');
  const rows = cartAmountRows(items, priced, byLine, ALL);
  assert.deepEqual(rows.map((r) => [r.row.source, r.price.big, r.price.strike]), [['curva_surtida', 27000, null], ['curva', 15000, null], ['pack', 24000, null]]);
  assert.equal(cartSubtotalAmount(sums, ALL).big, 66000);
});

test('mayorista con promo por cantidad: la fila suma lo que cobra el checkout', () => {
  const curva = ['S', 'M', 'L'].map((size, i) => ({ ...base, size, product_id: 'pc', variant_id: `c${i}`, unit_price: size === 'L' ? 6000 : 5000, qty: 1, source: 'curva', curves: 1 }));
  const { byLine, priced } = view(curva, [promo()], 'wholesale');
  const [row] = cartAmountRows(curva, priced, byLine, ALL);
  assert.equal(row.price.big, checkout(priced).card);
  assert.equal(row.price.strike, 16000);
});

// ── Coherencia general ────────────────────────────────────────────────────────
test('carritos al azar: filas, subtotal y checkout dan el mismo número', () => {
  let seed = 7;
  const rnd = (n) => ((seed = (seed * 1103515245 + 12345) % 2147483648) % n);
  for (let k = 0; k < 400; k++) {
    const items = [];
    for (let i = 0, n = 1 + rnd(4); i < n; i++) {
      const list = 10000 + rnd(40) * 1000;
      const cashList = Math.round(list * (0.6 + rnd(4) / 10));
      const withAuto = rnd(2) === 1;
      const autoCard = Math.round(list * 0.8);
      const it = {
        ...base, product_id: `p${i}`, variant_id: `v${i}`, qty: 1 + rnd(3),
        unit_price: withAuto ? autoCard : list,
        unit_price_cash: withAuto ? Math.min(cashList, autoCard) : cashList,
        ...(withAuto ? { unit_price_original: list, promo_id: 'a', promo_name: 'A', promo_stackable: true } : {}),
        ...(withAuto && rnd(2) === 1 ? { unit_price_cash_original: cashList } : {}),
      };
      items.push(it);
    }
    const promos = rnd(3) === 0 ? [] : [promo({ discount_value_minorista: 5 + rnd(40) })];
    for (const cfg of [ALL, CARD_FIRST, CONTADO, CARD]) {
      const { byLine, priced, sums } = view(items, promos);
      const co = checkout(priced);
      const rows = cartAmountRows(items, priced, byLine, cfg);
      const sub = cartSubtotalAmount(sums, cfg);
      assert.equal(rows.reduce((s, r) => s + r.price.big, 0), sub.big, `filas = subtotal (${k})`);
      assert.ok([co.cash, co.card].includes(sub.big), `subtotal = checkout (${k})`);
      for (const r of rows) if (r.price.strike != null) assert.ok(r.price.strike > r.price.big);
      assert.equal(freeShippingBase(sums), Math.min(co.cash, co.card));
    }
  }
});
