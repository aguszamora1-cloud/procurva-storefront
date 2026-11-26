// P1.2-B1: compra por escalones «Lleva N» y agregado común (src/lib/tierPurchase.ts).
//
// Corre con `npm run test:tier-purchase`. Los valores esperados salen de la
// caracterización de la ficha de Classic ANTES de extraer la lógica (Rosario
// Sportwear: tarjeta $35.715, contado $25.000, escalones 2 → 15% y 3 → 20%).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(repoRoot, 'node_modules/.cache/tier-purchase-test');
mkdirSync(CACHE_DIR, { recursive: true });
const outfile = resolve(CACHE_DIR, `tier-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `export * from './src/lib/tierPurchase.ts';
      export { getPriceInfo } from './src/lib/utils.ts';
      export { tierUnitPrices, resolveTierConfigForProduct, parseCategoryTierRow } from './src/lib/categoryTiers.ts';`,
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

// ── Producto de prueba (precios reales de Rosario) ────────────────────────────
const COLORS = ['Logo rojo', 'Full negro'];
const SIZES = ['S', 'M', 'XL', 'XXL'];
const variants = COLORS.flatMap((color) =>
  SIZES.map((size) => ({ id: `v-${color}-${size}`, product_id: 'p1', size, color, stock: 5, image_url: null })),
);
const product = {
  id: 'p1',
  name: 'REMERA JORDAN BÁSICA',
  categories: ['Remeras'],
  retail_price: 25000,
  retail_price_card: 35715,
  retail_price_transfer: 25000,
  compare_at_price: null,
  product_variants: variants,
};
const space = (vs = variants) => ({ variants: vs, colors: COLORS, sizes: SIZES });
const config = { categoryName: 'Remeras', variantPerUnit: true, tiers: [{ minQuantity: 2, discountPct: 15, isFeatured: true }, { minQuantity: 3, discountPct: 20, isFeatured: false }] };

/** Mismo cálculo que el hook (sin promo automática: priceFor devuelve el mismo precio). */
const pricesFor = (p) => (size, pct) => {
  const info = T.getPriceInfo(p, size);
  return { ...T.tierUnitPrices(info.mainPrice, info.cashPrice, pct), listPrice: info.mainPrice };
};

test('tarjetas: «Lleva 1» + escalones de la categoría; sin config, ninguna', () => {
  assert.deepEqual(T.tierCardsFor(config), [
    { units: 1, discountPct: 0, isFeatured: false },
    { units: 2, discountPct: 15, isFeatured: true },
    { units: 3, discountPct: 20, isFeatured: false },
  ]);
  assert.deepEqual(T.tierCardsFor(null), []);
  assert.deepEqual(T.selectedTierCard(T.tierCardsFor(config), 3), { units: 3, discountPct: 20, isFeatured: false });
  assert.deepEqual(T.selectedTierCard(T.tierCardsFor(config), 7), { units: 1, discountPct: 0, isFeatured: false });
});

test('opciones del selector: los mismos números que mostraba Classic', () => {
  const opts = T.buildTierOptions({ cards: T.tierCardsFor(config), activeUnits: 2, finalPrice: 35715, finalCash: 25000, layout: 'cards' });
  // Classic: «Lleva 2 15% OFF $30.358 tarjeta c/u Ahorrás $7.500 en total $21.250 c/u».
  assert.deepEqual(opts.map((o) => [o.units, o.unitPrice, o.cardPrice, o.savings, o.strikePrice, o.isActive]), [
    [1, 25000, 35715, 0, null, false],
    [2, 21250, 30358, 7500, null, true],
    [3, 20000, 28572, 15000, null, false],
  ]);
  // En lista, el tachado del escalón es el precio del «Lleva 1».
  const list = T.buildTierOptions({ cards: T.tierCardsFor(config), activeUnits: 1, finalPrice: 35715, finalCash: 25000, layout: 'list' });
  assert.deepEqual(list.map((o) => o.strikePrice), [null, 25000, 25000]);
});

test('sincronía de las unidades al cambiar de escalón', () => {
  const sel = (size, color) => ({ size, color });
  assert.deepEqual(T.syncTierSelections([], 3, 'M', 'Logo rojo'), [sel('M', 'Logo rojo'), sel('M', 'Logo rojo'), sel('M', 'Logo rojo')]);
  const prev = [sel('S', 'Full negro'), sel('M', 'Logo rojo'), sel('XL', 'Logo rojo')];
  assert.deepEqual(T.syncTierSelections(prev, 2, 'M', 'Logo rojo'), prev.slice(0, 2));
  assert.equal(T.syncTierSelections(prev, 3, 'M', 'Logo rojo'), prev, 'mismo largo: devuelve el mismo array');
  assert.deepEqual(T.syncTierSelections(prev, 1, null, null), []);
  const empty = [];
  assert.equal(T.syncTierSelections(empty, 1, null, null), empty);
});

test('variantes compartidas o por unidad', () => {
  const per = [{ size: 'S', color: 'Full negro' }, { size: 'M', color: 'Logo rojo' }];
  assert.equal(T.effectiveSelections({ inTierMode: true, perUnitOpen: true, tierSelections: per, tierUnits: 2, selectedSize: 'XL', selectedColor: 'Logo rojo' }), per);
  assert.deepEqual(T.effectiveSelections({ inTierMode: true, perUnitOpen: false, tierSelections: per, tierUnits: 2, selectedSize: 'XL', selectedColor: 'Logo rojo' }), [
    { size: 'XL', color: 'Logo rojo' },
    { size: 'XL', color: 'Logo rojo' },
  ]);
  assert.deepEqual(T.effectiveSelections({ inTierMode: false, perUnitOpen: false, tierSelections: per, tierUnits: 1, selectedSize: 'XL', selectedColor: null }), []);
  assert.equal(T.tierVariantLabel(per), 'surtido');
  assert.equal(T.tierVariantLabel([{ size: 'M', color: 'Logo rojo' }, { size: 'M', color: 'Logo rojo' }]), 'Logo rojo · M');
  assert.equal(T.tierVariantLabel([]), null);
});

test('stock: variantes repetidas suman, faltantes invalidan', () => {
  const vs = variants.map((v) => (v.color === 'Full negro' && v.size === 'S' ? { ...v, stock: 2 } : v));
  const sel = (n, size, color) => Array.from({ length: n }, () => ({ size, color }));
  const valid = (selections, units, finalPrice = 35715) => T.isTierSelectionValid({ inTierMode: true, selections, tierUnits: units, finalPrice, space: space(vs) });
  assert.equal(valid([...sel(2, 'S', 'Full negro'), { size: 'M', color: 'Logo rojo' }], 3), true, 'dos iguales con stock 2');
  assert.equal(valid(sel(3, 'S', 'Full negro'), 3), false, 'tres iguales con stock 2');
  assert.equal(valid([{ size: null, color: 'Logo rojo' }, { size: 'M', color: 'Logo rojo' }], 2), false, 'unidad sin talle');
  assert.equal(valid(sel(2, 'M', 'Logo rojo'), 3), false, 'menos selecciones que unidades');
  assert.equal(valid(sel(2, 'M', 'Logo rojo'), 2, 0), false, 'sin precio');
  assert.equal(T.isTierSelectionValid({ inTierMode: false, selections: sel(2, 'M', 'Logo rojo'), tierUnits: 2, finalPrice: 35715, space: space(vs) }), false);
  const disabled = T.sizeDisabledForColor(space(vs.map((v) => (v.color === 'Logo rojo' && v.size === 'XL' ? { ...v, stock: 0 } : v))), 'Logo rojo');
  assert.equal(disabled('XL'), true);
  assert.equal(disabled('M'), false);
  // Unidad sin color elegido: el talle vale si tiene stock en ALGÚN color.
  const onlyBlack = space(variants.map((v) => (v.size === 'XL' && v.color === 'Logo rojo' ? { ...v, stock: 0 } : v)));
  assert.equal(T.sizeDisabledForColor(onlyBlack, null)('XL'), false);
  const none = space(variants.map((v) => (v.size === 'XL' ? { ...v, stock: 0 } : v)));
  assert.equal(T.sizeDisabledForColor(none, null)('XL'), true);
});

test('líneas del escalón: mismas que agregaba Classic (precio por talle incluido)', () => {
  const p = { ...product, size_price_adjustments: { XL: { type: 'amount', value: 1500 }, XXL: { type: 'percent', value: 10 } } };
  const items = T.buildTierCartItems({
    product: p,
    categories: ['Remeras'],
    selections: [{ size: 'S', color: 'Full negro' }, { size: 'XL', color: 'Full negro' }, { size: 'XXL', color: 'Logo rojo' }],
    card: { units: 3, discountPct: 20, isFeatured: false },
    groupId: 'tier-p1-3-1',
    space: space(),
    pricesForSize: pricesFor(p),
    fallbackImage: 'foto.jpg',
  });
  // Valores de la caracterización «04-precio-por-talle» (antes del refactor).
  assert.deepEqual(items.map((i) => [i.size, i.unit_price, i.unit_price_cash, i.unit_price_original]), [
    ['S', 28572, 20000, 35715],
    ['XL', 29772, 21200, 37215],
    ['XXL', 31429, 22000, 39286.5],
  ]);
  // Estructura y ORDEN de campos (así se guarda el carrito).
  assert.deepEqual(Object.keys(items[0]), [
    'product_id', 'variant_id', 'name', 'categories', 'size', 'color', 'unit_price', 'unit_price_original',
    'unit_price_cash', 'qty', 'image_url', 'source', 'tierGroupId', 'tierLabel',
  ]);
  assert.deepEqual(items[0], {
    product_id: 'p1', variant_id: 'v-Full negro-S', name: 'REMERA JORDAN BÁSICA', categories: ['Remeras'], size: 'S', color: 'Full negro',
    unit_price: 28572, unit_price_original: 35715, unit_price_cash: 20000, qty: 1, image_url: 'foto.jpg', source: 'tier',
    tierGroupId: 'tier-p1-3-1', tierLabel: 'Lleva 3 — 20% OFF',
  });
});

test('una unidad sin variante no genera línea; sin contado no hay unit_price_cash', () => {
  const p = { ...product, retail_price_transfer: 0 };
  const items = T.buildTierCartItems({
    product: p, categories: [], selections: [{ size: 'M', color: 'Logo rojo' }, { size: 'Z', color: 'Logo rojo' }],
    card: { units: 2, discountPct: 15, isFeatured: true }, groupId: 'g', space: space(), pricesForSize: pricesFor(p), fallbackImage: null,
  });
  assert.equal(items.length, 1);
  assert.equal('unit_price_cash' in items[0], false);
  assert.equal(items[0].unit_price, 30358);
  assert.equal(items[0].tierLabel, 'Lleva 2 — 15% OFF');
  assert.equal(T.tierGroupLabel({ units: 1, discountPct: 0, isFeatured: false }), 'Lleva 1');
});

test('agregado común: misma línea que Classic, con y sin promo', () => {
  const v = variants[1];
  const plain = T.buildSingleCartItem({ product, categories: ['Remeras'], variant: v, finalPrice: 35715, finalCash: 25000, mainPrice: 35715, promo: null, fallbackImage: 'f.jpg' });
  assert.deepEqual(plain, {
    product_id: 'p1', variant_id: v.id, name: 'REMERA JORDAN BÁSICA', categories: ['Remeras'], size: 'M', color: 'Logo rojo',
    unit_price: 35715, unit_price_cash: 25000, qty: 1, image_url: 'f.jpg',
  });
  const promo = { id: 'promo-test', name: 'Promo prueba', stackable_with_coupons: null };
  // Caracterización «02-promo-automatica-suelto»: 20% sobre 35.715 y 25.000.
  const withPromo = T.buildSingleCartItem({ product, categories: ['Remeras'], variant: v, finalPrice: 28572, finalCash: 20000, mainPrice: 35715, promo, fallbackImage: null });
  assert.deepEqual(Object.keys(withPromo), [
    'product_id', 'variant_id', 'name', 'categories', 'size', 'color', 'unit_price', 'unit_price_cash',
    'promo_id', 'promo_name', 'unit_price_original', 'promo_stackable', 'qty', 'image_url',
  ]);
  assert.equal(withPromo.promo_stackable, true);
  assert.equal(withPromo.unit_price_original, 35715);
  // Contado igual o más caro que tarjeta: no se guarda.
  const noCash = T.buildSingleCartItem({ product, categories: [], variant: v, finalPrice: 100, finalCash: 100, mainPrice: 100, promo: null, fallbackImage: null });
  assert.equal('unit_price_cash' in noCash, false);
});

test('varias categorías: gana la primera en el orden del catálogo', () => {
  const cfg = new Map([
    ['Remeras', T.parseCategoryTierRow({ category_name: 'Remeras', is_active: true, variant_per_unit: true, tiers: [{ min_quantity: 2, discount_pct: 15 }] })],
    ['Ofertas', T.parseCategoryTierRow({ category_name: 'Ofertas', is_active: true, variant_per_unit: true, tiers: [{ min_quantity: 2, discount_pct: 25 }] })],
  ]);
  const order = new Map([['Remeras', 1], ['Ofertas', 2]]);
  const r = T.resolveTierConfigForProduct({ categories: ['Ofertas', 'Remeras'] }, cfg, order);
  assert.equal(r.categoryName, 'Remeras');
  assert.deepEqual(T.tierCardsFor(r).map((c) => c.discountPct), [0, 15]);
});

test('motivo del bloqueo: coincide con la validación de Classic y no muestra cantidades', () => {
  const vs = variants.map((v) => (v.color === 'Full negro' && v.size === 'S' ? { ...v, stock: 2 } : v));
  const sel = (n, size, color) => Array.from({ length: n }, () => ({ size, color }));
  const cases = [
    [[...sel(2, 'S', 'Full negro'), { size: 'M', color: 'Logo rojo' }], 3],
    [sel(3, 'S', 'Full negro'), 3],
    [[{ size: null, color: 'Logo rojo' }, { size: 'M', color: 'Logo rojo' }], 2],
    [[{ size: 'M', color: 'Logo rojo' }, { size: 'M', color: null }], 2],
    [sel(2, 'M', 'Logo rojo'), 3],
    [sel(2, 'M', 'Logo rojo'), 2],
  ];
  for (const [selections, units] of cases) {
    const args = { inTierMode: true, selections, tierUnits: units, space: space(vs) };
    const valid = T.isTierSelectionValid({ ...args, finalPrice: 35715 });
    assert.equal(T.tierSelectionIssue(args) === null, valid, JSON.stringify(selections));
  }
  assert.deepEqual(T.tierSelectionIssue({ inTierMode: true, selections: [{ size: null, color: 'Logo rojo' }, { size: 'M', color: 'Logo rojo' }], tierUnits: 2, space: space(vs) }), { kind: 'unit', unit: 0 });
  assert.deepEqual(T.tierSelectionIssue({ inTierMode: true, selections: sel(2, 'M', 'Logo rojo'), tierUnits: 3, space: space(vs) }), { kind: 'unit', unit: 2 });
  const stock = T.tierSelectionIssue({ inTierMode: true, selections: sel(3, 'S', 'Full negro'), tierUnits: 3, space: space(vs) });
  assert.equal(stock.kind, 'stock');
  assert.equal(stock.requested, 3);
  assert.equal(stock.variant.id, 'v-Full negro-S');
  assert.equal(T.tierSelectionIssue({ inTierMode: false, selections: [], tierUnits: 1, space: space(vs) }), null);
});
