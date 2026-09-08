/**
 * Atribución de origen de la visita: de qué anuncio / red / link vino el comprador.
 *
 * Problema que resuelve (AUDIT_ADS_ROI §Q1-Q2): la tienda es una SPA. Los parámetros
 * con los que aterriza el visitante (`?utm_campaign=...&fbclid=...`) desaparecen de la
 * URL en el primer click, y el pedido se crea varias pantallas después (o al VOLVER de
 * MercadoPago, donde la URL original ya no existe). Sin persistirlos, "cuánto vendí por
 * esta campaña" no es calculable.
 *
 * Qué hace:
 *   * `captureAttribution()` corre UNA vez al cargar la tienda (main.tsx), antes del
 *     router: lee `utm_*` + click-ids (fbclid/gclid/ttclid/...) + referrer y los guarda
 *     en localStorage con fecha.
 *   * `getAttribution()` lo devuelve al momento de crear el pedido (orders.ts). Viaja en
 *     `catalog_orders.attribution` y los webhooks lo copian a `orders.meta.attribution`,
 *     de donde lo cruzan las RPCs de Marketing → Publicidad → Campañas.
 *
 * Modelo: ÚLTIMO toque no directo, con ventana de 28 días (la ventana de click máxima
 * que usa Meta). Un click en un anuncio (con parámetros) pesa más que un referido sin
 * parámetros: si alguien entra por el anuncio y vuelve a los tres días por el link de
 * la bio, la venta sigue siendo del anuncio. Guardamos también el PRIMER toque para no
 * perder información, pero el cruce por campaña usa el último.
 *
 * Reglas: falla en silencio (nunca rompe la tienda) y no guarda datos personales:
 * solo parámetros de campaña, click-ids y el host del referrer.
 */

const LAST_KEY = 'pc_attr_last';
const FIRST_KEY = 'pc_attr_first';
const WINDOW_DAYS = 28;

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_content', 'utm_term'] as const;
const CLICK_KEYS = ['fbclid', 'gclid', 'wbraid', 'gbraid', 'ttclid'] as const;
type ParamKey = (typeof UTM_KEYS)[number] | (typeof CLICK_KEYS)[number];

export interface Touch extends Partial<Record<ParamKey, string>> {
  /** Host del sitio de donde vino (instagram.com, l.instagram.com, google.com...). */
  referrer?: string;
  /** Ruta + query de aterrizaje. */
  landing?: string;
  /** ISO del momento del toque. */
  at: string;
}

function readTouch(key: string): Touch | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const t = JSON.parse(raw) as Touch;
    return t && typeof t.at === 'string' ? t : null;
  } catch {
    return null;
  }
}

function writeTouch(key: string, t: Touch): void {
  try {
    localStorage.setItem(key, JSON.stringify(t));
  } catch {
    /* modo privado / storage lleno: perdemos la atribución, no la venta */
  }
}

function isExpired(t: Touch): boolean {
  const ms = Date.now() - new Date(t.at).getTime();
  return !Number.isFinite(ms) || ms > WINDOW_DAYS * 86_400_000;
}

/** Tiene parámetros de campaña o click-id (vs. un referido pelado). */
function isTagged(t: Touch): boolean {
  return [...UTM_KEYS, ...CLICK_KEYS].some((k) => !!t[k]);
}

/** Host del referrer si es EXTERNO a la tienda; vacío si es navegación interna o directo. */
function externalReferrerHost(): string {
  try {
    if (!document.referrer) return '';
    const host = new URL(document.referrer).hostname.toLowerCase();
    return host && host !== window.location.hostname.toLowerCase() ? host.slice(0, 120) : '';
  } catch {
    return '';
  }
}

function cookie(name: string): string | undefined {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return m ? decodeURIComponent(m[1]).slice(0, 200) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Lee la URL de aterrizaje y guarda el toque. Idempotente por carga: si la URL no trae
 * nada y no hay referrer externo (entrada directa), no pisa el origen conocido.
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const touch: Touch = { at: new Date().toISOString() };
    let tagged = false;
    for (const k of [...UTM_KEYS, ...CLICK_KEYS]) {
      const v = (params.get(k) || '').trim().slice(0, 200);
      if (v) {
        touch[k] = v;
        tagged = true;
      }
    }
    const ref = externalReferrerHost();
    if (ref) touch.referrer = ref;
    if (!tagged && !ref) return; // directo: no hay nada nuevo que decir

    touch.landing = (window.location.pathname + window.location.search).slice(0, 500);

    const prevLast = readTouch(LAST_KEY);
    // Un referido sin parámetros no pisa un click de anuncio todavía vigente.
    const keepPrev = !tagged && prevLast !== null && isTagged(prevLast) && !isExpired(prevLast);
    if (!keepPrev) writeTouch(LAST_KEY, touch);

    const prevFirst = readTouch(FIRST_KEY);
    if (!prevFirst || isExpired(prevFirst)) writeTouch(FIRST_KEY, touch);
  } catch {
    /* nunca romper la tienda por atribución */
  }
}

/**
 * Atribución para guardar en el pedido. `null` si no sabemos nada (entrada directa sin
 * cookies del pixel), así el pedido queda sin la clave en vez de con un objeto vacío.
 *
 * Los campos del último toque van sueltos en la raíz (son los que cruza el ERP); el
 * primero, anidado en `first`. `fbp`/`fbc` son las cookies del pixel de Meta: mejoran el
 * match de la Conversions API y confirman que hubo un click de Meta aunque el fbclid ya
 * no esté en la URL.
 */
export function getAttribution(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const last = readTouch(LAST_KEY);
    const first = readTouch(FIRST_KEY);
    const fbp = cookie('_fbp');
    const fbc = cookie('_fbc');
    const lastValid = last && !isExpired(last) ? last : null;
    if (!lastValid && !first && !fbp && !fbc) return null;
    return {
      ...(lastValid || {}),
      ...(first ? { first } : {}),
      ...(fbp ? { fbp } : {}),
      ...(fbc ? { fbc } : {}),
      model: 'last_non_direct',
      window_days: WINDOW_DAYS,
      captured_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Click-id vigente (fbclid / ttclid) aunque ya no esté en la URL, para la CAPI. */
export function getStoredClickId(key: 'fbclid' | 'ttclid'): string | undefined {
  const last = readTouch(LAST_KEY);
  return last && !isExpired(last) ? last[key] : undefined;
}

/** Cookies del pixel de Meta, para que la CAPI matchee la misma sesión que el pixel. */
export function getMetaCookies(): { fbp?: string; fbc?: string } {
  return { fbp: cookie('_fbp'), fbc: cookie('_fbc') };
}
