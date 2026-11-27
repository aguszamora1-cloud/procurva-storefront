/**
 * Guardas de Atelier 2 (A4c). Las plantillas no llaman al carrito directo: leen
 * la bolsa con useCartView (shared/ui), que no expone updateQty, removeItem ni
 * los ítems crudos. Mismo criterio que template-cart.test.mjs aplica a Atelier
 * 1, Distrito y Momentum, extendido a todos los archivos de atelier2/.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/templates/atelier2');
const files = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f));

test('Atelier 2 tiene archivos para revisar', () => {
  assert.ok(files.length >= 5, `sólo ${files.length} archivos en ${dir}`);
});

test('Atelier 2 no usa el carrito directo (useCart, updateQty, removeItem, CartContext)', () => {
  for (const f of files) {
    const src = readFileSync(resolve(dir, f), 'utf8');
    assert.doesNotMatch(src, /\buseCart\s*\(/, `${f}: usar useCartView() de shared/ui`);
    // sessionStorage/localStorage.removeItem es del navegador, no del carrito.
    assert.doesNotMatch(src, /(?<!Storage\.)\b(updateQty|removeItem)\b/, `${f}: la bolsa se edita con las acciones de cada fila (useCartView)`);
    assert.doesNotMatch(src, /from\s+['"]@\/context\/CartContext['"]/, `${f}: no importar CartContext`);
  }
});
