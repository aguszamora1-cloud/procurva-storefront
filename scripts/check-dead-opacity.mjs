// Guard: modificadores de opacidad de Tailwind sobre tokens `var(--color-*)`.
//
// EL PROBLEMA QUE EVITA
// Los colores del tema de este repo se definen en tailwind.config.js como
// `var(--color-*)` peladas (las inyecta useTheme en runtime, por tenant), SIN el
// placeholder `<alpha-value>`. Tailwind no puede componer un color con alpha a
// partir de eso, así que directamente NO GENERA la clase: `bg-accent/10` no
// existe en el CSS de salida y el elemento queda transparente. No hay error de
// build, ni de tipos, ni warning: el estilo simplemente no aparece, y como
// suele quedar "casi bien" se cuela en review. En un barrido del 2026-08-05
// había 20 clases así, vivas y mudas, algunas desde hacía meses.
//
// QUÉ USAR EN SU LUGAR: las utilidades `-aNN` de src/styles/globals.css
// (`bg-accent-a10`, `border-accent-a40`, `ring-accent-a25`, …), que arman el
// tinte con color-mix() y sí resuelven la var en runtime.
//
// La lista de tokens NO está hardcodeada: sale de tailwind.config.js y se filtra
// a los que valen `var(...)`. Si mañana agregan un token nuevo del tenant, queda
// cubierto solo. Los colores estáticos (hex) no se reportan: sobre ésos los
// modificadores funcionan perfecto.

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const { default: tw } = await import(`file://${resolve(repoRoot, 'tailwind.config.js')}`);

/** Tokens de color que valen `var(...)`: son los que no admiten /NN. Aplana anidados. */
function varTokens(colors, prefix = '', out = []) {
  for (const [key, value] of Object.entries(colors ?? {})) {
    const name = key === 'DEFAULT' ? prefix : prefix ? `${prefix}-${key}` : key;
    if (typeof value === 'string') {
      if (value.includes('var(')) out.push(name);
    } else if (value && typeof value === 'object') {
      varTokens(value, name, out);
    }
  }
  return out;
}

// Más largos primero: `on-surface-muted` tiene que ganarle a `on-surface`.
const TOKENS = varTokens(tw?.theme?.extend?.colors).sort((a, b) => b.length - a.length);

if (TOKENS.length === 0) {
  console.log('· check-dead-opacity: ningún token var(--color-*) en el config, no hay nada que chequear.');
  process.exit(0);
}

// Utilidades de Tailwind que toman un color.
const PROPS = [
  'bg', 'text', 'border', 'ring', 'ring-offset', 'divide', 'outline', 'decoration',
  'from', 'via', 'to', 'placeholder', 'caret', 'fill', 'stroke', 'shadow',
];

const RE = new RegExp(`\\b(${PROPS.join('|')})-(${TOKENS.join('|')})\\/(\\d+)\\b`, 'g');

// Escape hatch para el caso legítimo: código que se aplica en el OTRO repo
// (procurva2 define sus colores en hex, ahí los modificadores sí funcionan).
// Poné el marcador en la misma línea o en la anterior.
const MARKER = 'check-dead-opacity: ok';

/**
 * Saca comentarios de línea y de bloque, respetando strings y template literals.
 * Sin esto el guard se dispararía con su propia documentación: varios archivos
 * explican en un comentario justamente que `bg-accent/10` no funciona.
 *
 * Reemplaza por espacios en vez de borrar, para no correr los offsets y poder
 * seguir reportando línea/columna reales. Limitación conocida: no distingue un
 * literal de expresión regular que contenga `//`, cosa que no aparece en el repo.
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
      // dentro de un string: sólo importa salir, respetando el escape
      if (c === '\\') i++;
      else if (c === state) state = 'code';
    }
  }
  return out.join('');
}

/**
 * DEUDA CONOCIDA — clases muertas que existen desde antes de este guard y que se
 * decidió NO arreglar (todas caen a un gris muy parecido al pretendido, así que
 * el diff no se justifica). El guard NO las falla, pero tampoco las esconde: las
 * lista en cada corrida y se rompe si aparece una NUEVA en el mismo archivo.
 *
 * La clave incluye la cantidad, así que sumar otra ocurrencia de la misma clase
 * en el mismo archivo también falla. No incluye número de línea a propósito: se
 * mueven con cualquier edición y no aportan.
 *
 * Al arreglar una, borrá su entrada: el guard falla si una entrada quedó obsoleta,
 * para que la lista no junte mugre.
 */
