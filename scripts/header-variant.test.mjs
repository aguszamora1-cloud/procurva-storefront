// Pruebas de la elección del armado de encabezado (src/lib/headerVariant.ts sobre
// el contrato de src/lib/storeTemplates.ts, esquema 2) y de las piezas puras de
// Inline: navOverflow (cuántas entradas entran antes de "Más") y logoMetrics (el
// tamaño óptico del logo, con imágenes sintéticas). P0-2 B3, recuperado de F1.1b.
//
// Corre con `npm run test:header`. headerVariant.ts lee import.meta.env, así que
// se empaqueta con esbuild (como scripts/store-templates.test.mjs) con
// import.meta.env = {}: DEV es undefined, igual que en producción.
//
// Si existe dist/ (después de `npm run build`), verifica además que el pedido de
// desarrollo `pc_dev_header` NO quedó en el bundle de producción y que Inline va
// en un chunk aparte (no en el índice).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(repoRoot, 'node_modules/.cache/header-variant-test');

mkdirSync(CACHE_DIR, { recursive: true });
const outfile = resolve(CACHE_DIR, `header-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `export * from './src/lib/headerVariant.ts'; export * from './src/lib/storeTemplates.ts';
      export * from './src/components/header/navOverflow.ts'; export * from './src/components/header/logoMetrics.ts';`,
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
const {
  resolveHeaderLayout,
  parseDevHeader,
  resolveTemplateHeader,
  HEADER_LAYOUTS,
  STORE_TEMPLATES,
  STORE_TEMPLATES_SCHEMA,
  fitCount,
  bandGrid,
  classifyBackground,
  inkBox,
  logoLayout,
  parseCssColor,
} = await import(pathToFileURL(outfile).href);

/** Definiciones de prueba: NUNCA en el registro; se pasan explícitas. */
const def = (id, version, components) => ({ id, version, name: id, patch: {}, ...(components === undefined ? {} : { components }) });
const REGISTRY = [
  def('con-inline', 1, { header: { layout: 'inline' } }),
  def('con-stacked', 1, { header: { layout: 'stacked' } }),
  def('sin-armados', 1, undefined),
  def('layout-basura', 1, { header: { layout: 'diagonal' } }),
];

test('esquema 2, tres armados y registro vacío', () => {
  assert.equal(STORE_TEMPLATES_SCHEMA, 2);
  assert.equal(STORE_TEMPLATES.length, 0);
  assert.deepEqual([...HEADER_LAYOUTS], ['classic', 'inline', 'stacked']);
});

test('sin pedido de desarrollo, resolveHeaderLayout es exactamente el contrato', () => {
  for (const ref of [null, undefined, {}, { id: 'no-existe', version: 1 }, { id: 'con-inline', version: 2 }, { id: 'con-inline', version: 1 }, { id: 'con-stacked', version: 1 }, { id: 'sin-armados', version: 1 }, { id: 'layout-basura', version: 1 }]) {
    assert.equal(resolveHeaderLayout(ref, REGISTRY, null), resolveTemplateHeader(ref, REGISTRY), JSON.stringify(ref));
  }
  assert.equal(resolveHeaderLayout({ id: 'con-inline', version: 1 }, REGISTRY, null), 'inline');
  assert.equal(resolveHeaderLayout({ id: 'con-inline', version: 1 }), 'classic', 'el registro real está vacío');
  assert.equal(resolveHeaderLayout(null, REGISTRY, null), 'classic');
});

test('pedido de desarrollo: gana sobre la plantilla, sólo layouts del contrato', () => {
  assert.equal(resolveHeaderLayout({ id: 'con-stacked', version: 1 }, REGISTRY, 'inline'), 'inline');
  assert.equal(resolveHeaderLayout(null, REGISTRY, 'inline'), 'inline');
  assert.equal(resolveHeaderLayout(null, REGISTRY, 'classic'), 'classic');
  assert.equal(parseDevHeader('?pc_dev_header=inline'), 'inline');
  assert.equal(parseDevHeader('?pc_dev_header=stacked'), 'stacked');
  assert.equal(parseDevHeader('?pc_dev_header=classic&x=1'), 'classic');
  assert.equal(parseDevHeader('?x=1&pc_dev_header=inline'), 'inline');
  assert.equal(parseDevHeader('?pc_dev_header=Inline'), null);
  assert.equal(parseDevHeader('?pc_dev_header=statement'), null);
  assert.equal(parseDevHeader('?pc_dev_header=<script>'), null);
  assert.equal(parseDevHeader('?pc_dev_header='), null);
  assert.equal(parseDevHeader('?pc_header=inline'), null);
  assert.equal(parseDevHeader('?pc_template=inline'), null);
  assert.equal(parseDevHeader(''), null);
});

test('fuera de vite (DEV no es true) no hay pedido de desarrollo: el default es el contrato', () => {
  // El módulo se cargó con import.meta.env = {}: el default de `dev` es null.
  assert.equal(resolveHeaderLayout({ id: 'con-inline', version: 1 }, REGISTRY), 'inline');
  assert.equal(resolveHeaderLayout(null, REGISTRY), 'classic');
});

test('headerVariant.ts: el pedido de desarrollo está detrás de import.meta.env.DEV y no toca storage', () => {
  const src = readFileSync(resolve(repoRoot, 'src/lib/headerVariant.ts'), 'utf8');
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.match(codigo, /import\.meta\.env\.DEV && typeof window !== 'undefined' \? parseDevHeader\(window\.location\.search\) : null/);
  assert.doesNotMatch(codigo, /localStorage|sessionStorage|fetch\(|supabase/);
});

test('fitCount: todas si entran; si no, las que quepan delante de "Más"', () => {
  // 3 entradas de 100 con gap 20 = 340.
  assert.equal(fitCount([100, 100, 100], 340, 60, 20), 3, 'justo');
  assert.equal(fitCount([100, 100, 100], 1000, 60, 20), 3);
  // No entran las 3: con "Más" (60) y su gap, 2 entradas = 220 + 20 + 60 = 300.
  assert.equal(fitCount([100, 100, 100], 339, 60, 20), 2);
  assert.equal(fitCount([100, 100, 100], 300, 60, 20), 2);
  assert.equal(fitCount([100, 100, 100], 299, 60, 20), 1);
  assert.equal(fitCount([100, 100, 100], 50, 60, 20), 0, 'sólo "Más"');
  assert.equal(fitCount([], 500, 60, 20), 0);
  // Sin medir todavía (0, negativo, NaN): no esconde nada.
  assert.equal(fitCount([100, 100], 0, 60, 20), 2);
  assert.equal(fitCount([100, 100], -5, 60, 20), 2);
  assert.equal(fitCount([100, 100], NaN, 60, 20), 2);
});

test('bandGrid (Stacked): columnas de 6, hasta 4; con muchas crecen las filas', () => {
  assert.deepEqual(bandGrid(0), { columns: 0, rows: 0 });
  assert.deepEqual(bandGrid(3), { columns: 1, rows: 3 }, 'pocas: una columna angosta');
  assert.deepEqual(bandGrid(6), { columns: 1, rows: 6 });
  assert.deepEqual(bandGrid(7), { columns: 2, rows: 4 }, 'se reparten parejo');
  assert.deepEqual(bandGrid(18), { columns: 3, rows: 6 });
  assert.deepEqual(bandGrid(24), { columns: 4, rows: 6 });
  assert.deepEqual(bandGrid(40), { columns: 4, rows: 10 }, 'tope de 4 columnas');
});

test('Stacked sin la fila de secciones del teléfono (no aprobada) ni su parámetro', () => {
  const src = readFileSync(resolve(repoRoot, 'src/components/header/variants/StackedHeader.tsx'), 'utf8');
  assert.doesNotMatch(src, /aria-label="Secciones"|pc_dev_header_sections|devHeaderSections|h-\[42px\]/);
  const hv = readFileSync(resolve(repoRoot, 'src/lib/headerVariant.ts'), 'utf8');
  assert.doesNotMatch(hv, /pc_dev_header_sections|devHeaderSections/);
});

// ── Logo óptico (logoMetrics) con imágenes sintéticas ─────────────────────────
/** Imagen RGBA w×h con fondo `bg` y rectángulos de contenido; `noise` simula un JPEG. */
function makeImage(w, h, bg, rects = [], noise = 0) {
  const data = new Uint8ClampedArray(w * h * 4);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2 * noise;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = bg;
      for (const r of rects) if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) c = r.c;
      const i = (y * w + x) * 4;
      const n = c === bg && bg[3] === 255 ? rnd() : 0;
      data[i] = c[0] + n;
      data[i + 1] = c[1] + n;
      data[i + 2] = c[2] + n;
      data[i + 3] = c[3];
    }
  }
  return { data, width: w, height: h };
}
const CLEAR = [0, 0, 0, 0];
const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];
const INK = [20, 20, 20, 255];
const SLOT = { area: 3000, minH: 18, maxH: 44, maxW: 200, strictMaxH: 56 };
const metricsOf = (img) => {
  const background = classifyBackground(img);
  const ink = inkBox(img, background);
  return ink ? { ink, background, fileAspect: img.width / img.height } : null;
};
/** El archivo se escala entero y sin deformar; la caja queda adentro del archivo escalado. */
function assertNoDistortion(layout, fileAspect) {
  assert.ok(Math.abs(layout.imgW / layout.imgH - fileAspect) < 0.02, 'deformado');
  assert.ok(layout.left <= 0 && layout.top <= 0, 'desplazamiento positivo');
  assert.ok(-layout.left + layout.boxW <= layout.imgW + 0.05 && -layout.top + layout.boxH <= layout.imgH + 0.05, 'caja fuera del archivo');
}

test('logo transparente horizontal: modo óptico, contenido con la presencia objetivo', () => {
  const img = makeImage(400, 400, CLEAR, [{ x: 50, y: 160, w: 300, h: 80, c: INK }]); // contenido 3,75:1 con mucho aire
  const m = metricsOf(img);
  assert.equal(m.background.kind, 'transparent');
  assert.ok(m.ink.x < 50 / 400 && m.ink.x > 40 / 400, 'margen de seguridad');
  const l = logoLayout(m, SLOT, [255, 255, 255], 80);
  assert.equal(l.mode, 'optical');
  assert.ok(l.boxH >= SLOT.minH && l.boxH <= SLOT.maxH && l.boxW <= SLOT.maxW);
  assert.ok(Math.abs(l.boxW * l.boxH - SLOT.area) / SLOT.area < 0.05, 'área objetivo');
  assertNoDistortion(l, m.fileAspect);
  // El mismo logo, cargado con un tope de caja de 56: antes el contenido quedaba en 56*80/400 = 11 px de alto.
  assert.ok(l.boxH * (80 / (80 + 2 * 8)) > 20, 'contenido legible');
});

test('logo con fondo blanco (JPEG con ruido): óptico sólo sobre encabezado blanco', () => {
  const img = makeImage(300, 300, WHITE, [{ x: 30, y: 105, w: 240, h: 90, c: [200, 30, 30, 255] }], 8);
  const m = metricsOf(img);
  assert.equal(m.background.kind, 'solid');
  assert.equal(logoLayout(m, SLOT, [255, 255, 255], 80).mode, 'optical');
  assert.equal(logoLayout(m, SLOT, [250, 248, 245], 80).mode, 'optical', 'blanco roto dentro de la tolerancia');
  const red = logoLayout(m, SLOT, [200, 16, 46], 80);
  assert.deepEqual(red, { mode: 'strict', imgH: 56 }, 'encabezado de color: estricto (el blanco no se oculta)');
  assert.equal(logoLayout(m, SLOT, null, 80).mode, 'strict', 'sin fondo de encabezado conocido: estricto');
});

test('logo con fondo negro: óptico sólo sobre encabezado negro', () => {
  const img = makeImage(240, 160, BLACK, [{ x: 40, y: 10, w: 160, h: 140, c: [240, 240, 240, 255] }]);
  const m = metricsOf(img);
  assert.equal(m.background.kind, 'solid');
  assert.equal(logoLayout(m, SLOT, [0, 0, 0], 67).mode, 'optical');
  assert.equal(logoLayout(m, SLOT, [255, 255, 255], 67).mode, 'strict');
});

test('proporciones: cuadrado topa en alto, 12:1 topa en ancho, 1:4 topa en alto', () => {
  const square = metricsOf(makeImage(200, 200, CLEAR, [{ x: 20, y: 20, w: 160, h: 160, c: INK }]));
  const sq = logoLayout(square, SLOT, null, 80);
  assert.equal(sq.boxH, SLOT.maxH);
  // Contenido 12:1 con aire a los costados (si tocara los bordes, el borde no sería parejo → estricto).
  const wide = metricsOf(makeImage(640, 100, CLEAR, [{ x: 20, y: 25, w: 600, h: 50, c: INK }]));
  const wd = logoLayout(wide, SLOT, null, 80);
  assert.equal(wd.boxW, SLOT.maxW);
  assert.ok(wd.boxH < SLOT.minH, 'el ancho manda: no se desborda para llegar al mínimo');
  const tall = metricsOf(makeImage(100, 420, CLEAR, [{ x: 25, y: 10, w: 50, h: 400, c: INK }]));
  const tl = logoLayout(tall, SLOT, null, 80);
  assert.equal(tl.boxH, SLOT.maxH);
  for (const [m, l] of [[square, sq], [wide, wd], [tall, tl]]) assertNoDistortion(l, m.fileAspect);
});

test('detección ambigua → estricto', () => {
  // Borde mezclado: mitad transparente, mitad blanca.
  const mixed = makeImage(100, 100, CLEAR, [{ x: 0, y: 0, w: 100, h: 50, c: WHITE }, { x: 40, y: 60, w: 20, h: 20, c: INK }]);
  assert.equal(classifyBackground(mixed).kind, 'ambiguous');
  assert.equal(logoLayout(metricsOf(mixed), SLOT, [255, 255, 255], 80).mode, 'strict');
  // Borde semitransparente (sombra o degradé).
  const soft = makeImage(100, 100, [255, 255, 255, 120], [{ x: 40, y: 40, w: 20, h: 20, c: INK }]);
  assert.equal(classifyBackground(soft).kind, 'ambiguous');
  // Borde de dos colores opacos distintos (foto o logo a sangre).
  const photo = makeImage(100, 100, WHITE, [{ x: 0, y: 0, w: 100, h: 30, c: [30, 90, 200, 255] }]);
  assert.equal(classifyBackground(photo).kind, 'ambiguous');
  // Vacío: sin contenido.
  assert.equal(metricsOf(makeImage(50, 50, CLEAR)), null);
  // Sin métricas (CORS, error de lectura): estricto con el tope de la barra.
  assert.deepEqual(logoLayout(null, SLOT, [255, 255, 255], 80), { mode: 'strict', imgH: 56 });
  assert.deepEqual(logoLayout(null, SLOT, [255, 255, 255], 40), { mode: 'strict', imgH: 40 });
});

test('contenido casi del color del fondo no se oculta (tolerancia estricta para el contenido)', () => {
  // Texto gris muy claro (#ececec) bajo la marca, sobre blanco: tiene que quedar adentro de la caja.
  const img = makeImage(300, 300, WHITE, [
    { x: 60, y: 100, w: 180, h: 60, c: INK },
    { x: 80, y: 200, w: 140, h: 14, c: [236, 236, 236, 255] },
  ]);
  const m = metricsOf(img);
  assert.equal(m.background.kind, 'solid');
  assert.ok(m.ink.y + m.ink.h >= 214 / 300, 'el gris claro quedó afuera');
});

test('parseCssColor: sólo colores opacos', () => {
  assert.deepEqual(parseCssColor('rgb(255, 255, 255)'), [255, 255, 255]);
  assert.deepEqual(parseCssColor('rgba(10, 20, 30, 1)'), [10, 20, 30]);
  assert.deepEqual(parseCssColor('rgb(10 20 30)'), [10, 20, 30]);
  assert.equal(parseCssColor('rgba(0, 0, 0, 0)'), null);
  assert.equal(parseCssColor('rgba(10, 20, 30, 0.5)'), null);
  assert.equal(parseCssColor('transparent'), null);
});

// ── Bundle de producción ──────────────────────────────────────────────────────
/** Marcas que sólo existen en el código de Inline y Stacked (no en Classic). */
const INLINE_MARKS = ['data-logo-mode', 'pc_logo_metrics_v1:', '"Principal"', 'procurva:logo-analysis'];
/**
 * Marcas que sólo existen en StackedHeader. (`data-sticky-anchor` no: Layout,
 * que está en el índice, lo busca para el sticky.)
 */
const STACKED_MARKS = ['grid-cols-[200px_minmax(0,1fr)_200px]', 'h-[112px]'];

test('build de producción: sin pc_dev_header, e Inline en un chunk aparte (no en el índice)', (t) => {
  const dist = process.env.HEADER_DIST ? resolve(process.env.HEADER_DIST) : resolve(repoRoot, 'dist');
  const assets = resolve(dist, 'assets');
  if (!existsSync(assets)) {
    t.skip(`no hay ${assets}: correr después de npm run build (o pasar HEADER_DIST)`);
    return;
  }
  const js = readdirSync(assets).filter((f) => f.endsWith('.js'));
  const contenido = Object.fromEntries(js.map((f) => [f, readFileSync(resolve(assets, f), 'utf8')]));
  const conDev = js.filter((f) => contenido[f].includes('pc_dev_header'));
  assert.deepEqual(conDev, [], `el pedido de desarrollo quedó en el bundle: ${conDev.join(', ')}`);
  const index = js.filter((f) => /^index-[\w-]+\.js$/.test(f));
  assert.equal(index.length, 1, `un único índice: ${index.join(', ')}`);
  for (const mark of INLINE_MARKS) {
    assert.ok(!contenido[index[0]].includes(mark), `Inline entró al índice (${mark})`);
  }
  // Las piezas de Inline (logo óptico, navegación) pueden quedar en un chunk compartido
  // con Stacked: lo que importa es que NINGUNA esté en el índice.
  const conInline = js.filter((f) => f !== index[0] && INLINE_MARKS.every((m) => contenido[f].includes(m)));
  assert.ok(conInline.length >= 1, 'las piezas de Inline tienen que estar en algún chunk aparte');
  const inlineChunk = js.filter((f) => /^InlineHeader-[\w-]+\.js$/.test(f));
  const stackedChunk = js.filter((f) => /^StackedHeader-[\w-]+\.js$/.test(f));
  assert.equal(inlineChunk.length, 1, `un chunk propio de Inline: ${inlineChunk.join(', ')}`);
  assert.equal(stackedChunk.length, 1, `un chunk propio de Stacked: ${stackedChunk.join(', ')}`);
  for (const mark of STACKED_MARKS) {
    const con = js.filter((f) => contenido[f].includes(mark));
    assert.deepEqual(con, stackedChunk, `${mark} sólo en el chunk de Stacked`);
  }
  const kb = (f) => (contenido[f].length / 1024).toFixed(1);
  t.diagnostic(`chunks: ${[...inlineChunk, ...stackedChunk, ...conInline.filter((f) => !inlineChunk.includes(f) && !stackedChunk.includes(f))].map((f) => `${f} ${kb(f)} kB`).join(' · ')}`);
});
