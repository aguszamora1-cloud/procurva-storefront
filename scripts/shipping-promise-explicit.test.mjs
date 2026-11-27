/**
 * shippingPromiseTitleExplicit (lib/storeConfig.ts): ¿el comercio guardó
 * shipping_promise_title o shippingPromiseTitle es «Envío rápido» por defecto?
 * Y las insignias de confianza, ocultas en Atelier 2 (opción B, 26/11).
 *
 *  1. Classic no cambia: la configuración normalizada con el storeConfig.ts de
 *     6feaeac (leído de git) y con el actual es IDÉNTICA salvo los campos nuevos.
 *  2. La marca sale de la presencia de la clave, no de comparar textos.
 *  3. Atelier 2 (facts.shippingPromiseLines) sólo muestra lo guardado, y nunca
 *     las insignias, ni en la ficha ni en el inicio. Las otras plantillas no
 *     piden ocultarlas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(repoRoot, 'node_modules/.cache/shipping-promise-explicit-test');
mkdirSync(CACHE_DIR, { recursive: true });
const opts = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  alias: { '@': resolve(repoRoot, 'src') },
  define: { 'import.meta.env': '{}' },
  logLevel: 'silent',
  jsx: 'automatic',
};
async function load(name, contents, resolveDir) {
  const outfile = resolve(CACHE_DIR, `${name}-${process.pid}.mjs`);
  await build({ ...opts, stdin: { contents, resolveDir, loader: 'ts' }, outfile });
  return import(pathToFileURL(outfile).href);
}
const NEW = await load(
  'nuevo',
  `export { normalizeStoreConfig } from './src/lib/storeConfig.ts';
   export { shippingPromiseLines, trustBadgesBacked } from './src/templates/atelier2/facts.ts';`,
  repoRoot,
);
let OLD = null;
try {
  const src = execFileSync('git', ['show', '6feaeac:src/lib/storeConfig.ts'], { cwd: repoRoot, encoding: 'utf8' });
  OLD = await load('base', src, resolve(repoRoot, 'src/lib'));
} catch {
  OLD = null; // sin git: la comparación con la base no aplica
}

const resolved = (settings) => ({ company_id: 'c1', name: 'Tienda', slug: 'tienda', plan: 'TIENDA', store_type: 'retail', settings });
const TITLES = { ausente: undefined, propio: 'Llega en 24 h', vacio: '', espacios: '   ', 'el mismo texto que el por defecto': 'Envío rápido', numero: 5, nulo: null };
const SUBTITLES = { ausente: undefined, propio: 'A todo el país', vacio: '' };
const settingsFor = (title, subtitle, extra = {}) => {
  const s = { ...extra };
  if (title !== undefined) s.shipping_promise_title = title;
  if (subtitle !== undefined) s.shipping_promise_subtitle = subtitle;
  return s;
};

test('Classic no cambia: misma configuración normalizada que 6feaeac, salvo los campos nuevos', { skip: OLD ? false : 'sin git' }, () => {
  const extras = [{}, { shipping_promise_enabled: false }, { trust_badges: ['Uno', 'Dos'] }, { section_trust_badges: false }];
  for (const [tn, t] of Object.entries(TITLES))
    for (const [sn, s] of Object.entries(SUBTITLES))
      for (const extra of extras) {
        const a = OLD.normalizeStoreConfig(resolved(settingsFor(t, s, extra)));
        // mpCuentaPriceMode: lo agregó PR #28 de main después de 6feaeac (aprobado por Agus el
        // 26/11/2026). Estas configuraciones no traen mp_cuenta_price_mode: tiene que valer 'cash'.
        const { shippingPromiseTitleExplicit, installmentsExplicit, mpCuentaPriceMode, ...b } = NEW.normalizeStoreConfig(resolved(settingsFor(t, s, extra)));
        assert.equal(typeof shippingPromiseTitleExplicit, 'boolean');
        assert.equal(typeof installmentsExplicit, 'boolean');
        assert.equal(mpCuentaPriceMode, 'cash');
        assert.deepEqual(b, a, `título ${tn}, subtítulo ${sn}, ${JSON.stringify(extra)}`);
      }
});

test('la marca sale de la presencia de la clave guardada, no del texto', () => {
  const explicit = (t) => NEW.normalizeStoreConfig(resolved(settingsFor(t))).shippingPromiseTitleExplicit;
  assert.equal(explicit(undefined), false, 'ausente: «Envío rápido» por defecto');
  assert.equal(explicit('Llega en 24 h'), true);
  assert.equal(explicit(''), true, 'vaciado a propósito');
  assert.equal(explicit('Envío rápido'), true, 'tecleado igual que el por defecto: es del comercio');
  assert.equal(explicit(5), false, 'no es texto');
  assert.equal(explicit(null), false, 'null');
  // Sin settings.
  assert.equal(NEW.normalizeStoreConfig(resolved(null)).shippingPromiseTitleExplicit, false);
});

test('Atelier 2 muestra sólo lo que el comercio guardó', () => {
  const lines = (t, s, extra) => NEW.shippingPromiseLines(NEW.normalizeStoreConfig(resolved(settingsFor(t, s, extra))));
  assert.equal(lines(undefined, undefined), null, 'nada guardado: no se anuncia «Envío rápido»');
  assert.deepEqual(lines('Llega en 24 h', undefined), { title: 'Llega en 24 h', subtitle: '' });
  assert.deepEqual(lines('Envío rápido', undefined), { title: 'Envío rápido', subtitle: '' }, 'tecleado por el comercio');
  assert.deepEqual(lines(undefined, 'A todo el país'), { title: '', subtitle: 'A todo el país' }, 'subtítulo sin el título por defecto');
  assert.deepEqual(lines('Llega en 24 h', 'A todo el país'), { title: 'Llega en 24 h', subtitle: 'A todo el país' });
  assert.equal(lines('', undefined), null, 'título vaciado y sin subtítulo');
  assert.equal(lines('   ', ''), null, 'sólo espacios');
  assert.equal(lines(5, undefined), null, 'título inválido');
  assert.equal(lines('Llega en 24 h', 'A todo el país', { shipping_promise_enabled: false }), null, 'apagada por el comercio');
  // Configuración en caché de antes del campo: el título no está confirmado.
  assert.equal(NEW.shippingPromiseLines({ shippingPromiseEnabled: true, shippingPromiseTitle: 'Envío rápido', shippingPromiseSubtitle: '' }), null);
});

test('insignias: ocultas en Atelier 2, en la ficha y en el inicio; las otras plantillas no las ocultan', () => {
  assert.equal(NEW.trustBadgesBacked(), false);
  const read = (f) => readFileSync(resolve(repoRoot, f), 'utf8');
  assert.match(read('src/templates/atelier2/Product.tsx'), /\{trustBadgesBacked\(\) && \(/);
  assert.match(read('src/templates/atelier2/Home.tsx'), /hideTrustBadges: !trustBadgesBacked\(\)/);
  assert.match(read('src/templates/shared/StoreContent.tsx'), /if \(on\('trust_badges'\) && !opts\.hideTrustBadges\) nodes\.trust_badges =/);
  // Sin comparaciones con listas por defecto.
  assert.doesNotMatch(read('src/templates/atelier2/facts.ts'), /Abonás al recibir|Compra protegida|Envío rápido'/);
  for (const dir of readdirSync(resolve(repoRoot, 'src/templates'), { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name === 'atelier2') continue;
    for (const f of readdirSync(resolve(repoRoot, 'src/templates', dir.name))) {
      if (!/\.tsx?$/.test(f)) continue;
      assert.doesNotMatch(read(`src/templates/${dir.name}/${f}`), /hideTrustBadges:/, `${dir.name}/${f}`);
    }
  }
});
