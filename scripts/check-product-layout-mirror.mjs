// Guard anti-divergencia del layout de la ficha de producto.
//
// A diferencia de check-color-helper-mirror.mjs, acá los archivos NO son
// byte-idénticos: el del admin tiene labels, badges PRO y helpers de edición que
// la tienda no necesita. Lo que sí tiene que coincidir son las CONSTANTES que
// los dos lados interpretan igual:
//
//   · DEFAULT_PRODUCT_LAYOUT  — el orden que el admin SIEMBRA la primera vez y
//     el que la tienda RENDERIZA cuando no hay layout guardado. Si divergen, el
//     comercio abre el editor, arrastra cualquier cosa, y la ficha le queda en
//     un orden que nadie pidió.
//   · ids conocidas / de ancho completo / del núcleo — deciden en qué zona vive
//     cada bloque. Si divergen, un elemento cae en una zona que el otro lado no
//     sabe pintar y DESAPARECE de la tienda sin ningún aviso.
//
// Esto no es hipotético: el default del admin decía `sizes, size_guide, colors`
// y el storefront pintaba `colors, sizes, size_guide`. Mientras la columna
// derecha era fija no se notaba; al empezar a consumirla (Fase 1) le habría dado
// vuelta el selector de color y talle a todo el que sembró ese default.
//
// CANÓNICO = la copia del storefront (es la que renderiza de verdad).
//
// Asume que los dos repos están clonados como vecinos:
//   PROYECTOS/procurva-storefront/   y   PROYECTOS/ProCurva/procurva2/
// Si el repo vecino no está (CI/Vercel clona uno solo), se saltea sin romper.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CANONICAL = resolve(repoRoot, 'src/lib/productLayout.ts');
const MIRROR = resolve(repoRoot, '../ProCurva/procurva2/components/catalog/editor/productLayout.ts');

if (!existsSync(CANONICAL)) {
  console.error(`✖ No existe el archivo canónico:\n    ${CANONICAL}`);
  process.exit(1);
}
if (!existsSync(MIRROR)) {
  console.log('· check-product-layout-mirror: repo espejo (procurva2) no encontrado, se saltea el chequeo.');
  process.exit(0);
}

/** Strings entre comillas simples de un fragmento, en orden. */
const quoted = (src) => [...src.matchAll(/'([^']+)'/g)].map((m) => m[1]);

/** El array `name: [...]` (o `const name ... = [...]`) de un archivo. */
function arrayOf(src, re, label, file) {
  const m = src.match(re);
  if (!m) {
    console.error(`✖ No pude leer ${label} en ${file}. ¿Le cambiaste la forma? Actualizá este chequeo.`);
    process.exit(1);
  }
  return quoted(m[1]);
}

const canon = readFileSync(CANONICAL, 'utf8');
const mirror = readFileSync(MIRROR, 'utf8');

// ── DEFAULT_PRODUCT_LAYOUT (las dos zonas) ───────────────────────────────────
const defaultBlock = (src, file) => {
  const m = src.match(/DEFAULT_PRODUCT_LAYOUT[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!m) {
    console.error(`✖ No encontré DEFAULT_PRODUCT_LAYOUT en ${file}.`);
    process.exit(1);
  }
  return {
    right_column: arrayOf(m[1], /right_column:\s*\[([\s\S]*?)\]/, 'right_column', file),
    below_product: arrayOf(m[1], /below_product:\s*\[([\s\S]*?)\]/, 'below_product', file),
  };
};

// ── ids conocidas / ancho completo / núcleo ──────────────────────────────────
// En el storefront son arrays sueltos; en el admin salen de PRODUCT_ELEMENTS.
const adminElements = (() => {
  const m = mirror.match(/PRODUCT_ELEMENTS: LayoutElement\[\] = \[([\s\S]*?)\n\];/);
  if (!m) {
    console.error('✖ No encontré PRODUCT_ELEMENTS en el espejo.');
    process.exit(1);
  }
  return [...m[1].matchAll(/\{\s*id:\s*'([^']+)'([^}]*)\}/g)].map(([, id, rest]) => ({
    id,
    fullWidth: /fullWidth:\s*true/.test(rest),
    core: /core:\s*true/.test(rest),
  }));
})();

const checks = [
  {
    label: 'DEFAULT_PRODUCT_LAYOUT.right_column',
    a: defaultBlock(canon, 'storefront').right_column,
    b: defaultBlock(mirror, 'admin').right_column,
  },
  {
    label: 'DEFAULT_PRODUCT_LAYOUT.below_product',
    a: defaultBlock(canon, 'storefront').below_product,
    b: defaultBlock(mirror, 'admin').below_product,
  },
  {
    label: 'ids conocidas',
    a: [...arrayOf(canon, /KNOWN_ELEMENT_IDS = \[([\s\S]*?)\]/, 'KNOWN_ELEMENT_IDS', 'storefront')].sort(),
    b: adminElements.map((e) => e.id).sort(),
  },
  {
    label: 'bloques de ancho completo',
    a: [...arrayOf(canon, /FULL_WIDTH_IDS: readonly string\[\] = \[([\s\S]*?)\]/, 'FULL_WIDTH_IDS', 'storefront')].sort(),
    b: adminElements.filter((e) => e.fullWidth).map((e) => e.id).sort(),
  },
  {
    label: 'núcleo (no ocultable)',
    a: [...arrayOf(canon, /CORE_RIGHT_IDS: readonly string\[\] = \[([\s\S]*?)\]/, 'CORE_RIGHT_IDS', 'storefront')].sort(),
    b: adminElements.filter((e) => e.core).map((e) => e.id).sort(),
  },
];

// Un regex que deje de matchear devolvería [] de los DOS lados y el chequeo
// pasaría en falso, que es peor que no tenerlo. Ninguna de estas listas puede
// estar vacía legítimamente ('núcleo' incluido).
for (const c of checks) {
  if (c.a.length === 0 || c.b.length === 0) {
    console.error(`✖ check-product-layout-mirror: "${c.label}" quedó vacío al parsear`);
    console.error('  (storefront:', c.a.length, '· admin:', c.b.length, '). Se le cambió la forma al archivo: actualizá este chequeo.');
    process.exit(1);
  }
}

const fallan = checks.filter((c) => c.a.join('|') !== c.b.join('|'));

if (fallan.length === 0) {
  console.log('· check-product-layout-mirror: OK (default, zonas y núcleo coinciden).');
  process.exit(0);
}

console.error('\n✖ El layout de la ficha divergió entre los dos repos.\n');
for (const c of fallan) {
  console.error(`  ${c.label}`);
  console.error(`    storefront (canónico) : ${JSON.stringify(c.a)}`);
  console.error(`    procurva2  (espejo)   : ${JSON.stringify(c.b)}\n`);
}
console.error(`  Canónico: ${CANONICAL}`);
console.error(`  Espejo:   ${MIRROR}\n`);
console.error('  Alineá el espejo con el canónico. Si el cambio correcto es el del espejo,');
console.error('  llevalo primero al storefront y después replicalo — nunca al revés.\n');
process.exit(1);
