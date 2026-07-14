/**
 * Wrapper tipado del Meta (Facebook) Pixel para el storefront.
 *
 * El snippet BASE del pixel lo inyecta `components/Analytics.tsx` (sólo si el
 * tenant cargó `meta_pixel_id` en su config) y dispara el PageView inicial.
 * Acá centralizamos los EVENTOS de ecommerce, el PageView de navegación SPA y
 * la lógica de Purchase (stash al pagar + disparo en la pantalla de éxito).
 *
 * Todo es no-op si el pixel no está cargado: si el tenant no configuró
 * `meta_pixel_id`, `window.fbq` nunca existe y cada llamada sale temprano. No
 * se hardcodea ningún ID — el pixel siempre lo instala Analytics desde la config
 * del tenant.
 */

import { sendServerEvent } from '@/lib/serverEvents';

export type MetaPixelEvent =
  | 'PageView'
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase';

/** Parámetros estándar de los eventos de ecommerce de Meta. */
export interface MetaPixelParams {
  content_ids?: string[];
  content_name?: string;
  content_type?: 'product' | 'product_group';
  value?: number;
  currency?: string;
  num_items?: number;
}

/** Opciones del evento (Meta usa eventID para deduplicar pixel <-> CAPI). */
interface FbqOptions {
  eventID?: string;
}

/** Firma del global `fbq` que instala el snippet base de Meta. */
interface Fbq {
  (command: 'init', pixelId: string): void;
  (command: 'track', event: MetaPixelEvent, params?: MetaPixelParams, options?: FbqOptions): void;
  (command: 'trackCustom', event: string, params?: MetaPixelParams, options?: FbqOptions): void;
  queue?: unknown[];
  loaded?: boolean;
}

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

/** Moneda fija del storefront (mercado argentino). */
export const META_PIXEL_CURRENCY = 'ARS';

/** Devuelve el `fbq` del tenant si el pixel está cargado, si no `null` (no-op). */
function getFbq(): Fbq | null {
  if (typeof window === 'undefined') return null;
  const fbq = window.fbq;
  return typeof fbq === 'function' ? fbq : null;
}

/**
 * Dispara un evento estándar del pixel. No-op si el pixel no está cargado.
 * `eventId` (opcional) se pasa como { eventID } → Meta lo usa para deduplicar contra
 * el mismo evento enviado por CAPI (server-side) con ese id.
 */
export function trackMetaPixelEvent(event: MetaPixelEvent, params?: MetaPixelParams, eventId?: string): void {
  const fbq = getFbq();
  if (!fbq) return;
  const opts = eventId ? { eventID: eventId } : undefined;
  if (params) fbq('track', event, params, opts);
  else fbq('track', event, undefined, opts);
}

// ── Trackers de ecommerce ──────────────────────────────────────────────────

/** ViewContent: al abrir el detalle de un producto. */
export function trackViewContent(p: { contentId: string; name: string; value: number }, eventId?: string): void {
  trackMetaPixelEvent('ViewContent', {
    content_ids: [p.contentId],
    content_name: p.name,
    content_type: 'product',
    value: p.value,
    currency: META_PIXEL_CURRENCY,
  }, eventId);
}

/** AddToCart: al agregar un producto al carrito. */
export function trackAddToCart(p: { contentId: string; name: string; value: number }, eventId?: string): void {
  trackMetaPixelEvent('AddToCart', {
    content_ids: [p.contentId],
    content_name: p.name,
    value: p.value,
    currency: META_PIXEL_CURRENCY,
  }, eventId);
}

/** InitiateCheckout: al entrar al checkout con el carrito cargado. */
export function trackInitiateCheckout(p: { contentIds: string[]; value: number; numItems: number }, eventId?: string): void {
  trackMetaPixelEvent('InitiateCheckout', {
    content_ids: p.contentIds,
    value: p.value,
    currency: META_PIXEL_CURRENCY,
    num_items: p.numItems,
  }, eventId);
}

