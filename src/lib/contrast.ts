/**
 * Contraste WCAG 2.x: funciones puras, sin DOM, para que se puedan probar solas
 * (`npm run test:contrast`).
 *
 * Por qué existe: los grises de la tienda (`muted` y `subtle`) salen del color de
 * texto del comercio con una opacidad FIJA (62 % y 42 %). Esa cuenta no mira el
 * resultado: con el texto #111 sobre blanco el `subtle` da 2,78:1, y con un fondo
 * crema o un texto gris propio baja de 2:1. Acá se calcula la opacidad MÍNIMA que
 * llega al contraste pedido, conservando el tono del comercio (es la misma mezcla
 * de su color de texto sobre su fondo, sólo que un poco más firme).
 *
 * Sólo se consume en la versión visual v2 (ver theme.ts y el bloque
 * `[data-ink='v2']` de globals.css). En v1 nada de esto cambia lo que se ve.
 */

export type Rgb = readonly [number, number, number];

/** #RGB | #RRGGBB → [r,g,b]. null si no es un hex válido (ej. una CSS var). */
export function parseHex(hex: string | null | undefined): Rgb | null {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Luminancia relativa según WCAG 2.x (sRGB linealizado). */
export function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Relación de contraste WCAG entre dos colores opacos (1 a 21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Color que se ve al pintar `fg` con opacidad `alpha` encima de `bg`. */
export function blend(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha)) as unknown as Rgb;
}

/** Contraste de `fg` al `alpha` sobre `surface` (la mezcla se hace sobre ESA superficie). */
export function alphaContrast(fg: Rgb, surface: Rgb, alpha: number): number {
  return contrastRatio(blend(fg, surface, alpha), surface);
}

/**
 * Opacidad mínima de `fg`, nunca menor que `from`, con la que llega a `target`
 * sobre TODAS las superficies. Pasos de 0,01. Si ni al 100 % llega, devuelve 1:
 * es lo más firme que se puede sin cambiar el color que eligió el comercio.
 */
export function minAlphaForContrast(fg: Rgb, surfaces: readonly Rgb[], from: number, target: number): number {
  for (let step = Math.round(from * 100); step <= 100; step++) {
    const alpha = step / 100;
    if (surfaces.every((s) => alphaContrast(fg, s, alpha) >= target)) return alpha;
  }
  return 1;
}

// ── Grises de texto (C1) ──────────────────────────────────────────────────────

/** Opacidades históricas: lo que se ve hoy (y lo que sigue viendo v1). */
export const MUTED_ALPHA = 0.62;
export const SUBTLE_ALPHA = 0.42;
/** WCAG AA para texto normal: el terciario más chico de la tienda es 12px. */
export const TEXT_AA = 4.5;
/**
 * Meta de todo lo que se CALCULA (grises, tintas, rellenos, badges glass, texto
 * sobre fondo propio): un poco por encima de AA, así ningún color queda en
 * 4,50 justo y el redondeo del suavizado de bordes lo deja en 4,49.
 */
export const AA_MARGIN = 4.6;
/** Hacia dónde apunta el secundario cuando hay que corregirlo. */
export const MUTED_TARGET = 7;
/**
 * Escalón mínimo entre terciario y secundario (relación de contrastes). Por
 * debajo, los dos grises se leen igual y se pierde la jerarquía.
 */
export const HIERARCHY_STEP = 1.35;
/**
 * Un panel `secondary` cuenta como superficie de los grises sólo si es un tinte
 * del fondo (gris claro sobre blanco, etc.). Si es un color fuerte, el texto
 * secundario no se apoya ahí y exigirle contraste contra él lo oscurecería de más.
 */
export const PANEL_TINT_MAX = 1.5;

export interface GreyAlphas {
  muted: number;
  subtle: number;
}

/**
 * Opacidades de `muted` y `subtle` que cumplen AA sobre el fondo (y sobre el
 * panel secundario cuando es un tinte del fondo), sin bajar nunca de las de hoy.
 *
 * - subtle: la mínima que llega a 4,5:1.
 * - muted: se queda en 0,62 si ya cumple 4,5:1 Y se distingue del subtle
 *   corregido (escalón ≥ HIERARCHY_STEP). Si no, sube lo mínimo hasta ese
 *   escalón, apuntando a ~7:1 y nunca por debajo de 4,5:1.
 *
 * Colores que no son hex (no debería pasar: la config normaliza) → las de hoy.
 */
