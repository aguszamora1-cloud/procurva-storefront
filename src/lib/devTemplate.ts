/**
 * Plantillas V2 · P1.1: vista previa de plantillas comerciales SÓLO en desarrollo.
 *
 *   ?pc_dev_tpl=atelier|distrito|momentum   elige la plantilla (queda en la pestaña)
 *   ?pc_dev_tpl=off                          vuelve a Classic
 *
 * Todo depende de `import.meta.env.DEV`: en el build de producción es `false`
 * literal, la rama desaparece y ninguna URL pública puede elegir una plantilla.
 * No lee ni escribe la configuración de la tienda: la elección vive sólo en la
 * sessionStorage de la pestaña.
 *
 * Con una plantilla elegida se instala además una guarda de escrituras (ver
 * installPreviewWriteGuard): la vista previa mira datos reales de una tienda y
 * no puede registrar visitas, pedidos, suscripciones ni nada en Supabase.
 * Este módulo se importa PRIMERO en main.tsx para que la guarda quede puesta
 * antes de que se cree el cliente de Supabase.
 */

export const DEV_TEMPLATE_IDS = ['atelier', 'distrito', 'momentum'] as const;
export type DevTemplateId = (typeof DEV_TEMPLATE_IDS)[number];

const PARAM = 'pc_dev_tpl';
const STORAGE_KEY = 'pc_dev_tpl';

export function isDevTemplateId(v: unknown): v is DevTemplateId {
  return typeof v === 'string' && (DEV_TEMPLATE_IDS as readonly string[]).includes(v);
}

function readDevTemplate(): DevTemplateId | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(PARAM);
    if (fromUrl === 'off') {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (isDevTemplateId(fromUrl)) {
      sessionStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return isDevTemplateId(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** Plantilla elegida para esta pestaña (null = Classic). Se lee una vez al cargar. */
export const devTemplate: DevTemplateId | null =
  import.meta.env.DEV && typeof window !== 'undefined' ? readDevTemplate() : null;

/** Cambia de plantilla recargando la página (null = Classic). */
export function switchDevTemplate(id: DevTemplateId | null) {
  if (!import.meta.env.DEV) return;
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM, id ?? 'off');
  window.location.assign(url.toString());
}

/**
 * RPC de sólo lectura que la tienda usa para mostrar datos. Cualquier otra
 * (crear pedido, verificar contraseña, etc.) queda cortada en la vista previa.
 */
const READ_RPCS = new Set([
  'get_storefront_by_slug',
  'get_storefront_by_custom_domain',
  'get_company_colors',
  'get_home_section_pins',
  'get_top_selling_products',
  'get_product_reviews',
  'get_product_rating_summary',
  'get_catalog_shipping_methods',
  'tryon_available',
  'storefront_coupon_lookup',
  'catalog_cart_stock_shortfalls',
]);

export const blockedRequests: string[] = [];

function blockedReason(method: string, url: string): string | null {
  const m = method.toUpperCase();
  if (/\/functions\/v1\//.test(url)) return 'función';
  const rpc = url.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/i);
  if (rpc) return m === 'POST' && READ_RPCS.has(rpc[1]) ? null : `rpc ${rpc[1]}`;
  if (m !== 'GET' && m !== 'HEAD') return `método ${m}`;
  return null;
}

function installPreviewWriteGuard() {
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const reason = blockedReason(method, url);
    if (reason) {
      blockedRequests.push(`${method} ${url.split('?')[0]} (${reason})`);
      console.info('[vista previa] pedido cortado:', method, url.split('?')[0], reason);
      return Promise.reject(new TypeError('Vista previa de plantilla: escritura bloqueada'));
    }
    return original(input, init);
  };
  if (navigator.sendBeacon) {
    navigator.sendBeacon = (url: string | URL) => {
      blockedRequests.push(`BEACON ${String(url).split('?')[0]}`);
      return true;
    };
  }
}

if (import.meta.env.DEV && devTemplate) installPreviewWriteGuard();
