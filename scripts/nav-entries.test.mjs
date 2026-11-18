// Pruebas de src/components/header/navEntries.ts (P0-2 B1): la navegación
// horizontal que usarán las próximas variantes de encabezado sale de los MISMOS
// datos que el menú lateral (useHeaderNav), en el mismo orden y sin consultas.
// Classic no la usa todavía; esto fija su contrato para que B2+ no lo cambie sin
// querer. Corre con `npm run test:header-nav`. El .ts se empaqueta con esbuild
// (sólo tiene imports de tipos), igual que scripts/store-templates.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(repoRoot, 'node_modules/.cache/nav-entries-test');
mkdirSync(CACHE_DIR, { recursive: true });
const outfile = resolve(CACHE_DIR, `nav-entries-${process.pid}.mjs`);
await build({
  stdin: { contents: `export * from './src/components/header/navEntries.ts';`, resolveDir: repoRoot, loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  packages: 'external',
  alias: { '@': resolve(repoRoot, 'src') },
  logLevel: 'silent',
});
const { desktopNavEntries, isDisclosure, isPrimaryEntry, PRIMARY_NAV_KEYS } = await import(pathToFileURL(outfile).href);

test('desktopNavEntries: mismos datos y orden que el menú lateral, sin INICIO', () => {
  const tracking = { kind: 'tracking', id: 't', label: 'Seguí tu envío', help: '', carriers: [{ name: 'C', url: 'https://x' }] };
  const nav = {
    categories: ['Remeras', 'Buzos'],
    menuPromos: [{ id: 'p1', name: 'Promo uno' }],
    showOutfitsLink: true,
    menuItems: [
      tracking,
      { kind: 'page', id: 'g', label: 'Guía', slug: 'guia', body: 'x', imageUrl: '' },
      { kind: 'link', id: 'e', label: 'IG', url: 'https://ig', external: true, newTab: true },
      { kind: 'link', id: 'i', label: 'Ofertas', url: '/productos', external: false, newTab: false },
    ],
  };
  const entries = desktopNavEntries(nav, (p) => `/promo/${p.id}`);
  assert.deepEqual(
    entries.map((e) => [e.kind, e.label]),
    [
      ['route', 'Productos'],
      ['categories', 'Categorías'],
      ['promos', 'Promociones'],
      ['outfits', 'Outfits'],
      ['tracking', 'Seguí tu envío'],
      ['route', 'Guía'],
      ['external', 'IG'],
      ['route', 'Ofertas'],
    ],
  );
  assert.equal(entries[5].to, '/pagina/guia');
  assert.equal(entries[7].to, '/productos');
  assert.deepEqual(entries[2].promos, [{ id: 'p1', name: 'Promo uno', to: '/promo/p1' }]);
  assert.deepEqual(entries[1].categories, ['Remeras', 'Buzos']);
  assert.equal(entries[4].item, tracking, 'el ítem de seguimiento va entero (correos, ayuda)');
  assert.equal(entries.filter(isDisclosure).length, 3, 'categorías, promociones y seguimiento despliegan');
  assert.deepEqual(
    entries.map((e) => isPrimaryEntry(e)),
    [true, true, true, true, false, false, false, false],
    'los fijos son principales; lo del comercio, secundario',
  );
  assert.equal(new Set(entries.map((e) => e.key)).size, entries.length, 'claves únicas');
});

test('desktopNavEntries: sin categorías es un link al índice; sin promos ni outfits no aparecen', () => {
  const entries = desktopNavEntries({ categories: [], menuPromos: [], showOutfitsLink: false, menuItems: [] }, () => '');
  assert.deepEqual(
    entries.map((e) => [e.kind, e.label, e.to]),
    [
      ['route', 'Productos', '/productos'],
      ['route', 'Categorías', '/categorias'],
    ],
  );
  assert.equal(isPrimaryEntry(entries[1]), true, '"Categorías" sigue siendo principal aunque sea un link');
  assert.equal(entries.some(isDisclosure), false);
});

test('las claves principales son exactamente las cuatro fijas', () => {
  assert.deepEqual([...PRIMARY_NAV_KEYS], ['productos', 'categorias', 'promociones', 'outfits']);
});

test('no muta la entrada', () => {
  const nav = { categories: ['A'], menuPromos: [], showOutfitsLink: false, menuItems: [] };
  const antes = JSON.stringify(nav);
  desktopNavEntries(nav, () => '');
  assert.equal(JSON.stringify(nav), antes);
});