export function greyAlphas(text: string, background: string, secondary?: string | null): GreyAlphas {
  const fg = parseHex(text);
  const bg = parseHex(background);
  if (!fg || !bg) return { muted: MUTED_ALPHA, subtle: SUBTLE_ALPHA };
  const panel = parseHex(secondary);
  const surfaces: Rgb[] = panel && contrastRatio(bg, panel) < PANEL_TINT_MAX ? [bg, panel] : [bg];

  const subtle = minAlphaForContrast(fg, surfaces, SUBTLE_ALPHA, AA_MARGIN);
  const worst = (alpha: number) => Math.min(...surfaces.map((s) => alphaContrast(fg, s, alpha)));
  const subtleContrast = worst(subtle);
  const mutedToday = worst(MUTED_ALPHA);
  if (mutedToday >= AA_MARGIN && mutedToday >= subtleContrast * HIERARCHY_STEP) {
    return { muted: Math.max(MUTED_ALPHA, subtle), subtle };
  }
  const from = Math.max(MUTED_ALPHA, subtle);
  const target = Math.max(AA_MARGIN, Math.min(MUTED_TARGET, subtleContrast * HIERARCHY_STEP));
  let muted = minAlphaForContrast(fg, surfaces, from, target);
  if (worst(muted) < target) {
    // El escalón no se alcanza con este color (texto y fondo de tonos muy
    // distintos: la mezcla no es monótona y el 100 % puede contrastar MENOS que
    // un 88 %). Antes que perder AA, la mínima opacidad que lo cumple.
    const aa = minAlphaForContrast(fg, surfaces, from, AA_MARGIN);
    muted = worst(aa) >= AA_MARGIN ? aa : from;
  }
  return { muted, subtle };
}

// ── Acento como texto (C4) ───────────────────────────────────────────────────

/**
 * Tinte del acento detrás de su propio texto: los chips de ahorro del selector
 * de cantidades y otras pastillas pintan el acento al 10 % sobre el fondo y
 * escriben encima con el acento pleno. Es la superficie más difícil donde
 * aparece el acento como texto (el tinte del 5 %/8 % de los seleccionados es
 * más claro), así que la tinta se calcula también contra ella.
 */
export const ACCENT_TINT = 0.1;

function toHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

/**
 * Tinta del acento: el color que eligió el comercio, llevado lo mínimo
 * necesario hacia el extremo opuesto al fondo (negro sobre fondos claros,
 * blanco sobre oscuros) hasta llegar a 4,5:1 sobre el fondo, el panel
 * secundario cuando es un tinte del fondo, y el tinte del propio acento.
 *
 * - Si el acento ya cumple, sale tal cual (acentos negros, azules, etc.).
 * - Mezclar con negro o blanco conserva el tono: un verde sigue verde, un
 *   amarillo pasa a ocre, no a otro color.
 * - Sólo es color de TEXTO: los fondos de botones y badges siguen con el
 *   acento original.
 *
 * Acento que no es hex → se devuelve tal cual (no inventa nada).
 */
export function accentInk(accent: string, background: string, secondary?: string | null): string {
  const a = parseHex(accent);
  const bg = parseHex(background);
  if (!a || !bg) return accent;
  const panel = parseHex(secondary);
  const surfaces: Rgb[] = [bg, blend(a, bg, ACCENT_TINT)];
  if (panel && contrastRatio(bg, panel) < PANEL_TINT_MAX) surfaces.push(panel);
  const black: Rgb = [0, 0, 0];
  const white: Rgb = [255, 255, 255];
  const pole = contrastRatio(black, bg) >= contrastRatio(white, bg) ? black : white;
  for (let step = 0; step <= 100; step++) {
    // Se valida el color YA redondeado a hex, que es el que se pinta: sin
    // redondear, algunos quedaban en 4,49.
    const ink = blend(pole, a, step / 100).map(Math.round) as unknown as Rgb;
    if (surfaces.every((s) => contrastRatio(ink, s) >= AA_MARGIN)) {
      return step === 0 ? accent : toHex(ink);
    }
  }
  return toHex(pole);
}

// ── Rellenos con texto encima: badges, cintas, botones (C2) ──────────────────

/**
 * Cuánto se puede oscurecer (o aclarar) un relleno elegido por el comercio
 * antes de que deje de "ser su color". Más allá, se conserva el relleno tal
 * cual y se cambia el TEXTO (blanco ↔ negro), que respeta mejor la identidad.
 */
export const FILL_SHIFT_MAX = 0.2;

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

/**
 * El texto que la tienda pone HOY sobre un relleno (theme.contrastColor): casi
 * negro si el relleno es claro, blanco si no. Duplicado a propósito para no
 * importar theme.ts (que importa este archivo).
 */
