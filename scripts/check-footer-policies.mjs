// Pruebas de «Información» en el footer (políticas de la tienda).
//
// Corre con `npm run test:footer-policies`. Importa el .ts directo (Node >= 22.18
// le saca los tipos solo). NO está en `check`/`prebuild`, igual que
// test:typography: si el Node del build fuera más viejo no debe tirar el deploy.
//
// Qué garantiza:
//  1. Cada enlace aparece sólo si su política tiene texto (vacío, espacios,
//     null o tipos raros → no aparece); sin ninguna, lista vacía.
//  2. Orden y rótulos fijos: Envíos → Cambios y devoluciones → Medios de pago.
//  3. El texto completo llega al diálogo (saltos de línea incluidos).
//  4. Se reutilizan las MISMAS claves del editor (envio_politica, cambios_politica,
//     pagos_politica): sin campos nuevos, y sin depender del modo minorista/mayorista.
//  5. El footer usa el helper y abre un diálogo accesible; la ficha sigue con
//     sus acordeones (PolicyAccordions) intactos.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { footerPolicyLinks } from '../src/lib/footerPolicies.ts';

const read = (rel) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

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

// 1. Visibilidad ---------------------------------------------------------------
test('sin políticas → sin enlaces', () => {
  assert.deepEqual(footerPolicyLinks({}), []);
  assert.deepEqual(footerPolicyLinks({ policyShipping: '', policyReturns: '', policyPayments: '' }), []);
});
test('vacíos, sólo espacios, null o tipos raros no generan enlace', () => {
  for (const v of ['', '   ', '\n\t ', null, undefined, 0, false, {}, []]) {
    assert.deepEqual(
      footerPolicyLinks({ policyShipping: v, policyReturns: v, policyPayments: v }),
      [],
      `valor ${JSON.stringify(v)}`,
    );
  }
});
test('cada política aparece sola cuando es la única cargada', () => {
  assert.deepEqual(footerPolicyLinks({ policyShipping: 'A todo el país' }).map((p) => p.key), ['envios']);
  assert.deepEqual(footerPolicyLinks({ policyReturns: '7 días' }).map((p) => p.key), ['cambios']);
  assert.deepEqual(footerPolicyLinks({ policyPayments: 'Transferencia' }).map((p) => p.key), ['pagos']);
});

// 2. Orden y rótulos -----------------------------------------------------------
test('orden y rótulos fijos con las tres cargadas', () => {
  const links = footerPolicyLinks({ policyPayments: 'c', policyShipping: 'a', policyReturns: 'b' });
  assert.deepEqual(
    links.map((p) => [p.key, p.label]),
    [
      ['envios', 'Envíos'],
      ['cambios', 'Cambios y devoluciones'],
      ['pagos', 'Medios de pago'],
    ],
  );
});

// 3. Texto completo ------------------------------------------------------------
test('el texto llega completo, con saltos de línea, sólo recortado en los bordes', () => {
  const largo = 'Envíos a todo el país.\n\nCABA: 24 h.\nInterior: 3 a 5 días hábiles.\n' + 'x'.repeat(2000);
  const [p] = footerPolicyLinks({ policyShipping: `  ${largo}  ` });
  assert.equal(p.text, largo);
});

// 4. Mismas claves, sin campos nuevos, sin gate por modo --------------------------
test('storeConfig mapea las claves del editor a la config, sin condición de modo', () => {
  const src = read('src/lib/storeConfig.ts');
  assert.match(src, /policyShipping:\s*str\(s\.envio_politica\)/);
  assert.match(src, /policyReturns:\s*str\(s\.cambios_politica\)/);
  assert.match(src, /policyPayments:\s*str\(s\.pagos_politica\)/);
});
test('el helper no lee claves crudas nuevas del settings', () => {
  const src = read('src/lib/footerPolicies.ts');
  assert.doesNotMatch(src, /\bs\.\w+|settings\./);
});

// 5. Conexiones ----------------------------------------------------------------
test('el footer usa el helper y abre PolicyDialog', () => {
  const src = read('src/components/Footer.tsx');
  assert.match(src, /footerPolicyLinks\(config\)/);
  assert.match(src, /<PolicyDialog\b/);
  assert.match(src, /policies\.length > 0 &&/, 'la columna se oculta sin políticas');
  assert.match(src, /INFORMACIÓN/);
});
test('el diálogo es accesible (rol, modal, título, Escape, foco)', () => {
  const src = read('src/components/PolicyDialog.tsx');
  assert.match(src, /role="dialog"/);
  assert.match(src, /aria-modal="true"/);
  assert.match(src, /aria-labelledby=\{titleId\}/);
  assert.match(src, /'Escape'/);
  assert.match(src, /closeRef\.current\?\.focus\(\)/);
  assert.match(src, /aria-label="Cerrar"/);
  assert.match(src, /createPortal/);
});
test('el texto configurado se pinta como texto, nunca como HTML', () => {
  // Los textos los escribe el comercio en el ERP: React los escapa sólo si van
  // como hijo ({text}). Prohibido cualquier camino que interprete HTML.
  const dialog = read('src/components/PolicyDialog.tsx');
  const helper = read('src/lib/footerPolicies.ts');
  for (const src of [dialog, helper]) {
    assert.doesNotMatch(src, /dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  }
  assert.match(dialog, /<p [^>]*>\{text\}<\/p>/, 'el texto va como hijo de React');
  assert.doesNotMatch(dialog, /href=\{[^}]*text/, 'el texto no arma enlaces');
  // El HTML llega intacto como string (lo escapa React al pintar), sin "limpiarlo"
  // a medias en el helper.
  const [p] = footerPolicyLinks({ policyPayments: '<img src=x onerror="alert(1)">' });
  assert.equal(p.text, '<img src=x onerror="alert(1)">');
});
test('la ficha de producto mantiene sus acordeones', () => {
  assert.match(read('src/pages/ProductDetail.tsx'), /<PolicyAccordions\s*\/>/);
  assert.match(read('src/components/PolicyAccordions.tsx'), /config\.policyShipping/);
});

console.log(`✓ footer-policies: ${passed} pruebas OK`);