const DEUDA = {
  'src/pages/CategoriesIndex.tsx': { 'text-on-surface/15': 1 },
  'src/components/home/CategoriesSection.tsx': { 'text-on-surface/15': 1 },
  'src/pages/Checkout.tsx': { 'bg-muted/10': 1 },
  'src/components/ComplementaryBlock.tsx': { 'border-line/70': 1, 'border-line/60': 1 },
  'src/components/OtherColorsBlock.tsx': { 'border-line/70': 2 },
};

const files = globSync('src/**/*.{ts,tsx}', { cwd: repoRoot });
const hallazgos = [];

for (const rel of files) {
  const abs = resolve(repoRoot, rel);
  const raw = readFileSync(abs, 'utf8');
  if (!raw.includes('/')) continue;
  const lines = raw.split(/\r?\n/);
  const code = stripComments(raw);
  for (const m of code.matchAll(RE)) {
    const line = code.slice(0, m.index).split('\n').length;
    // El marcador vale en la propia línea o en cualquier renglón del bloque de
    // comentario contiguo de arriba, para poder justificar en varias líneas.
    let exento = (lines[line - 1] ?? '').includes(MARKER);
    for (let i = line - 2; i >= 0 && !exento; i--) {
      const t = (lines[i] ?? '').trim();
      if (!(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'))) break;
      if (t.includes(MARKER)) exento = true;
    }
    if (exento) continue;
    const [clase, prop, token, pct] = m;
    hallazgos.push({
      archivo: relative(repoRoot, abs).replace(/\\/g, '/'),
      line,
      clase,
      sugerida: `${prop}-${token}-a${String(pct).padStart(2, '0')}`,
    });
  }
}

// Separa lo nuevo de la deuda ya registrada, y detecta entradas obsoletas.
const vistos = {};
for (const h of hallazgos) (vistos[h.archivo] ??= {})[h.clase] = ((vistos[h.archivo] ?? {})[h.clase] ?? 0) + 1;

const nuevos = [];
for (const h of hallazgos) {
  const permitidas = DEUDA[h.archivo]?.[h.clase] ?? 0;
  const idx = hallazgos.filter((x) => x.archivo === h.archivo && x.clase === h.clase).indexOf(h);
  if (idx >= permitidas) nuevos.push(h);
}

const obsoletas = [];
for (const [archivo, clases] of Object.entries(DEUDA)) {
  for (const [clase, n] of Object.entries(clases)) {
    const real = vistos[archivo]?.[clase] ?? 0;
    if (real < n) obsoletas.push({ archivo, clase, esperadas: n, reales: real });
  }
}

if (obsoletas.length > 0) {
  console.error('\n✖ La lista DEUDA de check-dead-opacity.mjs quedó obsoleta:\n');
  for (const o of obsoletas) {
    console.error(`  ${o.archivo}: ${o.clase} — registradas ${o.esperadas}, quedan ${o.reales}`);
  }
  console.error('\n  Se arreglaron sin actualizar la lista. Bajá el número o borrá la entrada.\n');
  process.exit(1);
}

const pendientes = hallazgos.length - nuevos.length;
const resumenDeuda = pendientes > 0 ? ` — ${pendientes} de deuda conocida, sin arreglar` : '';

if (nuevos.length === 0) {
  console.log(`· check-dead-opacity: OK (0 clases muertas nuevas; ${TOKENS.length} tokens vigilados${resumenDeuda}).`);
  process.exit(0);
}

console.error(`
✖ ${nuevos.length} clase(s) de Tailwind NUEVAS que NO se generan y quedan mudas.

  Los colores del tema son \`var(--color-*)\` sin \`<alpha-value>\`, así que
  Tailwind NO puede generar el modificador de opacidad /NN sobre ellos. La clase
  no existe en el CSS de salida: el borde/fondo queda TRANSPARENTE, sin ningún
  error de build ni de tipos.
`);

for (const h of nuevos) {
  console.error(`  ${h.archivo}:${h.line}\n      ${h.clase}   →   ${h.sugerida}`);
}

console.error(`
  CÓMO ARREGLARLO
    1. Usá la utilidad \`-aNN\` equivalente de src/styles/globals.css.
    2. Si el escalón que necesitás no existe todavía, agregalo ahí:

         .bg-accent-a10 {
           background-color: color-mix(in srgb, var(--color-accent) 10%, transparent);
         }

       Ojo con los ring-*: pintan con box-shadow, así que la utilidad tiene que
       setear \`--tw-ring-color\`, no \`ring-color\`.

  SI LA CLASE ES INTENCIONAL
    Pasa sólo si el código se aplica en procurva2 (allá los colores son hex
    estáticos y los modificadores funcionan bien), como el skin 'admin' de
    QuantityTierSelector. En ese caso poné el marcador en la línea o la anterior:

        // ${MARKER} — <por qué>
`);
process.exit(1);
