/**
 * Atelier 2 · Colores efectivos (parte pura de la paleta, sin React ni la tienda).
 * Los cinco colores del comercio llevados a lo que pinta la plantilla con los
 * controles de contraste que ya usa ProCurva (lib/contrast y lib/theme). El
 * color guardado no se modifica: para cada uso se ajusta lo mínimo necesario.
 * scripts/template-atelier2.test.mjs la recorre con paletas reales y extremas.
 */

import {
  AA_MARGIN,
  PANEL_TINT_MAX,
  accentInk,
  blend,
  contrastRatio,
  greyAlphas,
  legacyTextOn,
  minAlphaForContrast,
  parseHex,
  readableFill,
  type Rgb,
} from '@/lib/contrast';
import { contrastColor, luminance } from '@/lib/theme';

export const AA = 4.5;
/** Contraste de componentes (WCAG 1.4.11): bordes de campos y el contorno del botón principal. */
const UI = 3;
/** Margen sobre 3:1, igual que AA_MARGIN sobre 4,5:1: lo que se pinta pasa por mezcla y redondeo. */
const UI_MARGIN = 3.1;
/** Proporción de texto en --a2-line-soft (atelier2.css: color-mix(in srgb, texto 7%, fondo)). */
export const SOFT = 0.07;

/**
 * Texto legible sobre `surface`: el preferido si llega a 4,5:1; si no, el mismo color
 * llevado hacia el polo hasta 4,5:1 (readableOn). Antes caía a legacyTextOn, que elige
 * por luminancia aparente y en tonos medios podía quedar en 2,2:1.
 */
function textOn(surface: string, preferred: string): string {
  const s = parseHex(surface);
  const p = parseHex(preferred);
  if (s && p && contrastRatio(s, p) >= AA) return preferred;
  if (!s) return preferred;
  return readableOn(p ? preferred : legacyTextOn(surface), surface);
}

/**
 * Botón del newsletter. Classic lo pinta con `safeFill(accent, sección)` y le pone el
 * texto de `contrastColor`; acá se elige el relleno para que ese resultado cumpla:
 * texto 4,5:1 sobre el botón y botón 3:1 contra la sección (contraste de componente).
 * Orden: el principal (ya legible), su versión llevada al extremo (accentInk) y, si
 * ninguno alcanza, el color de texto de la sección. El color guardado no cambia.
 */
export function newsletterButton(primaryFill: string, section: string, sectionText: string): string {
  const ok = (fill: string) => {
    const f = parseHex(fill);
    const s = parseHex(section);
    const t = parseHex(contrastColor(fill));
    if (!f || !s || !t) return false;
    const keptByClassic = Math.abs(luminance(fill) - luminance(section)) >= 0.25;
    return keptByClassic && contrastRatio(t, f) >= AA && contrastRatio(f, s) >= 3;
  };
  for (const fill of [primaryFill, accentInk(primaryFill, section)]) if (ok(fill)) return fill;
  return sectionText;
}

const toHex = (c: Rgb) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/**
 * El color del comercio llevado lo mínimo necesario hacia el negro o el blanco
 * (el que más contrasta con las superficies) hasta llegar a `target` contra
 * todas. Conserva el tono: un gris claro sobre marfil queda gris más oscuro, un
 * rojo queda rojo. Si ya cumple, vuelve igual. Se valida el hex redondeado.
 */
export function shiftTo(color: string, surfaces: readonly string[], target: number): string {
  const c = parseHex(color);
  const ss = surfaces.map(parseHex).filter((s): s is Rgb => s !== null);
  if (!c || ss.length === 0) return color;
  const black: Rgb = [0, 0, 0];
  const white: Rgb = [255, 255, 255];
  const worst = (pole: Rgb) => Math.min(...ss.map((s) => contrastRatio(pole, s)));
  const pole = worst(black) >= worst(white) ? black : white;
  for (let step = 0; step <= 100; step++) {
    const ink = blend(pole, c, step / 100).map(Math.round) as unknown as Rgb;
    if (ss.every((s) => contrastRatio(ink, s) >= target)) return step === 0 ? color : toHex(ink);
  }
  return toHex(pole);
}

/**
 * `color` legible sobre `main` (4,5:1 garantizado) y, si se puede a la vez, sobre
 * `extra`. Orden: contra las dos superficies; si no alcanza, sólo contra la principal;
 * si la principal es un tono medio donde ningún color llega al margen, el negro o el
 * blanco, el que más contrasta (con cualquier fondo, uno de los dos supera 4,5:1).
 */
export function readableOn(color: string, main: string, extra: readonly string[] = []): string {
  const m = parseHex(main);
  if (!m) return color;
  const ok = (c: string) => { const x = parseHex(c); return x !== null && contrastRatio(x, m) >= AA; };
  if (extra.length > 0) {
    const both = shiftTo(color, [main, ...extra], AA_MARGIN);
    if (ok(both) && extra.every((e) => { const x = parseHex(both); const y = parseHex(e); return !x || !y || contrastRatio(x, y) >= AA; })) return both;
  }
  const alone = shiftTo(color, [main], AA_MARGIN);
  if (ok(alone)) return alone;
  return contrastRatio([0, 0, 0], m) >= contrastRatio([255, 255, 255], m) ? '#000000' : '#ffffff';
}

/** Separación mínima entre la superficie suave y el fondo, para que una etiqueta se vea como etiqueta. */
export const SOFT_MIN = 1.08;

