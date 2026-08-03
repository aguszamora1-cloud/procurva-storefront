// Guard anti-divergencia de QuantityTierSelector.tsx.
//
// El componente vive duplicado en dos repos git independientes (no hay paquete
// compartido) y tiene que ser BYTE-IDÉNTICO. El comentario del header no alcanza:
// esto falla solo en el prebuild, antes de que se deploye una versión divergente.
//
// CANÓNICO = la copia del storefront. El espejo de procurva2 nunca es fuente de verdad.
//
// Asume que los dos repos están clonados como vecinos:
//   PROYECTOS/procurva-storefront/   y   PROYECTOS/ProCurva/procurva2/
// Si el repo vecino no está (build de CI/Vercel, que clona uno solo), el chequeo
// se saltea con un aviso y NO rompe el build.

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CANONICAL = resolve(repoRoot, 'src/components/QuantityTierSelector.tsx');
const MIRROR = resolve(repoRoot, '../ProCurva/procurva2/components/catalog/shared/QuantityTierSelector.tsx');

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

if (!existsSync(CANONICAL)) {
  console.error(`✖ No existe el componente canónico:\n    ${CANONICAL}`);
  process.exit(1);
}

if (!existsSync(MIRROR)) {
  console.log('· check-tier-selector-mirror: repo espejo (procurva2) no encontrado, se saltea el chequeo.');
  process.exit(0);
}

const a = sha(CANONICAL);
const b = sha(MIRROR);

if (a === b) {
  console.log('· check-tier-selector-mirror: OK (canónico y espejo idénticos).');
  process.exit(0);
}

console.error(`
✖ QuantityTierSelector.tsx divergió entre los dos repos.

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
