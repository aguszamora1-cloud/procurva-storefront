/**
 * EDITOR E2.0c · ¿esta tienda está enmarcada por el ERP de ProCurva?
 *
 * Responde SIN depender del handshake del canal (lib/previewChannel), con señales
 * que pone el NAVEGADOR y que un sitio ajeno no puede falsificar:
 *  1. `location.ancestorOrigins[0]` (Chromium, Safari): el origen del padre directo.
 *  2. Si no existe (Firefox): el origen de `document.referrer` del documento que
 *     cargó el iframe. Quien enmarca puede SUPRIMIRLO (referrerpolicy), pero no
 *     cambiarlo por otro origen.
 *  3. Una marca en sessionStorage que deja el primer documento que detectó al ERP,
 *     para las navegaciones completas dentro del mismo marco (en Firefox el
 *     referrer pasa a ser la propia tienda). sessionStorage de un iframe está
 *     particionado por el sitio de arriba: una pestaña normal de la tienda o un
 *     marco de otro sitio no la ven.
 * `?pc_preview=1` NO interviene: cualquiera lo agrega y no dice quién enmarca.
 *
 * Qué se hace con esto: si es 'designer', las operaciones reales se bloquean desde
 * el arranque (lib/previewGuard), aunque el handshake falle o tarde. Una pestaña
 * normal ('top') o enmarcada por otro sitio ('other') nunca se bloquea por esto.
 * Falsificar una señal sólo puede bloquear el marco de quien la falsifica.
 */

export type FrameKind = 'top' | 'designer' | 'other' | 'unknown';

export const DESIGNER_MARK_KEY = 'pc_designer_frame';

export interface FrameSignals {
  framed: boolean;
  /** location.ancestorOrigins como lista; null si el navegador no lo tiene. */
  ancestorOrigins: string[] | null;
  referrer: string;
  /** ¿Un documento anterior de ESTE marco ya detectó al ERP? */
  marked: boolean;
  erpOrigins: readonly string[];
}

function originOf(url: string): string | null {
  if (!url) return null;
  try {
    const o = new URL(url).origin;
    return o && o !== 'null' ? o : null;
  } catch {
    return null;
  }
}

/** Clasificación pura (probada en scripts/check-preview-channel.mjs). */
export function classifyFrame(s: FrameSignals): FrameKind {
  if (!s.framed) return 'top';
  // 1) El navegador dice quién es el padre: es la única respuesta que vale.
  if (s.ancestorOrigins && s.ancestorOrigins.length > 0) {
    const parent = s.ancestorOrigins[0];
    if (parent && parent !== 'null') return s.erpOrigins.includes(parent) ? 'designer' : 'other';
  }
  // 2) Sin ancestorOrigins: el referrer del documento inicial.
  const ref = originOf(s.referrer);
  if (ref && s.erpOrigins.includes(ref)) return 'designer';
  // 3) Navegación dentro del mismo marco que ya era del diseñador.
  if (s.marked) return 'designer';
  return ref ? 'other' : 'unknown';
}

let kind: FrameKind | null = null;

/** Se calcula una vez por documento (main.tsx), antes de pintar la tienda. */
export function initDesignerFrame(erpOrigins: readonly string[]): FrameKind {
  if (kind) return kind;
  let framed = false;
  try {
    framed = window.parent !== window;
  } catch {
    framed = true;
  }
  if (!framed) {
    kind = 'top';
    return kind;
  }
  let ancestors: string[] | null = null;
  try {
    const ao = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
    if (ao && typeof ao.length === 'number') ancestors = Array.from({ length: ao.length }, (_, i) => ao[i]);
  } catch {
    ancestors = null;
  }
  let marked = false;
  try {
    marked = sessionStorage.getItem(DESIGNER_MARK_KEY) === '1';
  } catch {
    marked = false;
  }
  kind = classifyFrame({ framed, ancestorOrigins: ancestors, referrer: document.referrer || '', marked, erpOrigins });
  // Marca visible para estilos y pruebas. Una pestaña normal ('top') no la lleva.
  document.documentElement.dataset.pcFrame = kind;
  if (kind === 'designer') {
    try {
      sessionStorage.setItem(DESIGNER_MARK_KEY, '1');
    } catch {
      /* sin storage: queda la detección de este documento */
    }
  }
  return kind;
}

/** ¿El ERP enmarca esta tienda? (false si todavía no se calculó: nunca bloquea por defecto). */
export function isDesignerFrame(): boolean {
  return kind === 'designer';
}

export function frameKind(): FrameKind | null {
  return kind;
}