/**
 * Superficie suave (--a2-line-soft: etiquetas, filtros activos, guía de talles, estados
 * deshabilitados): la de la hoja de estilos, 7 % del texto sobre el fondo. Si así casi no
 * se distingue del fondo (fondos oscuros saturados, donde el 7 % apenas mueve la
 * luminancia), se sube la mezcla de a un punto hasta SOFT_MIN, con un tope de 30 %.
 */
export function softSurface(text: string, bg: string): string {
  const t = parseHex(text);
  const b = parseHex(bg);
  if (!t || !b) return bg;
  for (let pct = Math.round(SOFT * 100); pct <= 30; pct++) {
    const s = blend(t, b, pct / 100).map(Math.round) as unknown as Rgb;
    if (contrastRatio(s, b) >= SOFT_MIN) return toHex(s);
  }
  return toHex(blend(t, b, 0.3).map(Math.round) as unknown as Rgb);
}

/** Porcentaje para color-mix, redondeado HACIA ARRIBA (nunca por debajo del mínimo calculado). */
const pctUp = (a: number) => `${Math.ceil(Math.min(1, Math.max(0, a)) * 100)}%`;

export interface Atelier2ColorsInput {
  colorBackground: string;
  colorText: string;
  colorPrimary: string;
  colorAccent: string;
  colorSecondary: string;
  headerBackground?: string | null;
}

/**
 * Colores efectivos de Atelier 2 a partir de los cinco del comercio. Función pura
 * (scripts/template-atelier2.test.mjs la recorre con paletas extremas). Garantías:
 *  - texto, texto secundario (muted/subtle), encabezado, navegación y pie: 4,5:1 o
 *    más sobre su fondo (con el margen de lib/contrast);
 *  - texto de botones y del color secundario: 4,5:1;
 *  - bordes de campos y contorno del botón principal: 3:1 contra el fondo.
 * Los colores guardados no se tocan: sólo cambia lo que pinta la plantilla.
 */
export function atelier2Colors(c: Atelier2ColorsInput) {
  const bg = c.colorBackground;
  const secondary = c.colorSecondary;
  const bgRgb = parseHex(bg);
  const panel = parseHex(secondary);
  // Panel: el secundario sólo cuenta como superficie del texto si casi no se distingue del fondo (mismo criterio que greyAlphas).
  const panelToo = bgRgb && panel && contrastRatio(bgRgb, panel) < PANEL_TINT_MAX ? [secondary] : [];
  const text = parseHex(c.colorText) ? readableOn(c.colorText, bg, panelToo) : contrastColor(bg);
  const soft = softSurface(text, bg);
  // Texto sobre la superficie suave: el mismo texto si llega a 4,5:1 (Rosario, desdeabajo);
  // si no (paletas muy claras o de tono medio, donde el texto llega justo sobre el fondo),
  // ese tono llevado lo mínimo hacia el polo. El fondo de la etiqueta no se toca.
  const onSoft = textOn(soft, text);
  const primary = readableFill(c.colorPrimary);
  const accent = readableFill(c.colorAccent);
  const onSecondary = textOn(secondary, text);
  const { muted, subtle } = greyAlphas(text, bg, secondary);
  const header = c.headerBackground ?? bg;
  const headerText = c.headerBackground ? textOn(c.headerBackground, text) : text;
  const headerMuted = greyAlphas(headerText, header).muted;
  const footMuted = greyAlphas(onSecondary, secondary).muted;
  const fg = parseHex(text);
  const edge = fg && bgRgb ? minAlphaForContrast(fg, [bgRgb], 0.13, UI_MARGIN) : 1;
  const pf = parseHex(primary.fill);
  const primaryEdge = pf && bgRgb && contrastRatio(pf, bgRgb) < UI ? shiftTo(primary.fill, [bg], UI_MARGIN) : primary.fill;
  return { bg, text, soft, onSoft, primary, accent, secondary, onSecondary, muted, subtle, header, headerText, headerMuted, footMuted, edge, primaryEdge };
}

/** Variables CSS del kit (prefijo --a2-). */
export function atelier2Vars(c: Atelier2ColorsInput): Record<string, string> {
  const { bg, text, soft, onSoft, primary, accent, secondary, onSecondary, muted, subtle, header, headerText, headerMuted, footMuted, edge, primaryEdge } = atelier2Colors(c);
  const pct = (a: number) => `${Math.round(Math.min(1, Math.max(0, a)) * 100)}%`;
  return {
    '--a2-bg': bg,
    '--a2-text': text,
    '--a2-primary': primary.fill,
    '--a2-on-primary': primary.text,
    '--a2-accent': accent.fill,
    '--a2-on-accent': accent.text,
    '--a2-accent-ink': accentInk(c.colorAccent, bg, secondary),
    '--a2-secondary': secondary,
    '--a2-on-secondary': onSecondary,
    '--a2-muted': `color-mix(in srgb, ${text} ${pct(muted)}, ${bg})`,
    '--a2-subtle': `color-mix(in srgb, ${text} ${pct(subtle)}, ${bg})`,
    '--a2-line-soft': soft,
    '--a2-on-soft': onSoft,
    '--a2-header-bg': header,
    '--a2-header-text': headerText,
    '--a2-header-muted': `color-mix(in srgb, ${headerText} ${pctUp(headerMuted)}, ${header})`,
    '--a2-foot-muted': `color-mix(in srgb, ${onSecondary} ${pctUp(footMuted)}, ${secondary})`,
    '--a2-edge': `color-mix(in srgb, ${text} ${pctUp(edge)}, ${bg})`,
    '--a2-primary-edge': primaryEdge,
  };
}