// ── Purchase: stash al iniciar el pago, flush en la pantalla de éxito ───────
//
// El Purchase se dispara SÓLO en los flujos con pasarela online (Mercado Pago /
// GoCuotas), que son los que confirman pago. Como esos flujos redirigen fuera
// del sitio y vuelven a /checkout/success, guardamos los datos del pedido en
// sessionStorage ANTES de redirigir (sobrevive la ida y vuelta en la misma
// pestaña) y los disparamos al volver. La transferencia directa y el cierre por
// WhatsApp NO confirman pago todavía, así que no generan Purchase.

const PENDING_KEY = 'procurva_meta_pending_purchase';
const TRACKED_KEY = 'procurva_meta_tracked_purchases';
// Pedidos cuyo Purchase server-side (CAPI) ya se disparó en este page load — evita
// re-disparar en los reintentos del flush mientras el pixel del browser termina de cargar.
const serverFired = new Set<string>();

export interface PendingPurchase {
  orderId: string;
  value: number;
  contentIds: string[];
  numItems: number;
  // Para el disparo dual (pixel + CAPI) del Purchase, deduplicado por eventId.
  eventId?: string;
  companyId?: string;
  userData?: { email?: string; phone?: string };
}

/**
 * Guarda los datos de la compra antes de redirigir a la pasarela. Idempotente:
 * un stash nuevo pisa al anterior. No-op si sessionStorage no está disponible.
 */
export function stashPendingPurchase(p: PendingPurchase): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    /* sessionStorage no disponible: simplemente no se trackea Purchase */
  }
}

/** IDs de pedidos ya trackeados (dedup ante recargas de la pantalla de éxito). */
function readTracked(): string[] {
  try {
    const raw = localStorage.getItem(TRACKED_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function markTracked(orderId: string): void {
  try {
    // Mantenemos sólo los últimos 50 para no crecer sin límite.
    const next = [...readTracked().filter((id) => id !== orderId), orderId].slice(-50);
    localStorage.setItem(TRACKED_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

function clearStash(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Dispara Purchase una sola vez por pedido en la pantalla de éxito.
 *
 * Devuelve `true` cuando ya no queda nada pendiente (disparó, no había stash, o
 * el pedido ya estaba trackeado) y `false` cuando hay una compra pendiente pero
 * el pixel todavía no terminó de cargar — la pantalla de éxito reintenta unas
 * veces (al volver de la pasarela el tenant puede resolver de forma asíncrona).
 */
export function flushPendingPurchase(): boolean {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(PENDING_KEY);
  } catch {
    return true;
  }
  if (!raw) return true; // nada que disparar

  let p: PendingPurchase | null = null;
  try {
    p = JSON.parse(raw) as PendingPurchase;
  } catch {
    p = null;
  }
  if (!p || !p.orderId) {
    clearStash();
    return true;
  }

  // Dedup: si recargás la pantalla de éxito, no re-disparamos el mismo pedido.
  if (readTracked().includes(p.orderId)) {
    clearStash();
    return true;
  }

  // CAPI (server-side) primero: se dispara SIEMPRE que haya companyId, incluso si el pixel
  // del browser no cargó (adblocker) — es justamente lo que CAPI recupera. Dedup por eventId.
  // El guard `serverFired` evita re-disparar en los reintentos del flush (mismo page load);
  // entre reloads deduplica el edge fn por (company_id,event_id).
  if (p.companyId && p.eventId && !serverFired.has(p.orderId)) {
    serverFired.add(p.orderId);
    sendServerEvent({
      companyId: p.companyId,
      eventId: p.eventId,
      eventName: 'Purchase',
      value: p.value,
      currency: META_PIXEL_CURRENCY,
      contentIds: p.contentIds,
      orderId: p.orderId,
      userData: p.userData,
    });
  }

  // Pixel aún no cargado: dejamos el stash y pedimos reintento (el CAPI ya salió arriba;
  // el edge fn deduplica por (company_id,event_id), así que un reintento no duplica).
  if (!getFbq()) return false;

  trackMetaPixelEvent('Purchase', {
    content_ids: p.contentIds,
    content_type: 'product',
    value: p.value,
    currency: META_PIXEL_CURRENCY,
    num_items: p.numItems,
  }, p.eventId);
  markTracked(p.orderId);
  clearStash();
  return true;
}
