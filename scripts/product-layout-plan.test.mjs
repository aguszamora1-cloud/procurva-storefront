/**
 * lib/productLayoutPlan.ts: el orden de la ficha que comparten Classic y las
 * plantillas. Classic tiene que quedar IDÉNTICO: cada caso se resuelve con la
 * copia literal del algoritmo original (pages/ProductDetail.tsx en 6feaeac,
 * buildRightColumn y BelowProductBlocks) y con el plan nuevo consumido como lo
 * consume hoy ProductDetail.tsx, y las dos salidas tienen que ser iguales.
 *
 * Además: las constantes movidas son las mismas que había en 6feaeac (leídas de
 * git), y el caso borde «talle, color» con la promesa de envío oculta.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(repoRoot, 'node_modules/.cache/product-layout-plan-test');
mkdirSync(CACHE_DIR, { recursive: true });
const outfile = resolve(CACHE_DIR, `plan-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `export * from './src/lib/productLayoutPlan.ts';
      export { DEFAULT_PRODUCT_LAYOUT, reinsertByReference, customTokenId, isCustomToken } from './src/lib/productLayout.ts';`,
    resolveDir: repoRoot,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  packages: 'external',
  alias: { '@': resolve(repoRoot, 'src') },
  logLevel: 'silent',
});
const P = await import(pathToFileURL(outfile).href);
const { DEFAULT_PRODUCT_LAYOUT, reinsertByReference, customTokenId, isCustomToken } = P;

// ── Copia LITERAL del algoritmo original (6feaeac, ProductDetail.tsx) ────────
// Sólo cambia lo que se emite: en lugar de JSX, una etiqueta por nodo.
const RIGHT_GROUP_6feaeac = {
  colors: 'variant',
  sizes: 'variant',
  size_guide: 'variant',
  add_to_cart: 'cta',
  whatsapp: 'cta',
  virtual_try: 'cta',
};
const RIGHT_TOKENS_6feaeac = [
  'quantity_promo', 'colors', 'sizes', 'size_guide', 'shipping_promise', 'add_to_cart',
  'whatsapp', 'virtual_try', 'upsells', 'purchase_flow', 'reels', 'reviews', 'related',
];
/** state: perUnitOpen, rightBlock(t) → etiqueta o null, rightPins (objeto con las 3 claves, valor o null). */
function oldRight(rightLayout, state) {
  const RIGHT_GROUP = RIGHT_GROUP_6feaeac;
  const RIGHT_TOKENS = RIGHT_TOKENS_6feaeac;
  const { perUnitOpen, rightBlock, rightPins } = state;
  const nodes = [];
  const visible = rightLayout.filter((t) => RIGHT_TOKENS.includes(t));
  const anchors = Object.keys(rightPins).filter((t) => !visible.includes(t));
  const order = reinsertByReference(visible, anchors, DEFAULT_PRODUCT_LAYOUT.right_column);

  let unitRowsDone = false;
  for (let i = 0; i < order.length; i++) {
    const group = RIGHT_GROUP[order[i]];
    if (group) {
      const run = [];
      while (i < order.length && RIGHT_GROUP[order[i]] === group) run.push(order[i++]);
      i--;
      const withRows = group === 'variant' && perUnitOpen && !unitRowsDone;
      const inner = run.map((t) => [t, rightBlock(t)]).filter(([, node]) => node !== null);
      if (!withRows && inner.length === 0) continue;
      if (withRows) unitRowsDone = true;
      nodes.push(`grupo-${run[0]}[${group}${withRows ? '+filas' : ''}:${inner.map(([t]) => t).join(',')}]`);
      continue;
    }
    if (visible.includes(order[i])) nodes.push(`${order[i]}=${rightBlock(order[i])}`);
    const pin = rightPins[order[i]];
    if (pin) nodes.push(`ancla-${order[i]}`);
  }
  return nodes;
}
function oldBelow(below_product, belowCustoms, flags) {
  const byId = new Map(belowCustoms.map((s) => [s.id, s]));
  const referenced = new Set();
  const nodes = [];
  for (const token of below_product) {
    if (isCustomToken(token)) {
      const sec = byId.get(customTokenId(token));
      if (sec) {
        referenced.add(sec.id);
        nodes.push(`custom:${sec.id}@${token}`);
      }
      continue;
    }
    switch (token) {
      case 'purchase_flow': nodes.push('purchase_flow'); break;
      case 'reels': nodes.push('reels'); break;
      case 'reviews': if (flags.reviews) nodes.push('reviews'); break;
      case 'related': if (flags.related) nodes.push('related'); break;
      default: break;
    }
  }
  for (const sec of belowCustoms) if (!referenced.has(sec.id)) nodes.push(`custom:${sec.id}@unref-${sec.id}`);
  return nodes;
}

