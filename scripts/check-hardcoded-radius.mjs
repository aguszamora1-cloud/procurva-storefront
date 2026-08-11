// Guard: radios de borde en píxeles literales (`rounded-[10px]`).
//
// EL PROBLEMA QUE EVITA
// Las esquinas de la tienda son configurables por el comercio (Catálogo Online →
// Diseño → Esquinas). Funciona porque toda la escala de `borderRadius` de
// tailwind.config.js apunta a `var(--radius-*)`, que applyTheme reescribe en
// runtime: un `rounded-lg` escrito en cualquier componente ya obedece al token.
//
// Un `rounded-[10px]` NO. Queda clavado en 10px para siempre y no hay error de
// build ni de tipos: el comercio elige "esquinas rectas", la tienda queda casi
// toda recta, y ese botón sigue redondo. Es el mismo modo de falla mudo que
// persigue check-dead-opacity.mjs — se ve "casi bien" y se cuela en review.
// En el barrido inicial (2026-08-11) había 50 clases así en 20 archivos.
//
// QUÉ USAR EN SU LUGAR
//   · Botones y campos de formulario  → `rounded-button`
//   · Etiquetas/badges/chips          → `rounded-pill`
//   · Tarjetas, secciones, imágenes   → la escala: rounded-sm|md|lg|xl|2xl|3xl
//   · Círculos de verdad              → `rounded-full` (literal a propósito:
//     avatares, dots del carrusel y swatches de color NO deben cuadrarse)

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const RE = /\brounded(-[a-z]+)?-\[[^\]]+\]/g;

// Escape hatch para el caso legítimo: un radio que dibuja un OBJETO FÍSICO y no
// una decisión de estilo de la tienda (el frame del celular del banner mockup).
// Poné el marcador en la misma línea o en el comentario contiguo de arriba.
const MARKER = 'check-hardcoded-radius: ok';

/** Cuántas líneas hacia arriba se busca el marcador. Ver el comentario del uso. */
const VENTANA = 10;

/**
 * Saca comentarios de línea y de bloque, respetando strings y template literals,
 * para que el guard no se dispare con su propia documentación (varios archivos
 * mencionan `rounded-[10px]` justamente para explicar por qué no usarlo).
 *
 * Reemplaza por espacios en vez de borrar, para no correr los offsets y poder
 * seguir reportando la línea real.
 */
function stripComments(src) {
  const out = src.split('');
  let state = 'code';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];
    if (state === 'code') {
      if (c === '/' && next === '/') { state = 'line'; out[i] = out[i + 1] = ' '; i++; }
      else if (c === '/' && next === '*') { state = 'block'; out[i] = out[i + 1] = ' '; i++; }
      else if (c === "'" || c === '"' || c === '`') state = c;
    } else if (state === 'line') {
      if (c === '\n') state = 'code';
      else out[i] = ' ';
    } else if (state === 'block') {
      if (c === '*' && next === '/') { state = 'code'; out[i] = out[i + 1] = ' '; i++; }
      else if (c !== '\n') out[i] = ' ';
    } else {
      if (c === '\\') i++;
      else if (c === state) state = 'code';
    }
  }
  return out.join('');
}

/** Sugerencia según el valor en px, para que el mensaje sea accionable. */
function sugerir(clase) {
  const px = Number((clase.match(/\[(\d+(?:\.\d+)?)px\]/) ?? [])[1]);
  if (!Number.isFinite(px)) return 'la escala tokenizada (rounded-md|lg|xl|…)';
  if (px <= 4) return 'rounded-sm';
  if (px <= 7) return 'rounded-md   (o rounded-button si es un botón/campo)';
  if (px <= 10) return 'rounded-lg   (o rounded-button si es un botón/campo)';
  if (px <= 14) return 'rounded-xl';
  if (px <= 20) return 'rounded-2xl';
  return 'rounded-3xl';
}

const files = globSync('src/**/*.{ts,tsx}', { cwd: repoRoot });
const hallazgos = [];

for (const rel of files) {
  const abs = resolve(repoRoot, rel);
  const raw = readFileSync(abs, 'utf8');
  if (!raw.includes('rounded-')) continue;
  const lines = raw.split(/\r?\n/);
  const code = stripComments(raw);
  for (const m of code.matchAll(RE)) {
    const line = code.slice(0, m.index).split('\n').length;
    // Ventana de gracia hacia arriba en vez de "bloque de comentario contiguo"
    // (la regla de check-dead-opacity.mjs). Motivo: en JSX el radio vive dentro
    // de un `className` multilínea y el comentario `{/* … */}` va arriba del
    // ELEMENTO, no de la línea del atributo — entre medio quedan el `<div`, el
    // resto de las props, etc. Con la regla contigua el marcador nunca aplica.
    const DESDE = Math.max(0, line - 1 - VENTANA);
    const exento = lines.slice(DESDE, line).some((l) => l.includes(MARKER));
    if (exento) continue;
    hallazgos.push({
      archivo: relative(repoRoot, abs).replace(/\\/g, '/'),
      line,
      clase: m[0],
      sugerida: sugerir(m[0]),
    });
  }
}

if (hallazgos.length === 0) {
  console.log(`· check-hardcoded-radius: OK (0 radios en píxeles; ${files.length} archivos revisados).`);
  process.exit(0);
}

console.error(`
✖ ${hallazgos.length} radio(s) de borde en píxeles literales.

  Quedan clavados y NO obedecen a las esquinas que elige el comercio en
  Diseño → Esquinas. No rompe el build: simplemente ese elemento se queda
  redondo cuando toda la tienda pasó a rectas.
`);

for (const h of hallazgos) {
  console.error(`  ${h.archivo}:${h.line}\n      ${h.clase}   →   ${h.sugerida}`);
}

console.error(`
  CÓMO ARREGLARLO
    · Botón o campo de formulario  →  rounded-button
    · Badge, chip o etiqueta       →  rounded-pill
    · Tarjeta, sección, imagen     →  rounded-sm|md|lg|xl|2xl|3xl

  SI EL RADIO ES INTENCIONAL
    Vale sólo cuando dibuja un objeto físico y no un estilo de la tienda (el
    frame del celular del banner mockup). Poné el marcador en la línea o en el
    comentario de arriba:

        // ${MARKER} — <por qué>
`);
process.exit(1);
