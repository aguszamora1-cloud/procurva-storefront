// FIN0 · Correcciones visuales de Atelier, Distrito y Momentum (25/11).
//
// Corre con `npm run test:template-fin0`. Mismo patrón que template-app.test.mjs:
// se empaqueta con el esbuild de Vite y se importa.
//
// Lo que garantizan:
//   1. logoWeight: el peso óptico del logo respeta la proporción (cuadrado 1,
//      apaisado < 1, vertical > 1), está acotado y no explota con medidas raras.
//   2. merchantPurchaseSteps: «Así funciona tu compra» en una plantilla sólo con
//      los pasos que escribió el comercio; los de fábrica (promesas fijas) no.
//   3. Guardas estáticas: las plantillas no montan PurchaseFlow de Classic (que
//      marca etapas como hechas), las reseñas de la ficha exigen reseñas
//      verificadas, el carrusel de testimonios no avanza solo ni inventa
//      estrellas, y Classic (componentes y páginas) no se tocó.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(repoRoot, 'node_modules/.cache/template-fin0-test');

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
    define: { 'import.meta.env': '{}' },
    logLevel: 'silent',
  });
  return import(pathToFileURL(outfile).href);
}

const { logoWeight, merchantPurchaseSteps, DEFAULT_PURCHASE_FLOW } = await load(
  'facts',
  `export * from './src/templates/shared/storeFacts.ts'; export { DEFAULT_PURCHASE_FLOW } from './src/lib/storeConfig.ts';`,
);