// ── Plan nuevo, consumido como en ProductDetail.tsx ─────────────────────────
function newRight(rightLayout, state) {
  const { perUnitOpen, rightBlock, rightPins } = state;
  const nodes = [];
  for (const step of P.planRightColumn(rightLayout)) {
    if (step.kind === 'group') {
      const { group, tokens: run } = step;
      const withRows = step.unitRows && perUnitOpen;
      const inner = run.map((t) => [t, rightBlock(t)]).filter(([, node]) => node !== null);
      if (!withRows && inner.length === 0) continue;
      nodes.push(`grupo-${run[0]}[${group}${withRows ? '+filas' : ''}:${inner.map(([t]) => t).join(',')}]`);
      continue;
    }
    if (step.visible) nodes.push(`${step.token}=${rightBlock(step.token)}`);
    const pin = step.anchor ? rightPins[step.token] : null;
    if (pin) nodes.push(`ancla-${step.token}`);
  }
  return nodes;
}
function newBelow(below_product, belowCustoms, flags) {
  const nodes = [];
  for (const step of P.planBelowProduct(below_product, belowCustoms.map((s) => s.id))) {
    if (step.kind === 'custom') { nodes.push(`custom:${step.id}@${step.key}`); continue; }
    switch (step.token) {
      case 'purchase_flow': nodes.push('purchase_flow'); break;
      case 'reels': nodes.push('reels'); break;
      case 'reviews': if (flags.reviews) nodes.push('reviews'); break;
      case 'related': if (flags.related) nodes.push('related'); break;
      default: break;
    }
  }
  return nodes;
}

// ── Generadores ──────────────────────────────────────────────────────────────
let seed = 20261126;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const ALL = [...RIGHT_TOKENS_6feaeac, 'desconocido', 'custom:abc'];
/** Estados de la ficha: filas por unidad abiertas o no; bloques que no tienen nada (null); anclas sin bloque fijo. */
function states() {
  const out = [];
  for (const perUnitOpen of [false, true]) {
    for (const empty of [[], ['size_guide', 'virtual_try', 'whatsapp'], ['colors'], ['colors', 'sizes', 'size_guide'], ['add_to_cart', 'whatsapp', 'virtual_try']]) {
      for (const pins of [{ quantity_promo: 'esc', shipping_promise: 'ver', upsells: 'look' }, { quantity_promo: null, shipping_promise: null, upsells: 'look' }]) {
        out.push({ perUnitOpen, rightBlock: (t) => (empty.includes(t) ? null : t), rightPins: pins });
      }
    }
  }
  return out;
}
const STATES = states();
const same = (layout) => {
  for (const st of STATES) assert.deepEqual(newRight(layout, st), oldRight(layout, st), `diseño ${JSON.stringify(layout)} · filas=${st.perUnitOpen}`);
};

test('las constantes movidas son las de 6feaeac (leídas de git)', () => {
  let src;
  try {
    src = execFileSync('git', ['show', '6feaeac:src/pages/ProductDetail.tsx'], { cwd: repoRoot, encoding: 'utf8' });
  } catch {
    return; // sin git: alcanza con la copia literal de arriba
  }
  const grp = src.match(/const RIGHT_GROUP[^=]*=\s*\{([\s\S]*?)\};/)[1];
  const tok = src.match(/const RIGHT_TOKENS[^=]*=\s*\[([\s\S]*?)\];/)[1];
  assert.deepEqual(Object.fromEntries([...grp.matchAll(/(\w+):\s*'(\w+)'/g)].map((m) => [m[1], m[2]])), RIGHT_GROUP_6feaeac);
  assert.deepEqual([...tok.matchAll(/'(\w+)'/g)].map((m) => m[1]), RIGHT_TOKENS_6feaeac);
  assert.deepEqual({ ...P.RIGHT_GROUP }, RIGHT_GROUP_6feaeac);
  assert.deepEqual([...P.RIGHT_TOKENS], RIGHT_TOKENS_6feaeac);
  // Las claves de rightPins eran exactamente estas tres, en este orden.
  const pins = src.match(/const rightPins[^=]*=\s*\{([\s\S]*?)\n  \};/)[1];
  assert.deepEqual([...pins.matchAll(/^    (\w+):/gm)].map((m) => m[1]), [...P.RIGHT_ANCHORS]);
});