export function legacyTextOn(fill: string): string {
  const c = parseHex(fill);
  if (!c) return '#ffffff';
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 > 0.6 ? '#111111' : '#ffffff';
}

export interface FillPair {
  fill: string;
  text: string;
}

/**
 * Relleno + texto legibles (4,5:1), conservando lo que se ve hoy siempre que
 * se pueda:
 *
 * 1. Si el texto de hoy ya contrasta, no cambia nada.
 * 2. Si no, se lleva el RELLENO lo mínimo hacia el extremo opuesto al texto
 *    (más oscuro bajo texto blanco, más claro bajo texto oscuro), con un tope
 *    de FILL_SHIFT_MAX (20 %). Un verde #16a34a pasa a #12863d: sigue siendo el verde.
 *    El naranja #f97316 necesitaría 24 % y quedaría tostado: va por el paso 3.
 * 3. Si con ese tope no alcanza (ej. naranja #f97316 con texto blanco), se
 *    conserva el relleno y se cambia el texto al extremo que mejor contrasta.
 *    Con blanco o negro puros el peor caso posible es 4,58:1: siempre llega.
 *
 * `text` = el texto que se quiere conservar (default: el de hoy). Rellenos que
 * no son hex (CSS vars) → se devuelven tal cual.
 */
export function readableFill(fill: string, text?: string | null): FillPair {
  const f = parseHex(fill);
  const wanted = text ?? legacyTextOn(fill);
  const t = parseHex(wanted);
  if (!f || !t) return { fill, text: wanted };
  if (contrastRatio(t, f) >= AA_MARGIN) return { fill, text: wanted };
  const pole = relativeLuminance(t) > 0.5 ? BLACK : WHITE;
  for (let step = 1; step <= Math.round(FILL_SHIFT_MAX * 100); step++) {
    const shifted = blend(pole, f, step / 100).map(Math.round) as unknown as Rgb;
    if (contrastRatio(t, shifted) >= AA_MARGIN) return { fill: toHex(shifted), text: wanted };
  }
  return { fill, text: contrastRatio(WHITE, f) >= contrastRatio(BLACK, f) ? '#ffffff' : '#000000' };
}

/**
 * Opacidad mínima (desde `from`) de un badge translúcido ("glass") para que su
 * texto llegue a 4,5:1 sobre CUALQUIER foto: se evalúa contra el peor píxel
 * posible detrás (blanco bajo texto claro, negro bajo texto oscuro). Es el
 * "fondo de protección": el badge se vuelve más opaco sólo lo necesario.
 */
export function glassAlpha(fill: string, text: string, from = 0.85): number {
  const f = parseHex(fill);
  const t = parseHex(text);
  if (!f || !t) return from;
  const worst = relativeLuminance(t) > 0.5 ? WHITE : BLACK;
  for (let step = Math.round(from * 100); step <= 100; step++) {
    const seen = blend(f, worst, step / 100).map(Math.round) as unknown as Rgb;
    if (contrastRatio(t, seen) >= AA_MARGIN) return step / 100;
  }
  return 1;
}

export interface TextOn {
  text: string;
  alpha: number;
}

/**
 * Texto legible sobre un fondo propio (barra de beneficios): el tono que llega
 * se corre lo mínimo hacia el polo opuesto al fondo hasta 4,5:1 pintado al
 * `alpha` de hoy (la etiqueta lleva opacity-80). Si ni el polo alcanza a ese
 * alpha (fondos medios), sube la opacidad. Con colores que no son hex, intacto.
 */
export function readableText(text: string, background: string, alpha = 1): TextOn {
  const t = parseHex(text);
  const bg = parseHex(background);
  if (!t || !bg) return { text, alpha };
  const pole = contrastRatio(BLACK, bg) >= contrastRatio(WHITE, bg) ? BLACK : WHITE;
  for (let step = 0; step <= 100; step++) {
    const ink = blend(pole, t, step / 100).map(Math.round) as unknown as Rgb;
    if (alphaContrast(ink, bg, alpha) >= AA_MARGIN) return { text: step === 0 ? text : toHex(ink), alpha };
  }
  return { text: toHex(pole), alpha: minAlphaForContrast(pole, [bg], alpha, AA_MARGIN) };
}

// ── Colores de estado (C5) ───────────────────────────────────────────────────

/**
 * Bases de los colores de estado: los mismos tonos que la tienda usaba fijos
 * (verde de "agregado"/"ahorrás", rojo de error, ámbar de aviso). La tinta de
 * cada uno se calcula contra el fondo del comercio con accentInk, así un tema
 * oscuro recibe un verde claro y uno crema un verde algo más profundo.
 */
export const STATUS_BASE = {
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#d97706',
} as const;
