// T6 · Pruebas del montaje de plantillas completas (src/lib/templateApp.ts) y de
// la guarda de escrituras de las vistas previas (src/lib/writeGuard.ts).
//
// Corre con `npm run test:template-app`. Mismo patrón que store-templates.test.mjs:
// se empaqueta con el esbuild de Vite y se importa.
//
// Lo que garantizan:
//   1. decideTemplateApp: una plantilla completa se monta SÓLO con el build
//      habilitado, una referencia publicada exacta, canal minorista y sin la
//      sección de outfits. Todas las demás combinaciones dan Classic.
//   2. Sin VITE_TEMPLATE_APPS=1 el interruptor es false (import.meta.env vacío).
//   3. La guarda deja pasar sólo lecturas y las RPC de lectura; corta Edge
//      Functions, RPC de escritura y cualquier método que no sea GET/HEAD.
//   4. Guardas estáticas: App.tsx sólo monta la plantilla por decideTemplateApp
//      detrás del interruptor; la vista previa del diseñador instala la guarda
//      sólo enmarcada y detrás del interruptor; caché v24.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(repoRoot, 'node_modules/.cache/template-app-test');

async function load(name, contents, env = '{}') {
  mkdirSync(CACHE_DIR, { recursive: true });
  const outfile = resolve(CACHE_DIR, `${name}-${process.pid}.mjs`);
  await build({
    stdin: { contents, resolveDir: repoRoot, loader: 'ts', sourcefile: `${name}.entry.ts` },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    packages: 'external',
    alias: { '@': resolve(repoRoot, 'src') },
    define: { 'import.meta.env': env },
    logLevel: 'silent',
  });
  return import(pathToFileURL(outfile).href);
}

const { decideTemplateApp, TEMPLATE_APPS_ENABLED } = await load('gate', `export * from './src/lib/templateApp.ts';`);
const on = await load('gate-on', `export { TEMPLATE_APPS_ENABLED } from './src/lib/templateApp.ts';`, '{"VITE_TEMPLATE_APPS":"1"}');
const raro = await load('gate-raro', `export { TEMPLATE_APPS_ENABLED } from './src/lib/templateApp.ts';`, '{"VITE_TEMPLATE_APPS":"true"}');
const { blockedReason, READ_RPCS } = await load('guard', `export * from './src/lib/writeGuard.ts';`);

