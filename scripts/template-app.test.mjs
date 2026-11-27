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

const { decideTemplateApp, needsOutfitsProbe, TEMPLATE_APPS_ENABLED, OUTFITS_PROBE_TIMEOUT_MS } = await load('gate', `export * from './src/lib/templateApp.ts';`);
const on = await load('gate-on', `export { TEMPLATE_APPS_ENABLED } from './src/lib/templateApp.ts';`, '{"VITE_TEMPLATE_APPS":"1"}');
const raro = await load('gate-raro', `export { TEMPLATE_APPS_ENABLED } from './src/lib/templateApp.ts';`, '{"VITE_TEMPLATE_APPS":"true"}');
const { blockedReason, READ_RPCS } = await load('guard', `export * from './src/lib/writeGuard.ts';`);

const src = (p) => readFileSync(resolve(repoRoot, p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// ── 1. Decisión ───────────────────────────────────────────────────────────────
// Superficies de outfits apagadas: no hace falta leer nada.
const OK = { enabled: true, template: { id: 'atelier', version: 1 }, storeType: 'retail', outfitsSection: false, mostrarOutfit: false, outfits: 'sin-leer' };

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

test('outfits: con una superficie prendida, sin leer = pantalla de carga; con outfits activos = Classic', () => {
  const ACTIVOS = [{ active: true }];
  for (const [campo, valores] of [['outfitsSection', [true, undefined, null, 1, 'false']], ['mostrarOutfit', [true, undefined, null, 0, 'false']]]) {
    for (const v of valores) {
      const i = { ...OK, [campo]: v };
      assert.equal(needsOutfitsProbe(i), true, `${campo}=${JSON.stringify(v)} pide leer`);
      assert.deepEqual(decideTemplateApp({ ...i, outfits: 'sin-leer' }), { kit: null, block: 'verificando' });
      assert.deepEqual(decideTemplateApp({ ...i, outfits: 'leyendo' }), { kit: null, block: 'verificando' });
      assert.deepEqual(decideTemplateApp({ ...i, outfits: ACTIVOS }), { kit: null, block: 'outfits' }, `${campo}=${JSON.stringify(v)}`);
      assert.deepEqual(decideTemplateApp({ ...i, outfits: [] }), { kit: 'atelier', block: null }, `${campo} prendido sin outfits activos: monta`);
    }
  }
});

test('outfits: error o demora de la lectura = Classic; nunca plantilla sin leer', () => {
  const i = { ...OK, mostrarOutfit: true };
  assert.deepEqual(decideTemplateApp({ ...i, outfits: 'error' }), { kit: null, block: 'outfits-sin-verificar' });
  for (const raro of [null, undefined, '', 0, {}, 'ok']) {
    assert.equal(decideTemplateApp({ ...i, outfits: raro }).kit, null, JSON.stringify(raro));
  }
  assert.ok(OUTFITS_PROBE_TIMEOUT_MS > 0 && OUTFITS_PROBE_TIMEOUT_MS <= 3000);
  // Filas inactivas (la lectura no las trae) no cuentan; las activas cuentan sin mirar prendas.
  assert.equal(decideTemplateApp({ ...i, outfits: [{ active: false }] }).kit, 'atelier');
  assert.equal(decideTemplateApp({ ...i, outfits: [{ active: true, items: 0 }] }).kit, 'atelier', 'look sin prendas no se ve en Classic');
  assert.equal(decideTemplateApp({ ...i, outfits: [{ active: true }] }).kit, null);
});

test('sin plantilla, mayorista o interruptor apagado: NUNCA se leen los outfits', () => {
  const prendido = { ...OK, outfitsSection: true, mostrarOutfit: true };
  assert.equal(needsOutfitsProbe(prendido), true);
  assert.equal(needsOutfitsProbe({ ...prendido, template: null }), false);
  assert.equal(needsOutfitsProbe({ ...prendido, template: { id: 'atelier', version: 9 } }), false);
  assert.equal(needsOutfitsProbe({ ...prendido, storeType: 'wholesale' }), false);
  assert.equal(needsOutfitsProbe({ ...prendido, enabled: false }), false);
  assert.equal(needsOutfitsProbe(OK), false, 'superficies apagadas: no hace falta');
  for (const outfits of ['sin-leer', 'error', [{ active: true }], []]) {
    assert.equal(decideTemplateApp({ ...prendido, template: null, outfits }).block, 'sin-plantilla');
    assert.equal(decideTemplateApp({ ...prendido, storeType: 'wholesale', outfits }).block, 'mayorista');
    assert.equal(decideTemplateApp({ ...prendido, enabled: false, outfits }).block, 'apagado');
  }
});

test('todas las combinaciones: sólo una monta', () => {
  let montadas = 0;
  for (const enabled of [true, false])
    for (const template of [OK.template, { id: 'atelier', version: 9 }, null])
      for (const storeType of ['retail', 'wholesale'])
        for (const outfitsSection of [false, true])
          for (const mostrarOutfit of [false, true])
            for (const outfits of ['sin-leer', 'error', [{ active: true }], []]) {
              const d = decideTemplateApp({ enabled, template, storeType, outfitsSection, mostrarOutfit, outfits });
              if (d.kit) montadas++;
              const sinSuperficie = outfitsSection === false && mostrarOutfit === false;
              const esperado = enabled && template === OK.template && storeType === 'retail' && (sinSuperficie || (Array.isArray(outfits) && outfits.length === 0));
              assert.equal(Boolean(d.kit), esperado, JSON.stringify({ enabled, template, storeType, outfitsSection, mostrarOutfit, outfits }));
            }
  // Sin superficies: monta con cualquier lectura (4). Con alguna superficie (3 combinaciones): sólo con lectura vacía.
  assert.equal(montadas, 4 + 3);
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
  assert.match(app, /const gate = \{\s*enabled: TEMPLATE_APPS_ENABLED,/);
  assert.match(app, /mostrarOutfit: config\.complementaryBlock\.mostrarOutfit,/);
  assert.match(app, /useTemplateOutfitsProbe\(companyId, needsOutfitsProbe\(gate\)\)/);
  assert.match(app, /decideTemplateApp\(\{ \.\.\.gate, outfits \}\)/);
  assert.match(app, /if \(block === 'verificando'\) return <LoadingScreen \/>;/);
  // La lectura: la misma tabla pública que Classic, sólo activos, una fila, con tope de tiempo y sin guardarla.
  const h = code('src/hooks/useTemplateOutfitsProbe.ts');
  assert.match(h, /\.from\('catalog_outfits'\)\s*\.select\('id, active'\)\s*\.eq\('company_id', companyId\)\s*\.eq\('active', true\)\s*\.limit\(1\)/);
  assert.match(h, /if \(!needed\) return;/);
  // El primer resultado es definitivo: una respuesta tardía o repetida no lo cambia.
  assert.match(h, /setProbe\(\(prev\) => \(pendiente\(prev\) \? next : prev\)\)/);
  assert.match(h, /cancelled = true;\s*clearTimeout\(timer\);/);
  assert.match(h, /OUTFITS_PROBE_TIMEOUT_MS/);
  assert.doesNotMatch(h, /localStorage|sessionStorage|\.insert\(|\.update\(|\.rpc\(/);
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
