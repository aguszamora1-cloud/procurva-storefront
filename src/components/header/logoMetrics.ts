/**
 * Tamaño "óptico" del logo (encabezado Inline): según el contenido visible, no
 * según la caja del archivo. Los logos que suben los comercios traen márgenes
 * muy distintos (medidos 02/11: el contenido ocupa del 31 al 90 % del alto del
 * archivo, con proporciones de 1,2:1 a 6:1, fondos transparentes, blancos o
 * negros), así que un tope fijo de alto deja unos ilegibles y otros enormes.
 *
 * El archivo nunca se modifica ni se deforma: se escala entero y se ubica de
 * modo que el contenido quede en la caja del logo. Lo que queda afuera de esa
 * caja sólo se oculta cuando es FONDO comprobado: transparente, o un color
 * sólido parejo en todo el borde que además coincide con el fondo del
 * encabezado. Ante cualquier duda (borde mezclado, color distinto, CORS, error
 * de lectura), modo estricto: el archivo entero, como antes.
 *
 * Funciones puras arriba (se prueban en Node con imágenes sintéticas);
 * medición en el navegador, con caché, abajo.
 */

/** Píxeles RGBA, como ImageData. */
export interface Pixels {
  data: Uint8ClampedArray | Uint8Array | number[];
  width: number;
  height: number;
}

export type LogoBackground =
  | { kind: 'transparent' }
  | { kind: 'solid'; rgb: [number, number, number] }
  | { kind: 'ambiguous' };

export interface LogoMetrics {
  /** Proporción del contenido respecto del archivo (0..1), ya con el margen de seguridad. */
  ink: { x: number; y: number; w: number; h: number };
  /** Proporción ancho/alto del archivo. */
  fileAspect: number;
  background: LogoBackground;
}

/** Alfa bajo el cual un píxel cuenta como transparente. */
const ALPHA_EMPTY = 16;
/** Diferencia máxima por canal para "mismo color" (absorbe el ruido de un JPEG). */
const COLOR_TOL = 24;
/**
 * Para decidir qué es CONTENIDO la tolerancia es más estricta: un gris muy claro
 * sobre blanco cuenta como contenido y nunca se oculta (el error queda del lado
 * de mostrar de más).
 */
const INK_TOL = 10;
/** Margen de seguridad alrededor del contenido: bordes suavizados y sombras tenues. */
const SAFETY = 0.02;

const close = (a: number[], b: number[], tol: number) =>
  Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;

/**
 * Fondo del archivo según TODO su borde (no sólo las esquinas): transparente si
 * el borde entero lo es; sólido si el borde entero es opaco y de un mismo
 * color; si no, ambiguo.
 */
export function classifyBackground(px: Pixels): LogoBackground {
  const { data, width: w, height: h } = px;
  if (w < 3 || h < 3) return { kind: 'ambiguous' };
  let transparent = 0;
  let opaque = 0;
  let ref: number[] | null = null;
  let sameColor = true;
  const visit = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const a = data[i + 3];
    if (a < ALPHA_EMPTY) {
      transparent++;
      return;
    }
    if (a < 250) {
      sameColor = false; // semitransparente en el borde: no hay fondo claro
      opaque++;
      return;
    }
    opaque++;
    const rgb = [data[i], data[i + 1], data[i + 2]];
    if (!ref) ref = rgb;
    else if (!close(rgb, ref, COLOR_TOL)) sameColor = false;
  };
  for (let x = 0; x < w; x++) {
    visit(x, 0);
    visit(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    visit(0, y);
    visit(w - 1, y);
  }
  if (opaque === 0) return { kind: 'transparent' };
  if (transparent === 0 && sameColor && ref) {
    const [r, g, b] = ref as number[];
    return { kind: 'solid', rgb: [r, g, b] };
  }
  return { kind: 'ambiguous' };
}

/**
 * Caja del contenido (en proporción del archivo) para un fondo transparente o
 * sólido, con el margen de seguridad. null si no hay contenido o el fondo es ambiguo.
 */
export function inkBox(px: Pixels, bg: LogoBackground): LogoMetrics['ink'] | null {
  if (bg.kind === 'ambiguous') return null;
  const { data, width: w, height: h } = px;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const isBg =
        data[i + 3] < ALPHA_EMPTY ||
        (bg.kind === 'solid' && close([data[i], data[i + 1], data[i + 2]], bg.rgb, INK_TOL));
      if (isBg) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const pad = (n: number) => Math.max(1, Math.round(n * SAFETY));
  const left = Math.max(0, x0 - pad(w));
  const top = Math.max(0, y0 - pad(h));
  const right = Math.min(w, x1 + 1 + pad(w));
  const bottom = Math.min(h, y1 + 1 + pad(h));
  return { x: left / w, y: top / h, w: (right - left) / w, h: (bottom - top) / h };
}

