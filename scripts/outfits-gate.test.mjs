// T5: criterio de bloqueo de plantillas v1 por outfits (src/lib/outfitsGate.ts).
//
// Corre con `npm run test:outfits-gate`. Es el mismo criterio con el que Classic
// muestra outfits: home (minorista + PRO + section_outfits) o ficha minorista
// (mostrar_outfit), con al menos un outfit activo con prendas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(repoRoot, 'node_modules/.cache/outfits-gate-test');
mkdirSync(CACHE_DIR, { recursive: true });
const outfile = resolve(CACHE_DIR, `outfits-gate-${process.pid}.mjs`);
await build({ entryPoints: [resolve(repoRoot, 'src/lib/outfitsGate.ts')], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent' });
const G = await import(pathToFileURL(outfile).href);

const cfg = (o = {}) => ({
  storeType: 'retail',
  isPro: true,
  sections: { outfits: false },
  complementaryBlock: { mostrarOutfit: false },
  ...o,
});
const ACTIVE = [{ active: true, items: 3 }];

test('sin superficies prendidas: nunca bloquea, aunque haya outfits activos', () => {
  assert.equal(G.storeHasActiveOutfits(cfg(), ACTIVE), false);
  assert.equal(G.storeHasActiveOutfits(cfg()), false);
  assert.deepEqual(G.outfitSurfaces(cfg()), []);
});

test('home: minorista + PRO + section_outfits', () => {
  assert.deepEqual(G.outfitSurfaces(cfg({ sections: { outfits: true } })), ['home']);
  assert.equal(G.storeHasActiveOutfits(cfg({ sections: { outfits: true } }), ACTIVE), true);
  // Sin PRO el home no los muestra (Classic: config.isPro).
  assert.deepEqual(G.outfitSurfaces(cfg({ isPro: false, sections: { outfits: true } })), []);
});

test('ficha: mostrar_outfit (sin gate de plan), sólo minorista', () => {
  assert.deepEqual(G.outfitSurfaces(cfg({ isPro: false, complementaryBlock: { mostrarOutfit: true } })), ['product']);
  assert.equal(G.storeHasActiveOutfits(cfg({ complementaryBlock: { mostrarOutfit: true } }), ACTIVE), true);
  for (const storeType of ['store_2', 'store_3', null]) assert.deepEqual(G.outfitSurfaces(cfg({ storeType, complementaryBlock: { mostrarOutfit: true } })), ['product'], String(storeType));
});

test('mayorista: nunca (catalog_outfits sólo tiene precio minorista)', () => {
  const c = cfg({ storeType: 'wholesale', sections: { outfits: true }, complementaryBlock: { mostrarOutfit: true } });
  assert.deepEqual(G.outfitSurfaces(c), []);
  assert.equal(G.storeHasActiveOutfits(c, ACTIVE), false);
});

test('filas: sólo cuentan los activos con prendas', () => {
  const c = cfg({ sections: { outfits: true }, complementaryBlock: { mostrarOutfit: true } });
  assert.equal(G.storeHasActiveOutfits(c, []), false);
  assert.equal(G.storeHasActiveOutfits(c, [{ active: false, items: 4 }]), false);
  assert.equal(G.storeHasActiveOutfits(c, [{ active: true, items: 0 }]), false);
  assert.equal(G.storeHasActiveOutfits(c, [{ active: null, items: 2 }]), false);
  assert.equal(G.storeHasActiveOutfits(c, [{ active: true }]), true, 'prendas sin contar = se toma como que tiene');
  assert.deepEqual(G.outfitsUsage(c, [{ active: true, items: 1 }, { active: true, items: 0 }, { active: false, items: 2 }]), {
    active: true,
    surfaces: ['home', 'product'],
    activeOutfits: 1,
  });
});

test('sin filas (no se pudo mirar): prudente, bloquea si alguna superficie está prendida', () => {
  assert.equal(G.storeHasActiveOutfits(cfg({ complementaryBlock: { mostrarOutfit: true } })), true);
  assert.equal(G.storeHasActiveOutfits(cfg({ complementaryBlock: { mostrarOutfit: true } }), null), true);
  assert.equal(G.outfitsUsage(cfg({ complementaryBlock: { mostrarOutfit: true } })).activeOutfits, null);
});

test('mensaje para el comercio: sin emojis y dice que no se tocaron sus datos', () => {
  assert.doesNotMatch(G.OUTFITS_BLOCK_MESSAGE, /\p{Extended_Pictographic}/u);
  assert.match(G.OUTFITS_BLOCK_MESSAGE, /no se modificaron/);
});
