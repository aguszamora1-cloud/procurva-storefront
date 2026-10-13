/**
 * Versión tipográfica de la tienda (v1 / v2).
 *
 * - v1: los estilos de siempre. Es lo que pinta TODA tienda que no tenga la
 *   clave `typography_version` guardada en sus settings, o que tenga cualquier
 *   valor que no sea exactamente 'v2'. Las tiendas existentes no la tienen, así
 *   que no cambian ni un pixel hasta que el comercio elija lo contrario.
 * - v2: la escala tipográfica nueva (roles `ty-*` de globals.css). Sólo la ve
 *   una tienda con `typography_version: 'v2'` escrito explícitamente.
 *
 * Cómo se usa en un componente (desde la Fase 1): el string de clases de hoy va
 * LITERAL como primer argumento de `ty()` y el rol nuevo como segundo. En v1
 * sale exactamente el string viejo; en v2 sale el rol. Un componente, dos looks,
 * sin duplicar componentes.
 *
 * Este archivo es lógica pura (sin React ni imports) a propósito: lo prueba
 * `scripts/check-typography.mjs` corriéndolo directo con Node.
 */

export type TypographyVersion = 'v1' | 'v2';
/** Títulos en mayúsculas ('upper', el look de siempre) o como los escribió el comercio. */
export type TitleCase = 'upper' | 'original';

/**
 * Interruptor general. En `false`, TODAS las tiendas pintan v1, incluidas las
 * que guardaron v2 y la vista previa: es el botón de emergencia si v2 rompe algo
 * en producción. No toca datos; la clave guardada sigue ahí para cuando se
 * vuelva a prender.
 */
export const TYPOGRAPHY_V2_ENABLED = true;

/** Roles de la escala v2. Cada uno es una clase de globals.css (`ty-<rol>`). */
export const TYPOGRAPHY_ROLES = [
  'display',
  'hero-overlay',
  'lead',
  'page-title',
  'section-title',
  'product-title',
  'card-title',
  'block-title',
  'body',
  'body-sm',
  'label',
  'caption',
  'eyebrow',
  'input',
  'badge',
] as const;
export type TypographyRole = (typeof TYPOGRAPHY_ROLES)[number];

/** Valor guardado → versión. Sólo 'v2' exacto es v2; todo lo demás es v1. */
export function resolveTypographyVersion(raw: unknown): TypographyVersion {
  return raw === 'v2' ? 'v2' : 'v1';
}

/** Valor guardado → capitalización. Sólo 'original' exacto la cambia. */
export function resolveTitleCase(raw: unknown): TitleCase {
  return raw === 'original' ? 'original' : 'upper';
}

/** Lo que pide una vista previa (o null si no hay pedido válido). */
export interface TypographyPreview {
  version: TypographyVersion | null;
  titleCase: TitleCase | null;
}

const NO_PREVIEW: TypographyPreview = { version: null, titleCase: null };

/**
 * Lee el pedido de vista previa del query string: `?typo=v1|v2` y
 * `?typo_case=upper|original`.
 *
 * Sólo vale dentro del modo vista previa del ERP (`isPreview`, o sea
 * `?pc_preview=1`, que además deja la visita fuera de las métricas). Un
 * visitante que escriba `?typo=v2` en una tienda pública no ve nada distinto.
 *
 * El resultado vive SOLO en memoria: nunca entra en la StoreConfig (que es lo
 * que se cachea en localStorage) ni se escribe en ningún lado. Recargar sin el
 * parámetro vuelve a lo guardado.
 */
export function parseTypographyPreview(search: string, isPreview: boolean): TypographyPreview {
  if (!isPreview) return NO_PREVIEW;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return NO_PREVIEW;
  }
  const v = params.get('typo');
  const c = params.get('typo_case');
  return {
    version: v === 'v1' || v === 'v2' ? v : null,
    titleCase: c === 'upper' || c === 'original' ? c : null,
  };
}

/** Lo que efectivamente se pinta, combinando lo guardado, la vista previa y el interruptor. */
export function effectiveTypography(
  saved: { typographyVersion: TypographyVersion; titleCase: TitleCase },
  preview: TypographyPreview,
  v2Enabled: boolean = TYPOGRAPHY_V2_ENABLED,
): { version: TypographyVersion; titleCase: TitleCase } {
  const titleCase = preview.titleCase ?? saved.titleCase;
  if (!v2Enabled) return { version: 'v1', titleCase };
  return { version: preview.version ?? saved.typographyVersion, titleCase };
}

/**
 * Elige las clases según la versión. En v1 devuelve `v1Classes` tal cual, sin
 * tocar un carácter: esa es la garantía de que una tienda v1 no cambia.
 * `extra` son clases que van en las dos versiones (layout, color, etc.).
 */
export function ty(
  version: TypographyVersion,
  v1Classes: string,
  role: TypographyRole,
  extra = '',
): string {
  if (version !== 'v2') return v1Classes;
  return extra ? `ty-${role} ${extra}` : `ty-${role}`;
}
