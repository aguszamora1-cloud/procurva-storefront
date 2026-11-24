// Pruebas de la infraestructura de plantillas de tienda (src/lib/storeTemplates.ts).
//
// Corre con `npm run test:templates`. storeConfig.ts importa un .tsx y usa rutas
// sin extensión, así que Node no lo puede cargar directo (a diferencia de
// typography.ts): se empaqueta con el esbuild que ya trae Vite a
// node_modules/.cache (ignorado por git) y se importa de ahí.
//
// Lo que garantizan:
//   1. GOLDEN: normalizeStoreConfig da EXACTAMENTE lo mismo que el código anterior
//      a F0 para cada payload de ejemplo (scripts/fixtures/store-templates/). El
//      golden se generó con `--write-golden` sobre el commit base, ANTES de tocar
//      storeConfig.ts. No regenerarlo para "arreglar" una diferencia: una
//      diferencia es justamente un cambio en tiendas existentes.
//   2. Una referencia de plantilla inválida no cambia nada ni pierde configuración.
//   3. El registro cumple sus invariantes (ids, versiones, claves permitidas) y
//      las versiones publicadas son inmutables (scripts/store-templates.lock.json).
//   4. La vista previa sólo se pide con pc_preview=1, y sólo elige ids del registro.
//
// Flags (deliberados, no para el día a día):
//   --write-golden  regenera el golden. SÓLO sobre el código base.
//   --lock-new      agrega al lock las versiones publicadas nuevas. Nunca cambia
//                   ni borra una entrada existente.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = resolve(repoRoot, 'scripts/fixtures/store-templates');
const GOLDEN_PATH = resolve(FIXTURES, 'normalize-golden.json');
const LOCK_PATH = resolve(repoRoot, 'scripts/store-templates.lock.json');
const CACHE_DIR = resolve(repoRoot, 'node_modules/.cache/store-templates-test');

/** Empaqueta un entry TS a un .mjs dentro del repo (para que resuelva react) y lo importa. */
async function load(name, contents) {
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
    jsx: 'automatic',
    define: { 'import.meta.env': '{}' },
    logLevel: 'silent',
  });
  return import(pathToFileURL(outfile).href);
}

const clone = (v) => JSON.parse(JSON.stringify(v));
const { payloads } = JSON.parse(readFileSync(resolve(FIXTURES, 'payloads.json'), 'utf8'));

// ── Modo generación del golden ────────────────────────────────────────────────
if (process.argv.includes('--write-golden')) {
  const { normalizeStoreConfig } = await load('golden', `export { normalizeStoreConfig } from './src/lib/storeConfig.ts';`);
  const out = {};
  for (const [name, p] of Object.entries(payloads)) out[name] = clone(normalizeStoreConfig(clone(p)));
  writeFileSync(GOLDEN_PATH, JSON.stringify(out, null, 2) + '\n');
  console.log(`golden escrito: ${Object.keys(out).length} payloads → ${GOLDEN_PATH}`);
  process.exit(0);
}

const mod = await load(
  'templates',
  `export { normalizeStoreConfig } from './src/lib/storeConfig.ts';
   export * from './src/lib/storeTemplates.ts';
   export { isTemplatePreviewAuthorized, previewTemplate, requestedTemplate } from './src/lib/templatePreview.ts';`,
);
const {
  normalizeStoreConfig,
  isTemplatePreviewAuthorized,
  previewTemplate,
  requestedTemplate,
  STORE_TEMPLATES,
  TEMPLATE_PATCH_KEYS,
  isValidTemplateId,
  parseTemplateRef,
  findTemplate,
  resolveTemplateRef,
  parseTemplatePreview,
  templatePatch,
  applyTemplate,
  canonicalTemplateJson,
  STORE_TEMPLATES_SCHEMA,
  HEADER_LAYOUTS,
  DEFAULT_HEADER_LAYOUT,
  isHeaderLayout,
  isValidTemplateComponents,
  isValidTemplateDefinition,
  normalizeTemplateComponents,
  templateHeaderLayout,
  resolveTemplateHeader,
  APP_KITS,
  isAppKit,
  templateAppKit,
  resolveTemplateApp,
} = mod;
/** sha256 del JSON canónico de una definición: es lo que guarda el lock. */
const templateHash = (def) => createHash('sha256').update(canonicalTemplateJson(def)).digest('hex');
const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));

/** La config normalizada sin la clave nueva, para comparar contra el golden. */
function withoutTemplate(config) {
  const c = clone(config);
  delete c.template;
  return c;
}

