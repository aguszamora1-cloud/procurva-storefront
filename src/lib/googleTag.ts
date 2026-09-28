/**
 * Wrapper de la etiqueta de Google (gtag.js) para el storefront: GA4 y Google Ads.
 *
 * El snippet BASE lo inyecta `components/Analytics.tsx` (sólo si el tenant conectó
 * Google en Marketing → Publicidad, que llega como `ga_id`). Acá van los EVENTOS de
 * ecommerce con los nombres recomendados de GA4 (view_item, add_to_cart,
 * begin_checkout, purchase): son los que Google Ads importa como conversiones.
 *
 * Todo es no-op si la etiqueta no está cargada (`window.gtag` no existe). Los
 * page_view de la navegación SPA los manda GA4 solo (medición mejorada →
 * "cambios en el historial del navegador"), por eso no se disparan a mano.
 */

import { currencyCode } from './regional';

/** IDs válidos de etiqueta de Google: GA4 (G-), Google Ads (AW-), etiqueta unificada (GT-). */
const TAG_ID_RE = /^(G|AW|GT|DC)-[A-Z0-9]{4,20}$/;

/** Normaliza el ID cargado por el comercio; devuelve '' si no tiene forma de ID de Google.
 *  Se valida porque termina interpolado dentro de un <script>. */
export function normalizeGoogleTagId(raw: string | undefined | null): string {
  const id = (raw || '').trim().toUpperCase();
  return TAG_ID_RE.test(id) ? id : '';
}

type Gtag = (command: 'event' | 'config' | 'js', target: string | Date, params?: Record<string, unknown>) => void;

declare global {
  interface Window {
    gtag?: Gtag;
  }
}

function getGtag(): Gtag | null {
  if (typeof window === 'undefined') return null;
  return typeof window.gtag === 'function' ? window.gtag : null;
}

/** ¿La etiqueta de Google está instalada en esta página? */
export function isGoogleTagLoaded(): boolean {
  return !!getGtag();
}

interface GoogleItem {
  item_id: string;
  item_name?: string;
  price?: number;
  quantity?: number;
}

function trackGoogleEvent(name: string, params: Record<string, unknown>): void {
  const gtag = getGtag();
  if (!gtag) return;
  try {
    gtag('event', name, { currency: currencyCode(), ...params });
  } catch {
    /* un error de analytics nunca rompe la tienda */
  }
}

export function trackGoogleViewItem(p: { contentId: string; name: string; value: number }): void {
  trackGoogleEvent('view_item', {
    value: p.value,
    items: [{ item_id: p.contentId, item_name: p.name, price: p.value, quantity: 1 } satisfies GoogleItem],
  });
}

export function trackGoogleAddToCart(p: { contentId: string; name: string; value: number }): void {
  trackGoogleEvent('add_to_cart', {
    value: p.value,
    items: [{ item_id: p.contentId, item_name: p.name, price: p.value, quantity: 1 } satisfies GoogleItem],
  });
}

export function trackGoogleBeginCheckout(p: { contentIds: string[]; value: number }): void {
  trackGoogleEvent('begin_checkout', {
    value: p.value,
    items: p.contentIds.map((id): GoogleItem => ({ item_id: id })),
  });
}

/** purchase: `transaction_id` es lo que usa Google para no contar dos veces el mismo pedido. */
export function trackGooglePurchase(p: { orderId: string; value: number; contentIds: string[] }): void {
  trackGoogleEvent('purchase', {
    transaction_id: p.orderId,
    value: p.value,
    items: p.contentIds.map((id): GoogleItem => ({ item_id: id })),
  });
}
