// P1.2-B0: carrito de las plantillas (src/templates/shared/cartRows.ts).
//
// Corre con `npm run test:template-cart`. Verifica que las plantillas agrupen el
// carrito igual que Classic (groupCartItems) y que los grupos comerciales
// (escalón «Lleva N», curva, curva surtida, pack) no expongan ninguna acción para
// cambiar unidades sueltas: sólo se quitan enteros.
//
// El resultado de las promos por cantidad se arma con computeQuantityPromos y el
// MISMO mapeo de líneas que hooks/useCartPromos.ts (las líneas 'tier' afuera).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(repoRoot, 'node_modules/.cache/template-cart-test');
mkdirSync(CACHE_DIR, { recursive: true });
const outfile = resolve(CACHE_DIR, `cart-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `export * from './src/templates/shared/cartRows.ts'; export { cartLineKey, groupCartItems, priceCartItems } from './src/lib/cart.ts';
      export { sumCartSubtotals } from './src/lib/cartAmounts.ts';
      export { computeQuantityPromos } from './src/lib/promotions.ts';`,
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
});
const { buildCartRows, cartTotals, unitsLabel, cartLineKey, groupCartItems, priceCartItems, sumCartSubtotals, computeQuantityPromos } = await import(
  pathToFileURL(outfile).href
);

// ── Carrito de prueba ─────────────────────────────────────────────────────────
const base = { name: 'Remera', image_url: null, categories: ['Remeras'] };
const suelto = { ...base, product_id: 'p-suelto', variant_id: 'v-s1', size: 'M', color: 'Negro', unit_price: 10000, unit_price_cash: 9000, qty: 2 };
const tier = (group, units, variant, size, color, qty = 1) => ({
  ...base,
  product_id: 'p-tier',
  variant_id: variant,
  size,
  color,
  unit_price: units === 2 ? 8500 : 8000,
  unit_price_original: 10000,
  unit_price_cash: units === 2 ? 7650 : 7200,
  qty,
  source: 'tier',
  tierGroupId: group,
  tierLabel: units === 2 ? 'Lleva 2 — 15% OFF' : 'Lleva 3 — 20% OFF',
});
const lleva2 = [tier('g2', 2, 'v-t1', 'M', 'Negro'), tier('g2', 2, 'v-t2', 'L', 'Rojo')];
// «Lleva 3» con dos unidades de la misma variante: comparten línea (qty 2) dentro del grupo.
const lleva3 = [tier('g3', 3, 'v-t1', 'M', 'Negro', 2), tier('g3', 3, 'v-t3', 'S', 'Blanco')];
const curva = ['S', 'M', 'L'].map((size, i) => ({
  ...base, product_id: 'p-curva', variant_id: `v-c${i}`, size, color: 'Negro', unit_price: 5000, qty: 1, source: 'curva', curves: 1,
}));
const pack = ['S', 'M'].map((size, i) => ({
  ...base, product_id: 'p-pack', variant_id: `v-p${i}`, size, color: 'Azul', unit_price: 4000, qty: 3, source: 'pack', packId: 'pk1', packLabel: 'Pack x6', packs: 1,
}));
const surtida = { ...base, product_id: 'p-surt', variant_id: null, size: null, color: null, unit_price: 4500, qty: 6, source: 'curva_surtida', curves: 1, lineId: 'l1' };
const ITEMS = [suelto, ...lleva2, ...lleva3, ...curva, ...pack, surtida];

const qtyPromo = {
  id: 'q1', company_id: 'c', name: 'Llevá 2', description: null, promo_type: 'quantity', min_quantity: 2,
  discount_type: 'percentage', discount_value_minorista: 10, discount_value_mayorista: 10, channel: 'both', scope: 'products',
  starts_at: null, ends_at: null, stackable_with_coupons: true, min_purchase_amount: null, max_discount_amount: null,
  badge_text: null, badge_color: null, show_countdown: null, banner_image_url: null, is_active: true,
  // Alcanza al suelto y también al producto de los escalones: el escalón NO debe sumarse a esta promo.
  ecommerce_promotion_items: [{ item_type: 'product', item_id: 'p-suelto' }, { item_type: 'product', item_id: 'p-tier' }],
};

/** Mismo mapeo que hooks/useCartPromos.ts. */
function promos(items, list = [qtyPromo]) {
  const lines = items
    .filter((it) => it.source !== 'tier')
    .map((it) => ({
      key: cartLineKey(it),
      productId: it.product_id,
      categories: it.categories ?? [],
      color: it.color ?? null,
      qty: it.qty,
      unitPriceBase: it.unit_price,
      unitPriceOriginal: it.unit_price_original ?? it.unit_price,
    }));
  const byLine = computeQuantityPromos(lines, list, 'retail');
  const unitFinal = (it) => {
    const r = byLine.get(cartLineKey(it));
    return r?.active ? r.unitPriceFinal : it.unit_price;
  };
  const adjustedSubtotal = items.reduce((s, it) => s + unitFinal(it) * it.qty, 0);
  return { byLine, adjustedSubtotal };
}

/** Carrito en memoria con las MISMAS operaciones que CartContext. */
function memoryCart(initial) {
  let items = initial.map((i) => ({ ...i }));
  const calls = [];
  return {
    get items() { return items; },
    calls,
    updateQty(key, qty) {
      calls.push(['updateQty', key, qty]);
      items = items.map((p) => (cartLineKey(p) === key ? { ...p, qty: Math.max(0, qty) } : p)).filter((p) => p.qty > 0);
    },
    removeItem(key) {
      calls.push(['removeItem', key]);
      items = items.filter((p) => cartLineKey(p) !== key);
    },
  };
}

const ALL = { priceDisplay: 'all', cashLabel: 'en efectivo', priceEmphasis: 'cash', freeShippingFrom: 100000 };
const CARD = { priceDisplay: 'card', cashLabel: 'en efectivo', freeShippingFrom: 0 };

// Igual que useCartView: los pricedItems de useCartCoupon (priceCartItems).
const rowsFor = (cart, cfg = ALL) => {
  const { byLine } = promos(cart.items);
  return buildCartRows(cart.items, priceCartItems(cart.items, byLine, 'retail'), byLine, cfg, cart);
};
/** Subtotales como useCartCoupon (sin cupón). */
const sums = (items) => ({ ...sumCartSubtotals(priceCartItems(items, promos(items).byLine, 'retail')), discountCash: 0, discountCard: 0 });

// ── Agrupación ────────────────────────────────────────────────────────────────
test('agrupa igual que groupCartItems de Classic (mismas filas, unidades y claves)', () => {
  const cart = memoryCart(ITEMS);
  const rows = rowsFor(cart);
  const classic = groupCartItems(cart.items);
  assert.deepEqual(
    rows.map((r) => [r.key, r.units, r.detail]),
    classic.map((r) => [r.key, r.units, r.detail]),
  );
  assert.deepEqual(rows.map((r) => r.group), [null, 'curva_surtida', 'curva', 'tier', 'tier', 'pack']);
});

test('«Lleva 2» y «Lleva 3» son dos grupos distintos con sus variantes', () => {
  const rows = rowsFor(memoryCart(ITEMS)).filter((r) => r.group === 'tier');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].units, 2);
  assert.equal(rows[0].detail, 'Lleva 2 — 15% OFF — M/Negro · L/Rojo');
  assert.equal(rows[1].units, 3);
  assert.equal(rows[1].detail, 'Lleva 3 — 20% OFF — M/Negro ×2 · S/Blanco');
});

// ── Protección de unidades ────────────────────────────────────────────────────
test('ningún grupo expone controles de cantidad; sólo el suelto', () => {
  for (const row of rowsFor(memoryCart(ITEMS))) {
    if (row.group) {
      assert.equal(row.qty, null, `${row.group} no debe ser editable`);
      assert.equal(row.item, null, `${row.group} no expone una línea suelta`);
      assert.equal(row.unit, null);
    } else {
      assert.ok(row.qty, 'el suelto conserva sus controles');
    }
  }
});

test('el objeto de la vista no expone updateQty ni removeItem del carrito', async () => {
  const { readFileSync } = await import('node:fs');
  const ui = readFileSync(resolve(repoRoot, 'src/templates/shared/ui.tsx'), 'utf8');
  const ret = ui.slice(ui.indexOf('export function useCartView'));
  const returned = ret.slice(ret.indexOf('return {'), ret.indexOf('};', ret.indexOf('return {')));
  assert.doesNotMatch(returned, /updateQty|removeItem|\.\.\.cart\s*[,}]|[{,]\s*items\s*[,}]/);
  // Las plantillas no llaman al carrito directo.
  for (const t of ['atelier/Atelier.tsx', 'distrito/Distrito.tsx', 'momentum/Momentum.tsx']) {
    const src = readFileSync(resolve(repoRoot, 'src/templates', t), 'utf8');
    assert.doesNotMatch(src, /useCart\(\)|updateQty|removeItem/, t);
  }
});

test('quitar un grupo quita TODAS sus líneas y nada más (como el tacho de Classic)', () => {
  for (const kind of ['tier', 'curva', 'pack', 'curva_surtida']) {
    const cart = memoryCart(ITEMS);
    const before = groupCartItems(cart.items);
    const target = rowsFor(cart).find((r) => r.group === kind);
    const classicRow = before.find((r) => r.key === target.key);
    target.remove();
    const after = groupCartItems(cart.items);
    assert.equal(after.length, before.length - 1, kind);
    assert.ok(!after.some((r) => r.key === target.key), kind);
    const goneUnits = before.reduce((s, r) => s + r.units, 0) - after.reduce((s, r) => s + r.units, 0);
    assert.equal(goneUnits, classicRow.units, `${kind}: se van las ${classicRow.units} unidades`);
    assert.deepEqual(cart.calls.map((c) => c[1]), classicRow.removeKeys);
  }
});

test('quitar el primer «Lleva 3» no toca el «Lleva 2» que comparte variante', () => {
  const cart = memoryCart(ITEMS);
  rowsFor(cart).find((r) => r.group === 'tier' && r.units === 3).remove();
  const g2 = groupCartItems(cart.items).find((r) => r.source === 'tier');
  assert.equal(g2.units, 2);
  assert.equal(g2.detail, 'Lleva 2 — 15% OFF — M/Negro · L/Rojo');
});

test('el suelto suma y resta sólo su propia línea', () => {
  const cart = memoryCart(ITEMS);
  const row = rowsFor(cart).find((r) => !r.group);
  row.qty.inc();
  assert.deepEqual(cart.calls, [['updateQty', cartLineKey(suelto), 3]]);
  // Cada acción usa la cantidad que muestra la fila (igual que Classic): se vuelve a armar.
  rowsFor(cart).find((r) => !r.group).qty.dec();
  rowsFor(cart).find((r) => !r.group).qty.dec();
  assert.equal(rowsFor(cart).find((r) => !r.group).units, 1);
  // Ningún grupo cambió.
  assert.deepEqual(
    groupCartItems(cart.items).filter((r) => r.source !== 'suelto').map((r) => [r.key, r.units]),
    groupCartItems(ITEMS).filter((r) => r.source !== 'suelto').map((r) => [r.key, r.units]),
  );
});

test('un producto suelto agregado después no se mete en un grupo', () => {
  const extra = { ...suelto, product_id: 'p-tier', variant_id: 'v-t1', size: 'M', color: 'Negro', qty: 1 };
  const cart = memoryCart([...ITEMS, extra]);
  const rows = rowsFor(cart);
  const tiers = rows.filter((r) => r.group === 'tier');
  assert.deepEqual(tiers.map((r) => r.units), [2, 3]);
  assert.equal(rows.filter((r) => !r.group).length, 2);
});

// ── Precios y totales ─────────────────────────────────────────────────────────
test('el escalón no se suma a la promo por cantidad (tiene su precio propio)', () => {
  const { byLine } = promos(ITEMS);
  for (const it of [...lleva2, ...lleva3]) assert.equal(byLine.get(cartLineKey(it)), undefined);
  assert.equal(byLine.get(cartLineKey(suelto)).active, true);
});

test('precios por fila: los mismos que cobra el checkout (FIN0-B)', () => {
  const rows = rowsFor(memoryCart(ITEMS));
  const [s, surt, cur, t2, t3, pk] = rows;
  // Suelto con promo por cantidad activa (10%): contado y tarjeta con la promo
  // (priceCartItems: contado 9000 → 8100, tarjeta 10000 → 9000); tachado el
  // contado de antes de la promo (misma base que el número grande).
  assert.deepEqual(s.price, { big: 16200, small: 18000, smallLabel: 'con tarjeta', strike: 18000, isCash: true });
  assert.equal(s.unit, 8100);
  // Escalones: contado grande, tarjeta abajo, tachado el de lista (sin cambios).
  assert.deepEqual(t2.price, { big: 15300, small: 17000, smallLabel: 'con tarjeta', strike: 20000, isCash: true });
  assert.deepEqual(t3.price, { big: 21600, small: 24000, smallLabel: 'con tarjeta', strike: 30000, isCash: true });
  // Curva, pack y surtida: total de la fila.
  assert.equal(cur.price.big, 15000);
  assert.equal(pk.price.big, 24000);
  assert.equal(surt.price.big, 27000);
});

test('subtotal: el mismo del checkout y la misma base para el envío gratis', () => {
  const { adjustedSubtotal } = promos(ITEMS);
  // Tarjeta: 18000 (suelto con promo) + 17000 + 24000 + 15000 + 24000 + 27000.
  assert.equal(adjustedSubtotal, 125000);
  assert.equal(sums(ITEMS).cardSubtotal, adjustedSubtotal);
  // Contado como el checkout: el del suelto YA con la promo por cantidad (16200).
  const cash = 16200 + 15300 + 21600 + 15000 + 24000 + 27000;
  const t = cartTotals(sums(ITEMS), ALL);
  assert.deepEqual(t.subtotal, { big: cash, small: 125000, smallLabel: 'con tarjeta', strike: null, isCash: true });
  assert.equal(t.couponCode, null);
  assert.equal(t.freeShippingLeft, 0);
  assert.equal(t.freeShippingPct, 100);
  const c = cartTotals(sums(ITEMS), CARD);
  assert.deepEqual(c.subtotal, { big: 125000, small: null, smallLabel: '', strike: null, isCash: false });
  assert.equal(c.freeShippingLeft, null);
});

test('con precio de tarjeta, la suma de las filas da el subtotal', () => {
  const cart = memoryCart(ITEMS);
  const rows = rowsFor(cart, CARD);
  assert.equal(rows.reduce((s, r) => s + r.price.big, 0), cartTotals(sums(cart.items), CARD).subtotal.big);
});

test('con contado protagonista, la suma de las filas da el subtotal (FIN0-B)', () => {
  const cart = memoryCart(ITEMS);
  const rows = rowsFor(cart, ALL);
  assert.equal(rows.reduce((s, r) => s + r.price.big, 0), cartTotals(sums(cart.items), ALL).subtotal.big);
  assert.equal(rows.reduce((s, r) => s + (r.price.small ?? r.price.big), 0), cartTotals(sums(cart.items), ALL).subtotal.small);
});

test('carrito persistido: las filas salen iguales después de serializar (recarga)', () => {
  const reloaded = JSON.parse(JSON.stringify(ITEMS));
  const strip = (rows) => rows.map(({ qty, remove, ...r }) => ({ ...r, qty: Boolean(qty) }));
  assert.deepEqual(strip(rowsFor(memoryCart(reloaded))), strip(rowsFor(memoryCart(ITEMS))));
});

test('unitsLabel', () => {
  assert.equal(unitsLabel(1), '1 unidad');
  assert.equal(unitsLabel(3), '3 unidades');
});