test('diseños reales: sin diseño, por defecto, Rosario y desdeabajo', () => {
  same(DEFAULT_PRODUCT_LAYOUT.right_column);
  same(['quantity_promo', 'sizes', 'colors', 'size_guide', 'shipping_promise', 'add_to_cart', 'whatsapp', 'virtual_try', 'reels', 'reviews', 'purchase_flow', 'upsells']);
  same(['quantity_promo', 'sizes', 'size_guide', 'colors', 'shipping_promise', 'add_to_cart', 'whatsapp', 'virtual_try', 'upsells', 'purchase_flow']);
  same(['add_to_cart']);
  same([]);
});

test('todos los subconjuntos del orden por defecto y de su inverso (2 × 8.192)', () => {
  const base = RIGHT_TOKENS_6feaeac;
  let n = 0;
  for (const order of [base, [...base].reverse()]) {
    for (let mask = 0; mask < 1 << base.length; mask++) {
      same(order.filter((_, i) => mask & (1 << i)));
      n++;
    }
  }
  assert.equal(n, 16384);
});

test('cada intercambio de dos tokens y cada token quitado', () => {
  const base = [...DEFAULT_PRODUCT_LAYOUT.right_column, 'reels', 'reviews', 'related'];
  for (let i = 0; i < base.length; i++) {
    same(base.filter((_, k) => k !== i));
    for (let j = i + 1; j < base.length; j++) {
      const sw = [...base];
      [sw[i], sw[j]] = [sw[j], sw[i]];
      same(sw);
    }
  }
});

test('5.000 combinaciones al azar (permutación de un subconjunto, con tokens desconocidos)', () => {
  for (let k = 0; k < 5000; k++) same(shuffle(ALL).filter(() => rnd() < 0.7));
});

test('caso borde: «talle, color» con la promesa de envío oculta parte las variantes', () => {
  const layout = ['quantity_promo', 'sizes', 'colors', 'add_to_cart', 'whatsapp'];
  const plan = P.planRightColumn(layout);
  const groups = plan.filter((s) => s.kind === 'group' && s.group === 'variant');
  assert.deepEqual(groups.map((g) => g.tokens), [['sizes'], ['colors']], 'el ancla oculta cae entre talle y color');
  assert.deepEqual(groups.map((g) => g.unitRows), [true, false], 'las filas por unidad van en la primera corrida');
  const ship = plan.find((s) => s.kind === 'token' && s.token === 'shipping_promise');
  assert.deepEqual(ship, { kind: 'token', token: 'shipping_promise', visible: false, anchor: true });
  same(layout);
});

test('zona de abajo: mismo orden que BelowProductBlocks (secciones referenciadas, sin referencia, borradas)', () => {
  const ids = ['a', 'b', 'c'];
  const toks = ['reels', 'reviews', 'related', 'purchase_flow', 'custom:a', 'custom:b', 'custom:zz', 'desconocido'];
  for (let k = 0; k < 3000; k++) {
    const below = shuffle(toks).filter(() => rnd() < 0.6);
    const customs = shuffle(ids).filter(() => rnd() < 0.7).map((id) => ({ id }));
    for (const flags of [{ reviews: true, related: true }, { reviews: false, related: true }, { reviews: true, related: false }]) {
      assert.deepEqual(newBelow(below, customs, flags), oldBelow(below, customs, flags), `${JSON.stringify(below)} · ${JSON.stringify(customs)}`);
    }
  }
});