/** Definición de prueba: NO está en el registro, se pasa explícita. */
const FIXTURE_DEF = {
  id: 'prueba-f0',
  version: 1,
  name: 'Prueba F0',
  patch: { corners: 'square', button_corners: 'pill', color_primary: '#123456', font_heading: 'Inter' },
};
const FIXTURE_REGISTRY = [FIXTURE_DEF, { ...FIXTURE_DEF, version: 2, patch: { corners: 'soft' } }];

// ── 1. Golden ─────────────────────────────────────────────────────────────────
test('golden: los payloads de ejemplo normalizan igual que antes de F0', () => {
  assert.deepEqual(Object.keys(golden).sort(), Object.keys(payloads).sort(), 'el golden no cubre los mismos payloads');
  for (const [name, p] of Object.entries(payloads)) {
    const config = normalizeStoreConfig(clone(p));
    assert.equal(config.template, null, `${name}: sin plantilla guardada, template tiene que ser null`);
    assert.deepEqual(withoutTemplate(config), golden[name], `${name}: la config normalizada cambió`);
  }
});

// ── 2. Referencias inválidas ──────────────────────────────────────────────────
const BAD_REFS = [
  undefined,
  null,
  'clasica',
  42,
  true,
  [],
  {},
  { id: 'clasica' },
  { version: 1 },
  { id: 'Con Mayus', version: 1 },
  { id: '-guion-inicial', version: 1 },
  { id: 'a'.repeat(41), version: 1 },
  { id: 'ok', version: 0 },
  { id: 'ok', version: -1 },
  { id: 'ok', version: 1.5 },
  { id: 'ok', version: '1' },
  { id: 'ok', version: 1000 },
  { id: 'no-existe', version: 1 },
  { id: '<script>', version: 1 },
  { id: '__proto__', version: 1 },
];

test('referencia inválida o inexistente: misma config que sin plantilla, sin mutar la entrada', () => {
  for (const [name, p] of Object.entries(payloads)) {
    for (const bad of BAD_REFS) {
      const payload = clone(p);
      payload.settings = { ...(payload.settings ?? {}), template: bad };
      const before = JSON.stringify(payload);
      const config = normalizeStoreConfig(payload);
      assert.equal(JSON.stringify(payload), before, `${name}: normalize mutó el payload`);
      assert.equal(config.template, null, `${name} ${JSON.stringify(bad)}: tenía que dar null`);
      assert.deepEqual(withoutTemplate(config), golden[name], `${name} ${JSON.stringify(bad)}: cambió la config`);
    }
  }
});

test('parseTemplateRef: sólo forma válida; resolveTemplateRef: sólo lo que existe', () => {
  for (const bad of BAD_REFS.filter((r) => !(r && r.id === 'no-existe'))) {
    assert.equal(parseTemplateRef(bad), null, JSON.stringify(bad));
  }
  assert.deepEqual(parseTemplateRef({ id: 'no-existe', version: 1 }), { id: 'no-existe', version: 1 });
  // Campos extra (snapshot para deshacer, fecha) se toleran y no se devuelven.
  assert.deepEqual(parseTemplateRef({ id: 'ok', version: 3, applied_at: 'x', previous: {} }), { id: 'ok', version: 3 });
  assert.equal(resolveTemplateRef({ id: 'no-existe', version: 1 }), null);
  assert.deepEqual(resolveTemplateRef({ id: 'prueba-f0', version: 2 }, FIXTURE_REGISTRY), { id: 'prueba-f0', version: 2 });
  assert.equal(resolveTemplateRef({ id: 'prueba-f0', version: 3 }, FIXTURE_REGISTRY), null, 'versión que no existe');
});

// ── 3. Registro ───────────────────────────────────────────────────────────────
// T6: las tres primeras plantillas publicadas. Cualquier otra cosa en el registro
// (una versión nueva, un patch, otro kit) tiene que pasar por esta prueba a mano.
const PUBLICADAS = [
  { id: 'atelier', version: 1, name: 'Atelier', patch: {}, components: { app: { kit: 'atelier' } } },
  { id: 'distrito', version: 1, name: 'Distrito', patch: {}, components: { app: { kit: 'distrito' } } },
  { id: 'momentum', version: 1, name: 'Momentum', patch: {}, components: { app: { kit: 'momentum' } } },
];

test('T6: el registro tiene exactamente Atelier, Distrito y Momentum v1, sin patch y cada una con su kit', () => {
  assert.deepEqual(clone(STORE_TEMPLATES), PUBLICADAS);
  for (const def of STORE_TEMPLATES) {
    assert.deepEqual(def.patch, {}, `${def.id}: una tienda completa no pisa settings`);
    assert.equal(templateAppKit(def), def.id);
    assert.equal(templateHeaderLayout(def), 'classic', `${def.id}: sin armado de encabezado (el kit trae el suyo)`);
  }
});