const src = (p) => readFileSync(resolve(repoRoot, p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// ── 1. Decisión ───────────────────────────────────────────────────────────────
const OK = { enabled: true, template: { id: 'atelier', version: 1 }, storeType: 'retail', outfitsSection: false };

test('interruptor: apagado por defecto; sólo "1" lo prende', () => {
  assert.equal(TEMPLATE_APPS_ENABLED, false);
  assert.equal(on.TEMPLATE_APPS_ENABLED, true);
  assert.equal(raro.TEMPLATE_APPS_ENABLED, false);
});

test('las tres plantillas se montan con todas las condiciones', () => {
  for (const kit of ['atelier', 'distrito', 'momentum']) {
    assert.deepEqual(decideTemplateApp({ ...OK, template: { id: kit, version: 1 } }), { kit, block: null });
    // Campos extra de la referencia guardada (para volver atrás) no molestan.
    assert.deepEqual(decideTemplateApp({ ...OK, template: { id: kit, version: 1, previous: { corners: 'soft' }, applied_at: '2026-11-23T12:00:00-03:00' } }).kit, kit);
  }
});

test('build apagado: Classic aunque todo lo demás esté bien', () => {
  for (const enabled of [false, undefined, null, 1, 'true', '1']) {
    assert.deepEqual(decideTemplateApp({ ...OK, enabled }), { kit: null, block: 'apagado' }, JSON.stringify(enabled));
  }
});

test('sin referencia válida y publicada: Classic', () => {
  const malas = [
    undefined, null, '', 'atelier', 1, [], {},
    { id: 'atelier' }, { id: 'atelier', version: 2 }, { id: 'atelier', version: null }, { id: 'atelier', version: '1' },
    { id: 'Atelier', version: 1 }, { id: 'classic', version: 1 }, { id: 'otra', version: 1 }, { id: '__proto__', version: 1 },
    { version: 1 },
  ];
  for (const template of malas) {
    assert.deepEqual(decideTemplateApp({ ...OK, template }), { kit: null, block: 'sin-plantilla' }, JSON.stringify(template));
  }
});

test('mayorista o canal desconocido: Classic', () => {
  for (const storeType of ['wholesale', null, undefined, '', 'Retail', 'store_2', 'mayorista']) {
    assert.deepEqual(decideTemplateApp({ ...OK, storeType }), { kit: null, block: 'mayorista' }, String(storeType));
  }
});

test('outfits prendidos (o dato raro): Classic', () => {
  for (const outfitsSection of [true, undefined, null, 1, 'false']) {
    assert.deepEqual(decideTemplateApp({ ...OK, outfitsSection }), { kit: null, block: 'outfits' }, JSON.stringify(outfitsSection));
  }
});

test('todas las combinaciones: sólo una monta', () => {
  let montadas = 0;
  for (const enabled of [true, false])
    for (const template of [OK.template, { id: 'atelier', version: 9 }, null])
      for (const storeType of ['retail', 'wholesale'])
        for (const outfitsSection of [false, true]) {
          const d = decideTemplateApp({ enabled, template, storeType, outfitsSection });
          if (d.kit) montadas++;
          assert.equal(Boolean(d.kit), enabled && template === OK.template && storeType === 'retail' && outfitsSection === false);
        }
  assert.equal(montadas, 1);
});

test('no muta la entrada', () => {
  const i = Object.freeze({ ...OK, template: Object.freeze({ id: 'momentum', version: 1 }) });
  assert.equal(decideTemplateApp(i).kit, 'momentum');
});

// ── 3. Guarda de escrituras ───────────────────────────────────────────────────
const SB = 'https://kmafsugiixkpmqxgetug.supabase.co';

test('guarda: lecturas y RPC de lectura pasan', () => {
  assert.equal(blockedReason('GET', `${SB}/rest/v1/products?select=*`), null);
  assert.equal(blockedReason('HEAD', `${SB}/rest/v1/products`), null);
  assert.equal(blockedReason('get', 'https://fonts.googleapis.com/css2'), null);
  for (const rpc of READ_RPCS) assert.equal(blockedReason('POST', `${SB}/rest/v1/rpc/${rpc}`), null, rpc);
});

test('guarda: pedidos, pagos, eventos y cualquier escritura se cortan', () => {
  for (const [m, u] of [
    ['POST', `${SB}/rest/v1/rpc/create_catalog_order_dedup`],
    ['POST', `${SB}/rest/v1/rpc/create_order_atomic`],
    ['POST', `${SB}/rest/v1/rpc/verify_storefront_password`],
    ['POST', `${SB}/rest/v1/rpc/subscribe_newsletter`],
    ['GET', `${SB}/rest/v1/rpc/get_storefront_by_slug`],
    ['POST', `${SB}/functions/v1/create-preference`],
    ['GET', `${SB}/functions/v1/track-event`],
    ['POST', `${SB}/functions/v1/gocuotas-checkout`],
    ['POST', `${SB}/rest/v1/storefront_events`],
    ['PATCH', `${SB}/rest/v1/companies?id=eq.x`],
    ['DELETE', `${SB}/rest/v1/carts`],
    ['PUT', 'https://example.com/x'],
    ['POST', 'https://www.facebook.com/tr'],
  ]) {
    assert.notEqual(blockedReason(m, u), null, `${m} ${u}`);
  }
});

// ── 4. Guardas estáticas ──────────────────────────────────────────────────────
test('App.tsx: la plantilla se monta sólo por decideTemplateApp y detrás del interruptor', () => {
  const app = code('src/App.tsx');
  assert.match(app, /const TemplateApp = import\.meta\.env\.DEV \|\| TEMPLATE_APPS_ENABLED\s*\?/);
  assert.match(app, /if \(TEMPLATE_APPS_ENABLED\) return <StoreSurface \/>;/);
  assert.match(app, /decideTemplateApp\(\{\s*enabled: TEMPLATE_APPS_ENABLED,/);
  // El único otro camino a TemplateApp es la vista previa de desarrollo.
  const usos = app.match(/<TemplateApp\b[^>]*>/g) ?? [];
  assert.deepEqual(usos.sort(), ['<TemplateApp id={devTemplate} devPreview />', '<TemplateApp id={kit} />'].sort());
});

test('TemplateApp: el selector de desarrollo sólo en DEV; la analítica, sólo fuera de la vista previa de desarrollo', () => {
  const t = code('src/templates/TemplateApp.tsx');
  assert.match(t, /\{import\.meta\.env\.DEV && devPreview && <PreviewSwitcher/);
  assert.match(t, /\{!devPreview && \(\s*<>\s*<Analytics \/>\s*<MetaPixelPageView \/>\s*<StorefrontAnalytics \/>\s*<\/>\s*\)\}/);
  assert.equal((t.match(/<Analytics \/>/g) ?? []).length, 1, 'una sola vez');
});

test('vista previa del diseñador: guarda sólo enmarcada, detrás del interruptor, importada antes que App', () => {
  const g = code('src/lib/templatePreviewGuard.ts');
  assert.match(g, /if \(TEMPLATE_APPS_ENABLED && typeof window !== 'undefined' && framedKitPreviewRequest\(\)\)/);
  assert.match(g, /window\.parent === window\) return false/);
  assert.doesNotMatch(g, /localStorage|sessionStorage|supabase/);
  const main = code('src/main.tsx');
  const i = main.indexOf("import './lib/devTemplate';");
  const j = main.indexOf("import './lib/templatePreviewGuard';");
  const k = main.indexOf("import App from './App';");
  assert.ok(i >= 0 && j > i && k > j, 'orden de imports en main.tsx');
});

test('caché de config v24', () => {
  assert.match(code('src/context/StoreProvider.tsx'), /procurva_store_config_v24:/);
});