const src = (p) => readFileSync(resolve(repoRoot, p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// ── 1. Logo ───────────────────────────────────────────────────────────────────
test('logoWeight: cuadrado 1, apaisado menos, vertical más', () => {
  assert.equal(logoWeight(1500, 1500), 1);
  assert.equal(logoWeight(1200, 800), 0.816); // 3:2 (Desde Abajo)
  assert.equal(logoWeight(4800, 1280), 0.516); // 3,75:1 (ELEVEL)
  assert.ok(logoWeight(600, 1200) > 1.4); // vertical 1:2
});

test('logoWeight: acotado y sin medidas válidas da 1', () => {
  assert.equal(logoWeight(10000, 100), logoWeight(600, 100)); // tope 6:1
  assert.equal(logoWeight(100, 10000), logoWeight(40, 100)); // tope 0,4
  for (const [w, h] of [[0, 100], [100, 0], [NaN, 100], [-5, 10], [undefined, undefined]]) assert.equal(logoWeight(w, h), 1);
});

// ── 2. Pasos de compra ────────────────────────────────────────────────────────
test('merchantPurchaseSteps: los pasos de fábrica no se muestran', () => {
  assert.deepEqual(merchantPurchaseSteps({ purchaseFlowEnabled: true, purchaseFlowSteps: DEFAULT_PURCHASE_FLOW }), []);
  // Una COPIA idéntica es del comercio (los guardó así): se respeta su texto.
  const copia = DEFAULT_PURCHASE_FLOW.map((s) => ({ ...s }));
  assert.equal(merchantPurchaseSteps({ purchaseFlowEnabled: true, purchaseFlowSteps: copia }).length, copia.length);
});

test('merchantPurchaseSteps: apagado no muestra nada; nombres vacíos afuera', () => {
  const propios = [
    { name: 'Comprás online', detail: '', state: 'done' },
    { name: '  ', detail: 'x', state: 'pending' },
    { name: 'Te lo enviamos', detail: 'Por cadete', state: 'current' },
  ];
  assert.deepEqual(merchantPurchaseSteps({ purchaseFlowEnabled: false, purchaseFlowSteps: propios }), []);
  assert.deepEqual(
    merchantPurchaseSteps({ purchaseFlowEnabled: true, purchaseFlowSteps: propios }).map((s) => s.name),
    ['Comprás online', 'Te lo enviamos'],
  );
});

// ── 3. Guardas estáticas ──────────────────────────────────────────────────────
const TPL = ['atelier/Atelier.tsx', 'distrito/Distrito.tsx', 'momentum/Momentum.tsx'].map((f) => `src/templates/${f}`);

test('las plantillas no montan PurchaseFlow ni el estado de los pasos', () => {
  for (const f of [...TPL, 'src/templates/shared/ClassicExtras.tsx']) {
    assert.doesNotMatch(code(f), /PurchaseFlow\b(?!Step)/, f);
  }
  const extras = code('src/templates/shared/ClassicExtras.tsx');
  assert.match(extras, /merchantPurchaseSteps\(config\)/);
  assert.doesNotMatch(extras, /step\.state|s\.state/);
});

test('reseñas de la ficha: sólo con reseñas verificadas del producto', () => {
  const extras = code('src/templates/shared/ClassicExtras.tsx');
  assert.match(extras, /useProductReviews\(/);
  assert.match(extras, /reviews\.length === 0\) return null/);
});

test('testimonios de las plantillas: sin avance automático ni estrellas inventadas', () => {
  const t = code('src/templates/shared/Testimonials.tsx');
  assert.doesNotMatch(t, /requestAnimationFrame|setInterval|setTimeout/);
  assert.doesNotMatch(t, /rating \?\? 5|\?\? 5/);
  assert.match(t, /t\.rating != null && t\.rating > 0/);
  assert.match(t, /useTestimonials\(\)/); // mismos datos que Classic
  // Sólo Distrito lo pide; las otras siguen con la sección de Classic.
  assert.match(code('src/templates/distrito/Distrito.tsx'), /testimonials: 'template'/);
  for (const f of [TPL[0], TPL[2]]) assert.doesNotMatch(code(f), /testimonials: 'template'/, f);
});

/**
 * Únicos cambios aprobados en Classic desde la base, cada uno con su contenido
 * EXACTO (SHA-256 del texto con saltos de línea \n). Cualquier otro archivo, o
 * cualquier cambio en estos, vuelve a fallar. No excluye carpetas.
 *  - PR #28 de main («Dinero en cuenta» a precio de tarjeta, 5bf0b4c): llega al
 *    integrar P1.1 sobre main. El diff de cada archivo desde la base es
 *    idéntico, línea por línea, al de PR #28 (storeConfig.ts +3, types.ts +8,
 *    Checkout.tsx +7/−4). Aprobado por Agus el 26/11/2026.
 *  - Orden de la ficha compartido con las plantillas (lib/productLayoutPlan.ts):
 *    ProductDetail.tsx recorre el plan; el comportamiento es idéntico
 *    (scripts/product-layout-plan.test.mjs). Aprobado por Agus el 26/11/2026.
 */
const CLASSIC_APPROVED = {
  'src/lib/storeConfig.ts': '474df7a16f7026a31219132172c683a6ee095a8362d109a2f5772ef01786fd2a',
  'src/lib/types.ts': '8d1229437a473383c2e50164c6b50d0e163e16fe46c3d51b866d57674f4bf1c8',
  'src/pages/Checkout.tsx': '7181a252783e2ac8d20373c222a0cc1e068d692fdca0936201c2eebbd8519324',
  'src/pages/ProductDetail.tsx': '9dd70f91b2bf7395b3e821d52db3a604450ec8801dd766af031f1d71701a0cff',
  'src/lib/productLayoutPlan.ts': '73978dd8a5bfc76a4ccc60d32bec893d4bed1d514b1271f1d5628a93ecd87617',
};
const contentHash = (file) =>
  createHash('sha256').update(readFileSync(resolve(repoRoot, file), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

test('Classic no cambia: componentes, páginas, lib y contextos intactos', () => {
  const base = process.env.FIN0_BASE || '6feaeac';
  let changed;
  try {
    changed = execFileSync('git', ['diff', '--name-only', base, '--', 'src/components', 'src/pages', 'src/lib', 'src/context', 'src/hooks', 'src/App.tsx', 'src/main.tsx'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
  } catch {
    return; // sin git (copia suelta): la guarda no aplica
  }
  const notApproved = changed
    .split('\n')
    .filter(Boolean)
    .filter((f) => !(f in CLASSIC_APPROVED && contentHash(f) === CLASSIC_APPROVED[f]));
  assert.equal(notApproved.join('\n'), '', `archivos de Classic cambiados desde ${base} (fuera de lo aprobado o con otro contenido):\n${notApproved.join('\n')}`);
});