test('registro: ids, versiones, nombres y claves válidos', () => {
  const seen = new Set();
  for (const def of STORE_TEMPLATES) {
    const key = `${def.id}@${def.version}`;
    assert.ok(isValidTemplateId(def.id), `${key}: id inválido`);
    assert.ok(Number.isInteger(def.version) && def.version >= 1 && def.version <= 999, `${key}: versión inválida`);
    assert.ok(typeof def.name === 'string' && def.name.trim(), `${key}: sin nombre`);
    assert.ok(!seen.has(key), `${key}: repetida`);
    seen.add(key);
    for (const k of Object.keys(def.patch)) assert.ok(TEMPLATE_PATCH_KEYS.includes(k), `${key}: clave no permitida ${k}`);
    assert.deepEqual(clone(def.patch), def.patch, `${key}: el patch no es JSON puro`);
    // P0-2 B2: la definición entera (con `components`) tiene que validar.
    assert.ok(isValidTemplateDefinition(def), `${key}: definición inválida (esquema 2)`);
    assert.ok(isHeaderLayout(templateHeaderLayout(def)), `${key}: encabezado no admitido`);
  }
});

// Lo que una plantilla NUNCA puede fijar en F0. Tipografía v1/v2 y Mejorado,
// composición del home, contenido, precios y comportamiento.
const FORBIDDEN = [
  'template',
  'typography_version',
  'typography_title_case',
  'sections_order',
  'section_max_items',
  'section_titles',
  'product_layout',
  'menu_items',
  'badges',
  'price_display',
  'price_emphasis',
  'cash_label',
  'card_installments',
  'card_payment_text',
  'hide_out_of_stock',
  'hide_out_of_stock_variants',
  'purchase_flow_enabled',
  'hero_enabled',
  'hero_mode',
  'hero_title',
  'hero_subtitle',
  'hero_cta_text',
  'hero_cta_link',
  'hero_image_url',
  'hero_image_url_mobile',
  'banner_url',
  'banner_url_mobile',
  'logo_url',
  'logo_height',
  'favicon_url',
  'top_bar_text',
  'storefront_announcement',
  'sale_mode',
];

test('claves permitidas: ninguna de contenido, composición, precios ni tipografía', () => {
  for (const k of FORBIDDEN) assert.ok(!TEMPLATE_PATCH_KEYS.includes(k), `clave prohibida en la lista: ${k}`);
  for (const k of TEMPLATE_PATCH_KEYS) {
    // Prender o apagar secciones es composición: queda para una fase posterior.
    assert.ok(!/^section_(?!title_align$|display_modes$)/.test(k), `toggle de sección en la lista: ${k}`);
  }
  assert.equal(new Set(TEMPLATE_PATCH_KEYS).size, TEMPLATE_PATCH_KEYS.length, 'claves repetidas');
});

test('versiones publicadas inmutables (lock)', () => {
  const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
  const current = Object.fromEntries(STORE_TEMPLATES.map((d) => [`${d.id}@${d.version}`, templateHash(d)]));
  for (const [key, hash] of Object.entries(lock.versions)) {
    assert.ok(key in current, `${key} estaba publicada y desapareció del registro (no se borra: se agrega una versión nueva)`);
    assert.equal(current[key], hash, `${key} cambió después de publicada: hay que crear ${key.split('@')[0]}@<versión nueva>`);
  }
  const nuevas = Object.keys(current).filter((k) => !(k in lock.versions));
  if (process.argv.includes('--lock-new') && nuevas.length) {
    for (const k of nuevas) lock.versions[k] = current[k];
    writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n');
    console.log(`lock: agregadas ${nuevas.join(', ')}`);
  } else {
    assert.deepEqual(nuevas, [], `versiones sin registrar en el lock (correr con --lock-new): ${nuevas.join(', ')}`);
  }
});

