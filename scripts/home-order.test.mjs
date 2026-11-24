// T5: orden y visibilidad del home (src/lib/homeOrder.ts), compartidos entre
// Classic (pages/Home.tsx) y las plantillas (templates/shared/StoreContent.tsx).
//
// Corre con `npm run test:home-order`.
//  1. orderHomeKeys y homeSectionEnabled dan EXACTAMENTE lo que daba el código que
//     vivía adentro de Home.tsx antes de T5 (copiado abajo como referencia), en
//     miles de configuraciones al azar con secciones custom:<uuid>.
//  2. placeAroundNatives: cada extra aparece una vez, en el orden de la tienda y
//     después del último bloque propio que lo precede.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(repoRoot, 'node_modules/.cache/home-order-test');
mkdirSync(CACHE_DIR, { recursive: true });
const outfile = resolve(CACHE_DIR, `home-order-${process.pid}.mjs`);
await build({
  entryPoints: [resolve(repoRoot, 'src/lib/homeOrder.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'silent',
});
const H = await import(pathToFileURL(outfile).href);

// ── Referencia: el código de pages/Home.tsx antes de T5 (b141a4e) ────────────
const REF_ORDER = ['hero', 'trust_badges', 'categories', 'featured', 'new_arrivals', 'offers', 'outfits', 'reels', 'stories', 'social_proof', 'newsletter'];
function refWithMissingSections(saved, available) {
  const out = saved.filter((k) => k in available);
  for (const key of REF_ORDER) {
    if (!(key in available) || out.includes(key)) continue;
    let at = 0;
    for (const prev of REF_ORDER) {
      if (prev === key) break;
      const i = out.indexOf(prev);
      if (i >= 0 && i + 1 > at) at = i + 1;
    }
    out.splice(at, 0, key);
  }
  return out;
}
function refOrdered(sectionsOrder, customKeys) {
  const nodes = Object.fromEntries([...REF_ORDER, ...customKeys].map((k) => [k, null]));
  return [...refWithMissingSections(sectionsOrder, nodes), ...customKeys.filter((k) => !sectionsOrder.includes(k))];
}
function refEnabled(key, config) {
  const n = {
    hero: config.heroEnabled,
    trust_badges: config.sections.trustBadges,
    categories: config.sections.categories,
    featured: config.sections.featured,
    new_arrivals: config.sections.newArrivals,
    offers: config.sections.offers,
    outfits: config.storeType !== 'wholesale' && config.isPro && config.sections.outfits,
    stories: config.isPro && config.sections.stories,
    reels: config.isPro && config.sections.reels,
    social_proof: config.isPro && config.sections.socialProof,
    newsletter: config.isPro && config.sections.newsletter,
  };
  return Boolean(n[key]);
}

// Pseudoaleatorio con semilla: la prueba da siempre lo mismo.
let seed = 20261123;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const shuffle = (arr) => arr.map((v) => [rnd(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const uuid = () => `${Math.floor(rnd() * 1e8).toString(16)}-aaaa-4bbb-8ccc-${Math.floor(rnd() * 1e12).toString(16)}`;

function randomCase() {
  const customs = Array.from({ length: Math.floor(rnd() * 5) }, () => `custom:${uuid()}`);
  // Orden guardado: un subconjunto desordenado de fijas y custom, con alguna key vieja que ya no existe.
  const pool = shuffle([...REF_ORDER, ...customs, 'upsell', 'probador', `custom:${uuid()}`]);
  const saved = pool.slice(0, Math.floor(rnd() * pool.length));
  return { saved, customs };
}

test('orderHomeKeys = orden de Classic antes de T5 (5000 casos al azar, con custom:<uuid>)', () => {
  for (let i = 0; i < 5000; i++) {
    const { saved, customs } = randomCase();
    assert.deepEqual(H.orderHomeKeys(saved, customs), refOrdered(saved, customs), JSON.stringify({ saved, customs }));
  }
});

test('orderHomeKeys: casos conocidos', () => {
  // Orden vacío: el de diseño, y las custom al final.
  assert.deepEqual(H.orderHomeKeys([], ['custom:a']), [...REF_ORDER, 'custom:a']);
  // Custom nombrada en el orden: conserva su lugar.
  const named = H.orderHomeKeys(['hero', 'custom:a', 'featured'], ['custom:a', 'custom:b']);
  assert.ok(named.indexOf('hero') < named.indexOf('custom:a') && named.indexOf('custom:a') < named.indexOf('featured'));
  assert.equal(named.at(-1), 'custom:b');
  // Custom borrada que quedó en el orden: no aparece.
  assert.ok(!H.orderHomeKeys(['hero', 'custom:gone'], []).includes('custom:gone'));
  // Sección movida a mano: se respeta (outfits antes que categorías).
  const o = H.orderHomeKeys(['hero', 'outfits', 'categories'], []);
  assert.ok(o.indexOf('outfits') < o.indexOf('categories'));
});

test('homeSectionEnabled = reglas de Classic antes de T5 (todas las combinaciones)', () => {
  const flags = ['trustBadges', 'categories', 'featured', 'newArrivals', 'offers', 'outfits', 'stories', 'reels', 'socialProof', 'newsletter'];
  let n = 0;
  for (let mask = 0; mask < 1 << flags.length; mask += 7) {
    for (const isPro of [true, false])
      for (const heroEnabled of [true, false])
        for (const storeType of ['retail', 'wholesale', 'store_2', null]) {
          const sections = Object.fromEntries(flags.map((f, i) => [f, Boolean(mask & (1 << i))]));
          const config = { heroEnabled, isPro, storeType, sections };
          for (const key of REF_ORDER) {
            assert.equal(H.homeSectionEnabled(key, config), refEnabled(key, config), `${key} ${JSON.stringify(config)}`);
            n++;
          }
        }
  }
  assert.ok(n > 10000);
});

const ATELIER = [['hero'], ['new_arrivals'], ['categories'], ['featured'], ['offers']];
const MOMENTUM = [['hero'], ['categories'], ['featured', 'new_arrivals', 'offers']];

test('placeAroundNatives: ubica cada extra después del último bloque propio que lo precede', () => {
  const ordered = ['custom:top', 'hero', 'custom:franja', 'trust_badges', 'categories', 'featured', 'custom:faq', 'new_arrivals', 'offers', 'outfits', 'social_proof', 'newsletter'];
  const extras = new Set(['custom:top', 'custom:franja', 'trust_badges', 'custom:faq', 'social_proof', 'newsletter']);
  assert.deepEqual(H.placeAroundNatives(ordered, ATELIER, extras), [
    ['custom:top'],
    ['custom:franja', 'trust_badges'],
    [], // después de Nuevos (en Atelier va antes que Categorías)
    [],
    ['custom:faq'],
    ['social_proof', 'newsletter'], // outfits no es propio ni extra: no ancla
  ]);
  // Momentum: las pestañas cubren featured, new_arrivals y offers.
  assert.deepEqual(H.placeAroundNatives(ordered, MOMENTUM, extras), [['custom:top'], ['custom:franja', 'trust_badges'], [], ['custom:faq', 'social_proof', 'newsletter']]);
});

test('placeAroundNatives: cada extra una sola vez; dentro de cada posición, en el orden de la tienda (5000 casos al azar)', () => {
  for (let i = 0; i < 5000; i++) {
    const { saved, customs } = randomCase();
    const ordered = H.orderHomeKeys(saved, customs);
    const extraPool = ['trust_badges', 'reels', 'stories', 'social_proof', 'newsletter', ...customs];
    const extras = new Set(extraPool.filter(() => rnd() < 0.7));
    const natives = pick([ATELIER, MOMENTUM]);
    const placed = H.placeAroundNatives(ordered, natives, extras);
    assert.equal(placed.length, natives.length + 1);
    const flat = placed.flat();
    // Mismo conjunto, sin repetidos. (El orden entre posiciones puede diferir del de
    // la tienda: la plantilla pinta sus bloques propios en SU orden.)
    assert.deepEqual([...flat].sort(), ordered.filter((k) => extras.has(k)).sort(), 'mismo conjunto');
    assert.equal(new Set(flat).size, flat.length, 'sin repetidos');
    for (const keys of placed) assert.deepEqual(keys, ordered.filter((k) => keys.includes(k)), 'orden de la tienda dentro de la posición');
    // Ancla: el bloque propio inmediatamente anterior en el orden de la tienda.
    const group = new Map(natives.flatMap((ks, gi) => ks.map((k) => [k, gi])));
    placed.forEach((keys, slot) => {
      for (const k of keys) {
        const before = ordered.slice(0, ordered.indexOf(k)).filter((x) => group.has(x));
        assert.equal(slot, before.length ? group.get(before.at(-1)) + 1 : 0, k);
      }
    });
  }
});

test('DEFAULT_SECTION_ORDER no cambió', () => {
  assert.deepEqual([...H.DEFAULT_SECTION_ORDER], REF_ORDER);
});
