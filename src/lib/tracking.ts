// Analytics propio del storefront (tipo Tiendanube): dispara eventos de navegación a la
// Edge Function `storefront-track`, que los persiste en `storefront_events`.
//
// Independiente del tracking de ADS (metaPixel/serverEvents → track-event/marketing_events):
// esto corre para TODOS los tenants, tengan o no píxel configurado.
//
// Reglas (del audit):
//   * FALLA EN SILENCIO: un error de analytics jamás puede romper la navegación ni el checkout.
//   * R7: NO dispara NADA hasta que el tenant esté resuelto (companyId + canal). Preferimos
//     perder los primeros ms de eventos antes que registrarlos con el canal equivocado.
//   * El `purchase` NO se dispara desde el front (lo hace el webhook, fuente de verdad).

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/storefront-track`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Tenant sincronizado desde StoreProvider (ver StorefrontAnalytics). null = todavía no
// resuelto → track() hace no-op.
interface TrackingTenant {
  companyId: string;
  channel: 'minorista' | 'mayorista';
  slug: string;
}
let tenant: TrackingTenant | null = null;

/** Lo llama StorefrontAnalytics cuando el tenant queda resuelto (o se pierde). */
export function setTrackingTenant(next: TrackingTenant | null): void {
  tenant = next;
}

function getVisitorId(): string {
  try {
    let id = localStorage.getItem('pc_vid');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('pc_vid', id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

function getSessionId(): string {
  try {
    let s = sessionStorage.getItem('pc_sid');
    if (!s) {
      s = crypto.randomUUID();
      sessionStorage.setItem('pc_sid', s);
    }
    return s;
  } catch {
    return 'anon';
  }
}

type TrackEventType = 'page_view' | 'product_view' | 'add_to_cart' | 'checkout_start';

interface TrackPayload {
  product_id?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Registra un evento de navegación del storefront. Fire-and-forget: nunca lanza ni bloquea.
 * No-op hasta que el tenant esté resuelto (R7).
 */
export function track(eventType: TrackEventType, payload: TrackPayload = {}): void {
  if (!tenant) return; // R7: sin tenant resuelto no disparamos nada.
  try {
    void fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // El gateway de Supabase Functions exige apikey aunque verify_jwt=false
        // (ver reference_autoconfirm_apikey_401). Mandamos la anon key.
        ...(ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {}),
      },
      body: JSON.stringify({
        event_type: eventType,
        session_id: getSessionId(),
        visitor_id: getVisitorId(),
        channel: tenant.channel,
        company_slug: tenant.slug,
        ...payload,
      }),
      // keepalive: el evento sobrevive aunque la navegación descargue la página
      // (ej. add_to_cart seguido de navegar, checkout_start antes de redirigir a MP).
      keepalive: true,
    }).catch(() => {
      /* nunca romper la navegación por tracking */
    });
  } catch {
    /* idem */
  }
}
