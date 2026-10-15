/**
 * Lanzamiento por etapas del diseño nuevo de la tienda (tipografía y contraste
 * v2, que pasa a ser el estándar único de ProCurva).
 *
 * Qué pinta cada tienda (lib/typography → savedTypographyVersion):
 *  1. `typography_version: 'v1'` guardado → v1. Es el ROLLBACK POR TIENDA:
 *     gana siempre, aunque la empresa esté en la etapa. Se escribe por SQL
 *     (nadie lo escribe desde el ERP) y vuelve a la tienda al diseño anterior
 *     sin deploy. Se retira cuando se limpie el código v1.
 *  2. `typography_version: 'v2'` guardado → v2. Activación por tienda sin
 *     deploy, también por SQL. Hoy ninguna tienda tiene la clave.
 *  3. Empresa en TYPOGRAPHY_V2_STAGE (o 'all') → v2 para todas sus tiendas.
 *  4. Si no → v1: una tienda sin clave NO cambia hasta que su empresa entre.
 *
 * ROLLBACK GLOBAL: TYPOGRAPHY_V2_ENABLED = false en lib/typography.ts y
 * redeploy (todas vuelven a v1, también las que tengan 'v2' guardado), o el
 * Instant Rollback de Vercel al deploy anterior.
 *
 * Etapas (cada una es un cambio acá + deploy de la tienda; el ERP no interviene):
 *  - Etapa 1: la empresa de pruebas (Rosario Sportwear minorista + mayorista).
 *  - Etapa 2: un grupo reducido con temas, fuentes y escalas distintas.
 *  - Etapa 3: 'all'.
 *
 * Lógica pura, sin imports: la prueba scripts/check-typography.mjs la corre
 * directo con Node.
 */
export const TYPOGRAPHY_V2_STAGE: readonly string[] | 'all' = [
  // Etapa 1 · ProCurva (cuenta de pruebas): rosariosportwear + mayoristarosario.
  '71ee0d15-57c6-4f9d-9f3e-0585e2479d71',
  // Etapa 2 · grupo reducido con temas distintos (estudio de impacto 14/10/2026).
  // Cada empresa entra con TODOS sus canales: minorista, mayorista y dominio
  // propio; sus tiendas en construcción también, si las publican.
  'ac784e57-5761-4223-a5a0-a92f7bf8cf6b', // DESDEABAJO.IND · desdeabajo (fondo negro, Inter)
  '5688013f-a3ed-48dd-81d5-2295a32b8d36', // LAS POPAS · las-popas-2 + laspopas.com.ar (crema y azul, Poppins)
  '8f2546c2-ffcd-45a0-b6ea-ee37b282fa50', // Tienda Manes · tienda-manes (acento rojo)
  '0bb6bc14-3163-4442-8968-49f36cf6a6e7', // Sanito Calzados · sanito-calzados (+ mayorista en construcción)
];
