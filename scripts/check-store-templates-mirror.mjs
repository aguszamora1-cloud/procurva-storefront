// Guard anti-divergencia del registro de plantillas de tienda (storeTemplates.ts).
//
// Mismo patrón que check-color-helper-mirror.mjs: el archivo vive duplicado en
// dos repos git independientes (no hay paquete compartido) y tiene que ser
// BYTE-IDÉNTICO. Si divergen, el diseñador ofrecería una plantilla (o una
// versión) que la tienda no conoce, o la aplicaría con otras claves que las que
// la tienda pinta.
//
// CANÓNICO = la copia del storefront. El espejo de procurva2 nunca es fuente de verdad.
//
// Busca procurva2 como vecino (PROYECTOS/ProCurva/procurva2). Desde un worktree
// esa ruta no existe: pasar PROCURVA2_DIR=<carpeta del worktree del ERP>. Si el
// repo vecino no está (build de CI/Vercel, que clona uno solo), el chequeo se
// saltea con un aviso y NO rompe el build.

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const erpRoot = process.env.PROCURVA2_DIR
  ? resolve(process.env.PROCURVA2_DIR)
  : resolve(repoRoot, '../ProCurva/procurva2');

const CANONICAL = resolve(repoRoot, 'src/lib/storeTemplates.ts');
const MIRROR = resolve(erpRoot, 'components/catalog/editor/storeTemplates.ts');

// Finales de línea normalizados: CRLF en un repo y LF en el otro no es divergencia.
const sha = (p) => createHash('sha256').update(readFileSync(p, 'utf8').replace(/\r\n/g, '\n')).digest('hex');

if (!existsSync(CANONICAL)) {
  console.error(`✖ No existe el registro canónico:\n    ${CANONICAL}`);
  process.exit(1);
}

if (!existsSync(MIRROR)) {
  if (process.env.PROCURVA2_DIR) {
    console.error(`✖ PROCURVA2_DIR apunta a una carpeta sin el espejo:\n    ${MIRROR}`);
    process.exit(1);
  }
  // P0-1: el espejo del ERP se crea en P0-E. Hasta entonces, un ERP vecino sin el
  // archivo no es divergencia: se avisa y no se rompe el build.
  console.log(
    existsSync(erpRoot)
      ? '· check-store-templates-mirror: procurva2 todavía no tiene el espejo (se crea en P0-E), se saltea el chequeo.'
      : '· check-store-templates-mirror: repo espejo (procurva2) no encontrado, se saltea el chequeo.',
  );
  process.exit(0);
}

const a = sha(CANONICAL);
const b = sha(MIRROR);

if (a === b) {
  console.log('· check-store-templates-mirror: OK (canónico y espejo idénticos).');
  process.exit(0);
}

console.error(`
✖ storeTemplates.ts divergió entre los dos repos.

  CANÓNICO (fuente de verdad) — sha ${a.slice(0, 12)}
    ${CANONICAL}

  ESPEJO — sha ${b.slice(0, 12)}
    ${MIRROR}

  Si el cambio lo hiciste en el CANÓNICO, copialo al espejo:

    cp "${CANONICAL}" "${MIRROR}"

  Si el cambio lo hiciste en el ESPEJO, primero llevá ese cambio al canónico
  (editá el archivo del storefront) y recién ahí corré el cp de arriba.
  Nunca al revés: copiar el espejo sobre el canónico es lo que hay que evitar.
`);
process.exit(1);
