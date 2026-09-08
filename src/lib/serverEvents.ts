/**
 * Disparo server-side de eventos (Conversions API) vía la Edge Function track-event.
 *
 * Es el par server del pixel del browser: se dispara con el MISMO event_id que el pixel
 * (fbq con { eventID }), así Meta/TikTok/Google deduplican y cuentan UNA sola conversión.
 * El navegador puede bloquear el pixel; no puede bloquear que nuestro servidor le hable a
 * la plataforma → CAPI recupera el ~30-40% de eventos que el pixel pierde.
 *
 * Fire-and-forget: nunca bloquea la UI ni rompe la tienda si falla. El access_token vive
 * solo en el Edge Function (service_role); acá no se toca ningún secreto.
 */
import { supabase } from '@/lib/supabase';
import { currencyCode } from './regional';
import { getStoredClickId, getMetaCookies } from './attribution';

export interface ServerEventInput {
  companyId: string;
  eventId: string;
  eventName: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase';
  value?: number;
  currency?: string;
  contentIds?: string[];
  sourceUrl?: string;
  channel?: string;
  orderId?: string;
  userData?: { email?: string; phone?: string };
}

export function sendServerEvent(ev: ServerEventInput): void {
  if (!ev.companyId || !ev.eventId) return;
  const body = {
    company_id: ev.companyId,
    event_id: ev.eventId,
    event_name: ev.eventName,
    value: ev.value,
    currency: ev.currency || currencyCode(),
    content_ids: ev.contentIds,
    source_url: ev.sourceUrl || (typeof window !== 'undefined' ? window.location.href : undefined),
    channel: ev.channel,
    order_id: ev.orderId,
    user_data: ev.userData,
    // El click-id de la URL de aterrizaje ya no está cuando se dispara AddToCart ni el
    // Purchase (que vuelve de la pasarela): caemos al que guardó captureAttribution().
    fbclid: readParam('fbclid') || getStoredClickId('fbclid'),
    ttclid: readParam('ttclid') || getStoredClickId('ttclid'),
    // Cookies del pixel: Meta matchea el evento server-side con la misma sesión del browser.
    ...getMetaCookies(),
  };
  // No await: el tracking no debe agregar latencia ni romper el flujo de compra.
  supabase.functions.invoke('track-event', { body }).catch(() => {
    /* CAPI nunca rompe la tienda */
  });
}

/** Lee un click-id de la URL (fbclid/ttclid) para mejorar el match de atribución. */
function readParam(key: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return new URLSearchParams(window.location.search).get(key) || undefined;
  } catch {
    return undefined;
  }
}