test('templateHash: estable ante el orden de las claves y sensible a cualquier cambio', () => {
  const a = templateHash({ id: 'x', version: 1, name: 'X', patch: { corners: 'square', font_body: 'Inter' } });
  const b = templateHash({ name: 'X', patch: { font_body: 'Inter', corners: 'square' }, version: 1, id: 'x' });
  const c = templateHash({ id: 'x', version: 1, name: 'X', patch: { corners: 'soft', font_body: 'Inter' } });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

// ── 4. Vista previa ───────────────────────────────────────────────────────────
test('vista previa: sólo con pc_preview=1 y un valor bien formado', () => {
  const cases = [
    ['', null],
    ['?pc_template=prueba-f0', null], // sin pc_preview: un visitante no puede pedirla
    ['?preview=1&pc_template=prueba-f0', null], // la del onboarding no cuenta
    ['?pc_preview=0&pc_template=prueba-f0', null],
    ['?pc_preview=1', null],
    ['?pc_preview=1&pc_template=', null],
    ['?pc_preview=1&pc_template=Prueba', null],
    ['?pc_preview=1&pc_template=prueba-f0@0', null],
    ['?pc_preview=1&pc_template=prueba-f0@1000', null],
    ['?pc_preview=1&pc_template=prueba-f0@1@2', null],
    ['?pc_preview=1&pc_template=%3Cscript%3E', null],
    [`?pc_preview=1&pc_template=${'a'.repeat(41)}`, null],
    ['?pc_preview=1&pc_template=prueba-f0', { id: 'prueba-f0', version: null }],
    ['?pc_preview=1&pc_template=prueba-f0@2', { id: 'prueba-f0', version: 2 }],
    ['?pc_template=prueba-f0@2&pc_preview=1', { id: 'prueba-f0', version: 2 }],
  ];
  for (const [search, expected] of cases) assert.deepEqual(parseTemplatePreview(search), expected, search);
});

test('findTemplate: elige sólo del registro; sin versión, la más alta', () => {
  assert.equal(findTemplate({ id: 'prueba-f0', version: null }), null, 'el registro real está vacío');
  assert.equal(findTemplate({ id: 'prueba-f0', version: null }, FIXTURE_REGISTRY).version, 2);
  assert.equal(findTemplate({ id: 'prueba-f0', version: 1 }, FIXTURE_REGISTRY).version, 1);
  assert.equal(findTemplate({ id: 'prueba-f0', version: 9 }, FIXTURE_REGISTRY), null);
  assert.equal(findTemplate(null, FIXTURE_REGISTRY), null);
});

// ── 5. Aplicar (lo usa la vista previa en memoria y, en F2, el ERP al guardar) ──
test('applyTemplate: sólo pisa claves permitidas, no muta y deja la referencia', () => {
  const settings = clone(payloads['minorista-completa-v1'].settings);
  const before = JSON.stringify(settings);
  const evil = { ...FIXTURE_DEF, patch: { ...FIXTURE_DEF.patch, price_display: 'all', typography_version: 'v2', sections_order: [] } };
  const out = applyTemplate(settings, evil);
  assert.equal(JSON.stringify(settings), before, 'mutó los settings de entrada');
  assert.deepEqual(out.template, { id: 'prueba-f0', version: 1 });
  for (const [k, v] of Object.entries(FIXTURE_DEF.patch)) assert.deepEqual(out[k], v, `no aplicó ${k}`);
  // Lo no permitido queda como estaba, aunque la definición lo traiga.
  for (const [k, v] of Object.entries(settings)) {
    if (!(k in FIXTURE_DEF.patch)) assert.deepEqual(out[k], v, `tocó ${k}`);
  }
  assert.equal('typography_version' in out, false, 'agregó typography_version');
  assert.deepEqual(templatePatch(evil), FIXTURE_DEF.patch);
  // Settings nulos (tienda sin configurar) no rompen.
  assert.deepEqual(applyTemplate(null, FIXTURE_DEF).corners, 'square');
});

test('applyTemplate + normalize: la tipografía v1/v2, Mejorado y los precios no cambian', () => {
  assert.ok(Object.values(golden).some((g) => g.priceEmphasis === 'card'), 'el golden tiene que cubrir price_emphasis=card');
  for (const [name, p] of Object.entries(payloads)) {
    const payload = clone(p);
    payload.settings = applyTemplate(payload.settings, FIXTURE_DEF);
    const config = normalizeStoreConfig(payload);
    assert.equal(config.typographyVersion, golden[name].typographyVersion, `${name}: cambió la versión tipográfica`);
    assert.equal(config.titleCase, golden[name].titleCase, `${name}: cambió la capitalización`);
    // P0-1: precio destacado (#16) y qué precios se muestran no son de la plantilla.
    assert.equal(config.priceEmphasis, golden[name].priceEmphasis, `${name}: cambió priceEmphasis`);
    assert.equal(config.priceDisplay, golden[name].priceDisplay, `${name}: cambió priceDisplay`);
    assert.equal(config.corners, 'square', `${name}: no aplicó corners`);
    // La definición de prueba no está en el registro real: la referencia no resuelve.
    assert.equal(config.template, null);
  }
});

// ── 5b. Autorización de la vista previa (P0-1) ────────────────────────────────
test('vista previa de plantilla: sólo con el handshake completo del canal (hello + ack)', () => {
  assert.equal(isTemplatePreviewAuthorized(null), false, 'visita pública: sin canal');
  assert.equal(isTemplatePreviewAuthorized(undefined), false);
  assert.equal(isTemplatePreviewAuthorized({ state: 'public', acked: false }), false, 'pc_preview=1 sin marco');
  assert.equal(isTemplatePreviewAuthorized({ state: 'pending', acked: false }), false, 'enmarcada, sin hello');
  assert.equal(isTemplatePreviewAuthorized({ state: 'preview', acked: false }), false, 'hello sin ack: todavía no');
  assert.equal(isTemplatePreviewAuthorized({ state: 'public', acked: true }), false, 'estado incoherente: no');
  assert.equal(isTemplatePreviewAuthorized({ state: 'preview', acked: 1 }), false, 'acked tiene que ser true estricto');
  assert.equal(isTemplatePreviewAuthorized({ state: 'preview', acked: true }), true);
});

test('vista previa de plantilla: fuera del navegador no hay pedido ni plantilla', () => {
  assert.equal(requestedTemplate(), null);
  assert.equal(previewTemplate(), null);
});

test('templatePreview.ts: la autorización sale del canal, nunca de la URL ni de quién enmarca', async () => {
  const src = readFileSync(resolve(repoRoot, 'src/lib/templatePreview.ts'), 'utf8');
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.match(codigo, /getPreviewChannel\(\)/);
  assert.match(codigo, /ch\.state === 'preview' && ch\.acked === true/);
  assert.doesNotMatch(codigo, /isDesignerFrame|ancestorOrigins|referrer|isPreviewMode|sessionStorage|localStorage/);
});

// ── 6. Guardas estáticas ──────────────────────────────────────────────────────
test('storeTemplates.ts es autocontenido (espejo byte-idéntico en el ERP)', () => {
  const src = readFileSync(resolve(repoRoot, 'src/lib/storeTemplates.ts'), 'utf8');
  assert.ok(!/^\s*import\s/m.test(src), 'no puede importar nada: se copia tal cual a procurva2');
  assert.ok(
    !/^\s*(export\s+)?(declare\s+)?(const\s+)?(enum|namespace)\s/m.test(src),
    'sin enum ni namespace: Node lo importa con type stripping',
  );
});

test('storeTemplates.ts se importa directo con Node (sin empaquetar)', async () => {
  const direct = await import(pathToFileURL(resolve(repoRoot, 'src/lib/storeTemplates.ts')).href);
  assert.equal(direct.STORE_TEMPLATES.length, 3);
  assert.deepEqual([...direct.APP_KITS], ['atelier', 'distrito', 'momentum']);
  assert.deepEqual([...direct.TEMPLATE_PATCH_KEYS], [...TEMPLATE_PATCH_KEYS]);
});

test('JSON canónico: claves ordenadas en todos los niveles', () => {
  assert.equal(
    canonicalTemplateJson({ version: 1, patch: { b: { y: 1, x: 2 }, a: [3, { d: 1, c: 2 }] }, name: 'X', id: 'x' }),
    '{"id":"x","name":"X","patch":{"a":[3,{"c":2,"d":1}],"b":{"x":2,"y":1}},"version":1}',
  );
});

// ── 7. Encabezados (P0-2 B2: contrato `components.header` y resolución) ────────
/** Definiciones de prueba: NUNCA en el registro; se pasan explícitas. */
const HDR = (id, version, components, extra = {}) => ({ id, version, name: id, patch: {}, ...extra, ...(components === undefined ? {} : { components }) });
const HDR_REGISTRY = [
  HDR('con-classic', 1, { header: { layout: 'classic' } }),
  HDR('con-inline', 1, { header: { layout: 'inline' } }),
  HDR('con-stacked', 1, { header: { layout: 'stacked' } }),
  HDR('con-stacked', 2, { header: { layout: 'inline' } }),
  HDR('esquema-1', 1, undefined),
  HDR('sin-header', 1, {}),
  HDR('con-patch', 1, { header: { layout: 'inline' } }, { patch: { corners: 'square' } }),
];
/** Lo que NO es un encabezado válido: cada uno tiene que dar Classic. */
const BAD_COMPONENTS = [
  null,
  'inline',
  42,
  [],
  [{ layout: 'inline' }],
  { header: null },
  { header: 'inline' },
  { header: [] },
  { header: {} },
  { header: { layout: 'statement' } },
  { header: { layout: 'Inline' } },
  { header: { layout: ' inline' } },
  { header: { layout: 42 } },
  { header: { layout: null } },
  { header: { layout: ['inline'] } },
  { header: { layout: 'inline', tone: 'refined' } },
  { header: { layout: 'stacked', tone: 'default' } },
  { header: { layout: 'inline', extra: true } },
  { header: { layout: 'inline' }, hero: { layout: 'band' } },
  { header: { layout: 'inline' }, tone: 'refined' },
  { headers: { layout: 'inline' } },
];

test('contrato: esquema 3, exactamente classic | inline | stacked, sin tonos ni statement', () => {
  assert.equal(STORE_TEMPLATES_SCHEMA, 3);
  assert.deepEqual([...HEADER_LAYOUTS], ['classic', 'inline', 'stacked']);
  assert.equal(DEFAULT_HEADER_LAYOUT, 'classic');
  for (const l of HEADER_LAYOUTS) assert.ok(isHeaderLayout(l));
  for (const v of ['statement', 'Classic', 'CLASSIC', '', null, undefined, 1, ['inline'], { layout: 'inline' }]) assert.equal(isHeaderLayout(v), false, JSON.stringify(v));
  const src = readFileSync(resolve(repoRoot, 'src/lib/storeTemplates.ts'), 'utf8');
  assert.doesNotMatch(src, /statement|refined|\btone\b|HEADER_TONES|HeaderTone/i, 'statement / tone no forman parte del contrato');
});

test('contrato válido: cada definición resuelve el encabezado que pide', () => {
  for (const def of HDR_REGISTRY) assert.ok(isValidTemplateDefinition(def), def.id);
  assert.equal(templateHeaderLayout(HDR_REGISTRY[0]), 'classic');
  assert.equal(templateHeaderLayout(HDR_REGISTRY[1]), 'inline');
  assert.equal(templateHeaderLayout(HDR_REGISTRY[2]), 'stacked');
  assert.equal(resolveTemplateHeader({ id: 'con-inline', version: 1 }, HDR_REGISTRY), 'inline');
  assert.equal(resolveTemplateHeader({ id: 'con-stacked', version: 1 }, HDR_REGISTRY), 'stacked');
  assert.equal(resolveTemplateHeader({ id: 'con-stacked', version: 2 }, HDR_REGISTRY), 'inline', 'cada versión tiene su encabezado');
  assert.equal(resolveTemplateHeader({ id: 'con-patch', version: 1 }, HDR_REGISTRY), 'inline', 'patch y components conviven');
  // Campos extra de la referencia guardada (snapshot para deshacer, fecha) no molestan.
  assert.equal(resolveTemplateHeader({ id: 'con-inline', version: 1, applied_at: 'x', previous: { corners: 'soft' } }, HDR_REGISTRY), 'inline');
  assert.deepEqual(normalizeTemplateComponents({ header: { layout: 'stacked' } }), { header: { layout: 'stacked' } });
  assert.deepEqual(normalizeTemplateComponents(undefined), {});
  assert.deepEqual(normalizeTemplateComponents({}), {});
});

test('fallback a Classic: sin plantilla, esquema 1 y sin encabezado', () => {
  for (const raw of [undefined, null, '', 0, false, {}, []]) assert.equal(resolveTemplateHeader(raw, HDR_REGISTRY), 'classic', JSON.stringify(raw));
  assert.equal(templateHeaderLayout(null), 'classic');
  assert.equal(templateHeaderLayout(undefined), 'classic');
  assert.equal(resolveTemplateHeader({ id: 'esquema-1', version: 1 }, HDR_REGISTRY), 'classic', 'definición del esquema 1 (sin components)');
  assert.equal(resolveTemplateHeader({ id: 'sin-header', version: 1 }, HDR_REGISTRY), 'classic', 'components sin header');
});

test('identificadores desconocidos y referencias mal formadas: Classic', () => {
  for (const bad of BAD_REFS) assert.equal(resolveTemplateHeader(bad, HDR_REGISTRY), 'classic', JSON.stringify(bad));
  assert.equal(resolveTemplateHeader({ id: 'con-inline', version: 2 }, HDR_REGISTRY), 'classic', 'versión que no existe');
  assert.equal(resolveTemplateHeader({ id: 'con-inline', version: null }, HDR_REGISTRY), 'classic', 'una referencia guardada necesita versión exacta');
  assert.equal(resolveTemplateHeader({ id: 'CON-INLINE', version: 1 }, HDR_REGISTRY), 'classic');
});

test('encabezados desconocidos o mal formados: la definición es inválida y da Classic', () => {
  for (const comp of BAD_COMPONENTS) {
    const def = HDR('rara', 1, comp);
    assert.equal(isValidTemplateComponents(comp), false, JSON.stringify(comp));
    assert.equal(isValidTemplateDefinition(def), false, JSON.stringify(comp));
    assert.equal(templateHeaderLayout(def), 'classic', JSON.stringify(comp));
    assert.equal(resolveTemplateHeader({ id: 'rara', version: 1 }, [def]), 'classic', JSON.stringify(comp));
    assert.deepEqual(normalizeTemplateComponents(comp), {}, JSON.stringify(comp));
  }
  // Un encabezado heredado por prototipo no es parte del contrato: se ignora (= sin header).
  const heredado = { __proto__: { header: { layout: 'inline' } } };
  assert.equal(isValidTemplateComponents(heredado), true, 'sin claves propias es {}');
  assert.deepEqual(normalizeTemplateComponents(heredado), {});
  assert.equal(templateHeaderLayout(HDR('heredada', 1, heredado)), 'classic');
  const layoutHeredado = { header: { __proto__: { layout: 'inline' } } };
  assert.equal(isValidTemplateComponents(layoutHeredado), false, 'layout heredado no vale');
  assert.equal(templateHeaderLayout(HDR('heredada', 1, layoutHeredado)), 'classic');
  // Definiciones rotas por fuera de components también caen a Classic.
  const rotas = [
    { ...HDR('ok', 1, { header: { layout: 'inline' } }), id: 'Con Mayus' },
    { ...HDR('ok', 1, { header: { layout: 'inline' } }), version: 0 },
    { ...HDR('ok', 1, { header: { layout: 'inline' } }), name: '' },
    { ...HDR('ok', 1, { header: { layout: 'inline' } }), patch: null },
    { ...HDR('ok', 1, { header: { layout: 'inline' } }), patch: { price_display: 'all' } },
    null,
    undefined,
    'inline',
    [],
  ];
  for (const def of rotas) {
    assert.equal(isValidTemplateDefinition(def), false, JSON.stringify(def));
    assert.equal(templateHeaderLayout(def), 'classic', JSON.stringify(def));
  }
});

test('registro real: las referencias de prueba dan Classic', () => {
  for (const ref of [{ id: 'con-inline', version: 1 }, { id: 'con-stacked', version: 1 }, { id: 'prueba-f0', version: 1 }, null]) {
    assert.equal(resolveTemplateHeader(ref), 'classic', JSON.stringify(ref));
  }
});

test('las definiciones de prueba no están en el registro real ni en el archivo', () => {
  const src = readFileSync(resolve(repoRoot, 'src/lib/storeTemplates.ts'), 'utf8');
  for (const def of [...HDR_REGISTRY, ...FIXTURE_REGISTRY]) {
    assert.equal(findTemplate({ id: def.id, version: def.version }), null, def.id);
    assert.ok(!src.includes(`'${def.id}'`), `${def.id} aparece en storeTemplates.ts`);
  }
});

test('ausencia de escrituras y efectos: funciones puras, entrada intacta, módulo sin acceso a red ni storage', () => {
  const src = readFileSync(resolve(repoRoot, 'src/lib/storeTemplates.ts'), 'utf8');
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(codigo, /localStorage|sessionStorage|indexedDB|document\.|window\.|fetch\(|XMLHttpRequest|supabase|navigator\.|import\.meta/);
  const deep = (v) => { if (v && typeof v === 'object') { Object.freeze(v); for (const k of Object.keys(v)) deep(v[k]); } return v; };
  const registry = deep(clone(HDR_REGISTRY));
  const ref = deep({ id: 'con-stacked', version: 1, previous: { a: 1 } });
  const antes = JSON.stringify([registry, ref]);
  assert.equal(resolveTemplateHeader(ref, registry), 'stacked');
  assert.deepEqual(normalizeTemplateComponents(registry[2].components), { header: { layout: 'stacked' } });
  assert.notEqual(normalizeTemplateComponents(registry[2].components).header, registry[2].components.header, 'devuelve una copia');
  assert.equal(JSON.stringify([registry, ref]), antes, 'mutó la entrada');
});

test('compatibilidad: configs guardadas antes del esquema 2 normalizan igual y resuelven Classic', () => {
  for (const [name, p] of Object.entries(payloads)) {
    const config = normalizeStoreConfig(clone(p));
    assert.deepEqual(withoutTemplate(config), golden[name], `${name}: la config normalizada cambió con el esquema 2`);
    assert.equal(resolveTemplateHeader(config.template), 'classic', `${name}: config.template de la tienda`);
    assert.equal(resolveTemplateHeader(p.settings?.template), 'classic', `${name}: settings.template crudo`);
  }
  // Una entrada de caché anterior puede no traer `template` (undefined): Classic, sin romper.
  assert.equal(resolveTemplateHeader(undefined), 'classic');
  // El JSON canónico (lock de versiones) incluye `components`: cambiar el encabezado cambia la huella.
  const a = canonicalTemplateJson(HDR('x', 1, { header: { layout: 'inline' } }));
  const b = canonicalTemplateJson(HDR('x', 1, { header: { layout: 'stacked' } }));
  assert.notEqual(a, b);
  assert.equal(canonicalTemplateJson(HDR('x', 1, undefined)), '{"id":"x","name":"x","patch":{},"version":1}', 'una definición del esquema 1 conserva su huella');
});

// ── 8. Esquema 3: tienda completa (components.app) ─────────────────────────────
test('esquema 3: exactamente atelier | distrito | momentum', () => {
  assert.deepEqual([...APP_KITS], ['atelier', 'distrito', 'momentum']);
  for (const k of APP_KITS) assert.ok(isAppKit(k));
  for (const v of ['Atelier', 'classic', '', null, undefined, 1, ['atelier'], { kit: 'atelier' }, 'atelier ']) assert.equal(isAppKit(v), false, JSON.stringify(v));
});

const BAD_APPS = [
  { app: null },
  { app: 'atelier' },
  { app: [] },
  { app: {} },
  { app: { kit: 'classic' } },
  { app: { kit: 'Atelier' } },
  { app: { kit: 'otra' } },
  { app: { kit: 1 } },
  { app: { kit: 'atelier', extra: true } },
  { app: { kits: 'atelier' } },
  { app: { kit: 'atelier' }, tone: 'x' },
  { app: { __proto__: { kit: 'atelier' } } },
];

test('esquema 3: app válida resuelve su kit; mal formada invalida la definición y da Classic', () => {
  const ok = HDR('con-app', 1, { app: { kit: 'distrito' } });
  assert.ok(isValidTemplateDefinition(ok));
  assert.equal(templateAppKit(ok), 'distrito');
  assert.equal(resolveTemplateApp({ id: 'con-app', version: 1 }, [ok]), 'distrito');
  assert.deepEqual(normalizeTemplateComponents({ app: { kit: 'momentum' } }), { app: { kit: 'momentum' } });
  assert.deepEqual(normalizeTemplateComponents({ header: { layout: 'inline' }, app: { kit: 'atelier' } }), { header: { layout: 'inline' }, app: { kit: 'atelier' } });
  for (const comp of BAD_APPS) {
    const def = HDR('rara', 1, comp);
    assert.equal(isValidTemplateComponents(comp), false, JSON.stringify(comp));
    assert.equal(templateAppKit(def), null, JSON.stringify(comp));
    assert.equal(resolveTemplateApp({ id: 'rara', version: 1 }, [def]), null, JSON.stringify(comp));
    assert.deepEqual(normalizeTemplateComponents(comp), {}, JSON.stringify(comp));
  }
  // Una definición con app pero rota por fuera (patch no permitido) tampoco monta nada.
  assert.equal(templateAppKit({ ...ok, patch: { price_display: 'all' } }), null);
});

test('esquema 3: el registro real resuelve los tres kits sólo con id y versión exactos', () => {
  assert.equal(resolveTemplateApp({ id: 'atelier', version: 1 }), 'atelier');
  assert.equal(resolveTemplateApp({ id: 'distrito', version: 1, previous: { a: 1 }, applied_at: '2026-11-23' }), 'distrito');
  assert.equal(resolveTemplateApp({ id: 'momentum', version: 1 }), 'momentum');
  for (const bad of [...BAD_REFS, { id: 'atelier', version: 2 }, { id: 'atelier', version: null }, { id: 'atelier' }, { id: 'ATELIER', version: 1 }, { id: 'classic', version: 1 }, null, undefined, 'atelier']) {
    assert.equal(resolveTemplateApp(bad), null, JSON.stringify(bad));
  }
  // Sin app: ninguna definición de prueba (esquemas 1 y 2) monta un kit.
  for (const def of HDR_REGISTRY) assert.equal(templateAppKit(def), null, def.id);
});

test('esquema 3: aplicar una tienda completa sólo guarda la referencia y normalize la resuelve', () => {
  for (const [name, p] of Object.entries(payloads)) {
    for (const def of STORE_TEMPLATES) {
      const payload = clone(p);
      const antes = clone(payload.settings ?? {});
      payload.settings = applyTemplate(payload.settings, def);
      assert.deepEqual({ ...payload.settings, template: undefined }, { ...antes, template: undefined }, `${name} ${def.id}: pisó settings`);
      const config = normalizeStoreConfig(payload);
      assert.deepEqual(config.template, { id: def.id, version: 1 }, `${name} ${def.id}`);
      assert.deepEqual(withoutTemplate(config), golden[name], `${name} ${def.id}: cambió el resto de la config`);
      assert.equal(resolveTemplateApp(config.template), def.id);
      assert.equal(resolveTemplateHeader(config.template), 'classic');
    }
  }
});

test('integridad del espejo: con PROCURVA2_DIR, el ERP tiene el mismo archivo byte a byte', () => {
  const erp = process.env.PROCURVA2_DIR;
  if (!erp) return;
  const lf = (s) => s.replace(/\r\n/g, '\n');
  const a = lf(readFileSync(resolve(repoRoot, 'src/lib/storeTemplates.ts'), 'utf8'));
  const b = lf(readFileSync(resolve(erp, 'components/catalog/editor/storeTemplates.ts'), 'utf8'));
  assert.equal(a, b, 'storeTemplates.ts divergió entre tienda y ERP');
});