/** Topes del logo en un lugar del encabezado. */
export interface LogoSlot {
  /** Área objetivo del contenido en px²: misma "presencia" para logos anchos y cuadrados. */
  area: number;
  minH: number;
  maxH: number;
  maxW: number;
  /** Alto máximo del ARCHIVO entero en modo estricto (tiene que entrar en la barra). */
  strictMaxH: number;
}

export type LogoLayout =
  | { mode: 'optical'; boxW: number; boxH: number; imgW: number; imgH: number; left: number; top: number }
  | { mode: 'strict'; imgH: number };

/**
 * Disposición del logo. `headerRgb` es el fondo real del encabezado: un margen
 * sólido sólo se oculta si coincide con él. Sin métricas, estricto.
 */
export function logoLayout(
  m: LogoMetrics | null,
  slot: LogoSlot,
  headerRgb: [number, number, number] | null,
  strictH: number,
): LogoLayout {
  const strict: LogoLayout = { mode: 'strict', imgH: Math.min(strictH, slot.strictMaxH) };
  if (!m) return strict;
  if (m.background.kind === 'ambiguous') return strict;
  if (m.background.kind === 'solid' && !(headerRgb && close(m.background.rgb, headerRgb, COLOR_TOL))) return strict;

  // Proporción del contenido en px del archivo (ink.w/ink.h están en proporción de cada eje).
  const aspect = (m.ink.w * m.fileAspect) / m.ink.h;
  if (!(aspect > 0) || !Number.isFinite(aspect)) return strict;
  let boxH = Math.min(slot.maxH, Math.max(slot.minH, Math.sqrt(slot.area / aspect)));
  let boxW = boxH * aspect;
  if (boxW > slot.maxW) {
    boxW = slot.maxW;
    boxH = boxW / aspect;
  }
  const imgH = boxH / m.ink.h;
  const imgW = imgH * m.fileAspect;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    mode: 'optical',
    boxW: round(boxW),
    boxH: round(boxH),
    imgW: round(imgW),
    imgH: round(imgH),
    left: round(-m.ink.x * imgW),
    top: round(-m.ink.y * imgH),
  };
}

/** "rgb(r, g, b)" / "rgba(r, g, b, a)" opaco → [r, g, b]; transparente o raro → null. */
export function parseCssColor(v: string): [number, number, number] | null {
  const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(v.trim());
  if (!m) return null;
  if (m[4] !== undefined) {
    const a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    if (a < 0.99) return null;
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// ── Navegador ────────────────────────────────────────────────────────────────

/** Lado mayor de la copia reducida que se analiza: acota el costo (a lo sumo 400×400). */
const SAMPLE_MAX = 400;
const memory = new Map<string, Promise<LogoMetrics | null>>();
const STORAGE_PREFIX = 'pc_logo_metrics_v1:';

/**
 * Mide el contenido de un logo. Una vez por URL (memoria + sessionStorage, para
 * que las páginas siguientes no esperen). Cualquier error (CORS, decodificación,
 * canvas) → null, y el logo se muestra en modo estricto.
 */
export function measureLogo(url: string): Promise<LogoMetrics | null> {
  const hit = memory.get(url);
  if (hit) return hit;
  const job = (async (): Promise<LogoMetrics | null> => {
    try {
      const saved = sessionStorage.getItem(STORAGE_PREFIX + url);
      if (saved) return JSON.parse(saved) as LogoMetrics | null;
    } catch {
      /* sin storage: se mide */
    }
    const t0 = performance.now();
    let result: LogoMetrics | null = null;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      const scale = Math.min(1, SAMPLE_MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const a0 = performance.now();
        ctx.drawImage(img, 0, 0, w, h);
        const px = ctx.getImageData(0, 0, w, h); // tira si el canvas quedó "tainted" (sin CORS)
        const background = classifyBackground(px);
        const ink = inkBox(px, background);
        if (ink) result = { ink, fileAspect: img.naturalWidth / img.naturalHeight, background };
        try {
          // Sólo el análisis (sin la descarga): el costo de CPU de la medición.
          performance.measure('procurva:logo-analysis', { start: a0, end: performance.now() });
        } catch {
          /* sin User Timing */
        }
      }
    } catch {
      result = null;
    }
    try {
      // Descarga + decodificación + análisis.
      performance.measure('procurva:logo-metrics', { start: t0, end: performance.now() });
    } catch {
      /* sin User Timing: no importa */
    }
    try {
      sessionStorage.setItem(STORAGE_PREFIX + url, JSON.stringify(result));
    } catch {
      /* sin storage */
    }
    return result;
  })();
  memory.set(url, job);
  return job;
}
