// Token de Cloudflare Turnstile para el probador virtual, a través del iframe
// centralizado https://{slug}.procurva.app/api/turnstile-frame (ver ese archivo).
//
// Por qué un iframe: Turnstile gratis admite 10 dominios por widget y sin
// comodines; "procurva.app" cubre todos los subdominios, así que el desafío corre
// siempre ahí, también para las tiendas con dominio propio. El servidor exige
// que el token venga de ESE subdominio, para ESE producto.
//
// Seguridad del canal:
//   · se le habla al iframe sólo con su origen exacto (nunca "*");
//   · se aceptan respuestas sólo de ese origen, de ESE iframe y con el nonce del pedido;
//   · cada token se usa una vez: hay que pedir uno nuevo por cada intento.

export const STORE_BASE_DOMAIN = 'procurva.app';

/** Origen del iframe. En desarrollo se puede apuntar a una tienda real con VITE_TRYON_FRAME_ORIGIN. */
export function tryonFrameOrigin(storeSlug: string): string {
  const override = (import.meta.env.VITE_TRYON_FRAME_ORIGIN || '').trim();
  return override || `https://${storeSlug.toLowerCase()}.${STORE_BASE_DOMAIN}`;
}

export function tryonFrameSrc(storeSlug: string): string {
  const origin = tryonFrameOrigin(storeSlug);
  return `${origin}/api/turnstile-frame?parent=${encodeURIComponent(window.location.origin)}`;
}

export type FrameMessage =
  | { type: 'tryon:frame-ready' }
  | { type: 'tryon:interactive'; visible: boolean }
  | { type: 'tryon:token'; token: string; nonce: string }
  | { type: 'tryon:token-error'; code: string; nonce: string | null };

/** ¿El mensaje es de NUESTRO iframe? */
export function isFromFrame(ev: MessageEvent, frame: HTMLIFrameElement | null, frameOrigin: string): boolean {
  return !!frame && ev.origin === frameOrigin && ev.source === frame.contentWindow && typeof ev.data?.type === 'string';
}

const newNonce = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Espera a que el iframe avise que cargó (tryon:frame-ready). */
export function waitFrameReady(isReady: () => boolean, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (isReady()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error('turnstile:frame-not-ready'));
      setTimeout(tick, 100);
    };
    tick();
  });
}

/**
 * Pide un token nuevo al iframe para este producto. Rechaza si el iframe no
 * responde (bloqueado, sin conexión con Cloudflare) dentro de timeoutMs.
 */
export function requestTryonToken(
  frame: HTMLIFrameElement,
  frameOrigin: string,
  productId: string,
  timeoutMs = 60_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const nonce = newNonce();
    const done = (fn: () => void) => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      fn();
    };
    const onMessage = (ev: MessageEvent) => {
      if (!isFromFrame(ev, frame, frameOrigin)) return;
      const m = ev.data as FrameMessage;
      if (m.type === 'tryon:token' && m.nonce === nonce && typeof m.token === 'string' && m.token) {
        done(() => resolve(m.token));
      } else if (m.type === 'tryon:token-error' && (m.nonce === nonce || m.nonce === null)) {
        done(() => reject(new Error(`turnstile:${m.code}`)));
      }
    };
    const timer = setTimeout(() => done(() => reject(new Error('turnstile:timeout'))), timeoutMs);
    window.addEventListener('message', onMessage);
    frame.contentWindow?.postMessage({ type: 'tryon:token-request', productId, nonce }, frameOrigin);
  });
}
