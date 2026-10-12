// Pruebas de la versión tipográfica v1/v2 (src/lib/typography.ts).
//
// Corre con `npm run test:typography`. Importa el .ts directo: Node >= 22.18
// / 23.6 le saca los tipos solo. NO está en `check`/`prebuild` a propósito: si
// el Node del build de Vercel fuera más viejo, el deploy se caería por un test.
//
// Qué garantiza:
//  1. Una tienda sin la clave (todas las existentes) es v1, y nada que no sea
//     exactamente 'v2' la saca de v1.
//  2. La vista previa sólo vale dentro del modo vista previa del ERP.
//  3. El interruptor general apaga v2 para todos, vista previa incluida.
//  4. En v1, ty() devuelve las clases de hoy sin tocar un carácter.
//  5. Ningún rol `ty-*` de globals.css puede aplicar fuera de data-typography="v2".

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  TYPOGRAPHY_ROLES,
  effectiveTypography,
  parseTypographyPreview,
  resolveTitleCase,
  resolveTypographyVersion,
  ty,
} from '../src/lib/typography.ts';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
};

// 1. Resolución de lo guardado ------------------------------------------------
test('sin clave o valor raro → v1', () => {
  for (const raw of [undefined, null, '', 'v1', 'V2', ' v2', 'v2 ', 'v3', 2, true, {}, []]) {
    assert.equal(resolveTypographyVersion(raw), 'v1', `valor ${JSON.stringify(raw)}`);
  }
});
test("sólo 'v2' exacto → v2", () => {
  assert.equal(resolveTypographyVersion('v2'), 'v2');
});
test('capitalización: default mayúsculas', () => {
  for (const raw of [undefined, null, '', 'upper', 'ORIGINAL', 'lower', 1]) {
    assert.equal(resolveTitleCase(raw), 'upper', `valor ${JSON.stringify(raw)}`);
  }
  assert.equal(resolveTitleCase('original'), 'original');
});

// 2. Vista previa -------------------------------------------------------------
const NONE = { version: null, titleCase: null };
test('fuera del modo vista previa, ?typo= no hace nada', () => {
  assert.deepEqual(parseTypographyPreview('?typo=v2&typo_case=original', false), NONE);
});
test('dentro del modo vista previa, se respeta', () => {
  assert.deepEqual(parseTypographyPreview('?pc_preview=1&typo=v2&typo_case=original', true), {
    version: 'v2',
    titleCase: 'original',
  });
  assert.deepEqual(parseTypographyPreview('?typo=v1', true), { version: 'v1', titleCase: null });
});
test('valores inválidos en la vista previa se ignoran', () => {
  assert.deepEqual(parseTypographyPreview('?typo=V2&typo_case=lower', true), NONE);
  assert.deepEqual(parseTypographyPreview('', true), NONE);
});

// 3. Lo que se pinta ----------------------------------------------------------
const V1 = { typographyVersion: 'v1', titleCase: 'upper' };
const V2 = { typographyVersion: 'v2', titleCase: 'upper' };
test('tienda v1 sin vista previa → v1', () => {
  assert.deepEqual(effectiveTypography(V1, NONE, true), { version: 'v1', titleCase: 'upper' });
});
test('tienda v2 → v2', () => {
  assert.equal(effectiveTypography(V2, NONE, true).version, 'v2');
});
test('la vista previa pisa lo guardado en las dos direcciones', () => {
  assert.equal(effectiveTypography(V1, { version: 'v2', titleCase: null }, true).version, 'v2');
  assert.equal(effectiveTypography(V2, { version: 'v1', titleCase: null }, true).version, 'v1');
  assert.equal(effectiveTypography(V2, { version: null, titleCase: 'original' }, true).titleCase, 'original');
});
test('interruptor apagado → v1 para todos, vista previa incluida', () => {
  assert.equal(effectiveTypography(V2, NONE, false).version, 'v1');
  assert.equal(effectiveTypography(V1, { version: 'v2', titleCase: null }, false).version, 'v1');
});

// 4. Selector de clases -------------------------------------------------------
test('v1 devuelve las clases de hoy byte a byte', () => {
  const today = 'font-heading text-[clamp(19px,5.9vw,26px)]  font-semibold uppercase leading-[1.05] tracking-[1px] text-text md:text-[calc(40px_*_var(--font-scale,1))]';
  assert.equal(ty('v1', today, 'section-title'), today);
  assert.equal(ty('v1', today, 'section-title', 'text-text mb-2'), today);
  assert.equal(ty('v1', '', 'caption'), '');
});
test('v2 devuelve el rol (+ extras)', () => {
  assert.equal(ty('v2', 'text-[13px]', 'caption'), 'ty-caption');
  assert.equal(ty('v2', 'text-[13px]', 'caption', 'text-muted'), 'ty-caption text-muted');
});

// 5. CSS: los roles sólo existen bajo v2 ---------------------------------------
const cssPath = fileURLToPath(new URL('../src/styles/globals.css', import.meta.url));
const css = readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
// Prelude de cada regla con llaves: lo que hay entre la llave anterior y la `{`.
const selectors = [...css.matchAll(/([^{}]+)\{/g)]
  .map((m) => m[1].trim())
  .filter((sel) => !sel.startsWith('@'));
test('todo selector con .ty- está atado a data-typography v2', () => {
  const offenders = [];
  for (const sel of selectors) {
    for (const part of sel.split(',')) {
      if (/\.ty-/.test(part) && !/:root\[data-typography=['"]v2['"]\]/.test(part)) offenders.push(part.trim());
    }
  }
  assert.deepEqual(offenders, [], 'selectores .ty-* sin :root[data-typography="v2"]');
});
test('cada rol declarado tiene su regla en globals.css', () => {
  for (const role of TYPOGRAPHY_ROLES) {
    assert.ok(
      selectors.some((sel) => sel.includes(`.ty-${role}`)),
      `falta la regla .ty-${role}`,
    );
  }
});

// 6. Normalización: la tienda lee la clave con el resolver, sin default propio --
test('storeConfig normaliza con resolveTypographyVersion', () => {
  const src = readFileSync(fileURLToPath(new URL('../src/lib/storeConfig.ts', import.meta.url)), 'utf8');
  assert.match(src, /typographyVersion:\s*resolveTypographyVersion\(s\.typography_version\)/);
  assert.match(src, /titleCase:\s*resolveTitleCase\(s\.typography_title_case\)/);
});

console.log(`✓ tipografía v1/v2: ${passed} pruebas OK`);
