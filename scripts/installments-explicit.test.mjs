/**
 * installmentsExplicit (lib/storeConfig.ts): ¿el comercio guardó card_installments
 * o installmentsCount es el 3 por defecto?
 *
 *  1. Classic no cambia: la configuración normalizada con el storeConfig.ts de
 *     6feaeac (leído de git) y con el actual es IDÉNTICA salvo el campo nuevo,
 *     y el renglón de cuotas (installmentsLabel) también.
 *  2. Ausente, explícito, inválido y 3 configurado.
 *  3. Atelier 2 (facts.installmentsBacked) sólo anuncia cuotas confirmadas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(repoRoot, 'node_modules/.cache/installments-explicit-test');
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
   export { installmentsLabel } from './src/lib/utils.ts';
   export { installmentsBacked } from './src/templates/atelier2/facts.ts';`,
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
const VALUES = { ausente: undefined, 0: 0, 3: 3, 6: 6, 12: 12, '2.7': 2.7, texto3: '3', negativo: -1, nan: NaN, infinito: Infinity, nulo: null };
const settingsFor = (v, extra = {}) => {
  const s = { ...extra };
  if (v !== undefined) s.card_installments = v;
  return s;
};

test('Classic no cambia: misma configuración normalizada que 6feaeac, salvo installmentsExplicit', { skip: OLD ? false : 'sin git' }, () => {
  for (const [name, v] of Object.entries(VALUES)) {
    for (const extra of [{}, { card_payment_text: 'Hasta 6 cuotas con bancos' }, { price_display: 'contado' }]) {
      const a = OLD.normalizeStoreConfig(resolved(settingsFor(v, extra)));
      const { installmentsExplicit, ...b } = NEW.normalizeStoreConfig(resolved(settingsFor(v, extra)));
      assert.equal(typeof installmentsExplicit, 'boolean', name);
      assert.deepEqual(b, a, `card_installments=${name} ${JSON.stringify(extra)}`);
      for (const price of [0, 1000, 35715]) assert.equal(NEW.installmentsLabel(b, price), NEW.installmentsLabel(a, price));
    }
  }
});

test('ausente: el 3 es por defecto (no explícito)', () => {
  const c = NEW.normalizeStoreConfig(resolved({}));
  assert.equal(c.installmentsCount, 3);
  assert.equal(c.installmentsExplicit, false);
});

test('explícitos: 0, 3, 6, 12 y decimales guardados', () => {
  for (const [v, count] of [[0, 0], [3, 3], [6, 6], [12, 12], [2.7, 2]]) {
    const c = NEW.normalizeStoreConfig(resolved({ card_installments: v }));
    assert.equal(c.installmentsCount, count, String(v));
    assert.equal(c.installmentsExplicit, true, String(v));
  }
});

test('inválidos (texto, negativo, NaN, infinito, null): mismo 3 que hoy y no explícitos', () => {
  for (const v of ['3', -1, NaN, Infinity, null]) {
    const c = NEW.normalizeStoreConfig(resolved({ card_installments: v }));
    assert.equal(c.installmentsCount, 3, String(v));
    assert.equal(c.installmentsExplicit, false, String(v));
  }
});

test('los cinco casos: Classic muestra lo mismo que la base y Atelier 2 sólo lo explícito', { skip: OLD ? false : 'sin git' }, () => {
  // [caso, settings, explícito, Atelier 2 anuncia]
  const CASES = [
    ['clave ausente', {}, false, false],
    ['3 explícitas', { card_installments: 3 }, true, true],
    ['6 explícitas', { card_installments: 6 }, true, true],
    ['cero', { card_installments: 0 }, true, false],
    ['inválido (texto)', { card_installments: 'seis' }, false, false],
  ];
  for (const [name, s, explicit, shown] of CASES) {
    const now = NEW.normalizeStoreConfig(resolved(s));
    const base = OLD.normalizeStoreConfig(resolved(s));
    assert.equal(now.installmentsExplicit, explicit, name);
    assert.equal(NEW.installmentsBacked(now), shown, name);
    // Classic: el mismo renglón que antes, con cualquier precio.
    for (const price of [0, 999, 50000]) assert.equal(NEW.installmentsLabel(now, price), NEW.installmentsLabel(base, price), `${name} $${price}`);
  }
});

test('Atelier 2 sólo anuncia cuotas confirmadas', () => {
  const backed = (s) => NEW.installmentsBacked(NEW.normalizeStoreConfig(resolved(s)));
  assert.equal(backed({}), false, 'ausente (3 por defecto)');
  assert.equal(backed({ card_installments: 3 }), true, '3 guardado por el comercio');
  assert.equal(backed({ card_installments: 6 }), true, '6 guardado');
  assert.equal(backed({ card_installments: 0 }), false, '0 = no anunciar');
  assert.equal(backed({ card_installments: '3' }), false, 'texto: inválido');
  assert.equal(backed({ card_installments: -2 }), false, 'negativo: inválido');
  assert.equal(backed({ card_payment_text: 'Hasta 6 cuotas con bancos' }), true, 'texto escrito por el comercio');
  assert.equal(backed({ card_installments: 0, card_payment_text: 'Hasta 6 cuotas' }), false, '0 apaga también el texto');
  // Configuración en caché de antes del campo: no confirmada.
  assert.equal(NEW.installmentsBacked({ installmentsCount: 3, cardPaymentText: '' }), false);
});
