// Garantía de "v1 no cambia" a nivel código (lib/typography).
//
//   node scripts/check-ty-literals.mjs [base]      (base por defecto: HEAD)
//
// Toma el diff de src/ contra `base` y, por cada línea BORRADA, extrae los
// strings de clases que tenía (entre comillas simples, dobles o backticks, con
// al menos una utilidad de tipografía). Cada uno tiene que seguir apareciendo
// LITERAL en el archivo nuevo: es el primer argumento de ty(), que en v1 se
// devuelve tal cual. Si alguno desapareció o cambió un carácter, una tienda v1
// se vería distinta → falla.
//
// No corre en prebuild: sirve para revisar un cambio de migración v2.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const base = process.argv[2] || 'HEAD';
const diff = execFileSync('git', ['diff', '--no-color', '-U0', base, '--', 'src'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// Un string "de clases" toca tipografía si tiene alguna de estas utilidades.
const TYPO = /(^|\s|:)(text-(\[|xs\b|sm\b|base\b|lg\b|xl\b|\dxl\b)|font-(thin|light|normal|medium|semibold|bold|extrabold|black)\b|leading-|tracking-|uppercase\b)/;
const STRING = /'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g;

const removed = new Map(); // archivo → strings borrados
let file = null;
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ ')) {
    file = line.slice(4).replace(/^b\//, '');
    continue;
  }
  if (!file || !line.startsWith('-') || line.startsWith('---')) continue;
  for (const m of line.slice(1).matchAll(STRING)) {
    const s = m[1] ?? m[2] ?? m[3];
    if (s && TYPO.test(s)) {
      if (!removed.has(file)) removed.set(file, new Set());
      removed.get(file).add(s);
    }
  }
}

let checked = 0;
const missing = [];
for (const [f, strings] of removed) {
  if (f === '/dev/null') continue;
  const now = readFileSync(f, 'utf8');
  for (const s of strings) {
    checked++;
    if (!now.includes(s)) missing.push(`${f}: ${s}`);
  }
}

if (missing.length) {
  console.error(`✗ ${missing.length} string(s) de clases v1 desaparecieron o cambiaron:`);
  for (const m of missing) console.error('  - ' + m);
  process.exit(1);
}
console.log(`✓ v1 literal: ${checked} strings de clases borrados siguen presentes tal cual (${removed.size} archivos)`);
