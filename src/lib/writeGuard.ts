/**
 * Guarda de escrituras de las vistas previas de plantillas.
 *
 * La usan dos vistas previas que miran datos REALES de una tienda y no pueden
 * registrar visitas, pedidos, pagos, suscripciones ni nada en Supabase:
 *   - la de desarrollo (?pc_dev_tpl, lib/devTemplate, sólo vite DEV);
 *   - la del diseñador del ERP con una plantilla completa
 *     (?pc_preview=1&pc_template=<kit>, lib/templatePreviewGuard, sólo con el
 *     build de plantillas habilitado).
 *
 * Reemplaza window.fetch y navigator.sendBeacon: todo lo que no sea una lectura
 * (GET/HEAD) o una RPC de la lista de lectura se rechaza antes de salir, y las
 * Edge Functions se cortan siempre. Se instala ANTES de crear el cliente de
 * Supabase (que captura fetch al crearse): por eso los módulos que la llaman se
 * importan primero en main.tsx.
 *
 * Es una red de seguridad además de previewGuard (pedidos, pagos, newsletter,
 * reseñas, probador) e isPreviewMode (píxel, CAPI, embudo), no un reemplazo.
 */

/**
 * RPC de sólo lectura que la tienda usa para mostrar datos. Cualquier otra
 * (crear pedido, verificar contraseña, etc.) queda cortada en la vista previa.
 */
export const READ_RPCS: ReadonlySet<string> = new Set([
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

/** Motivo por el que se corta un pedido, o null si es una lectura permitida. Pura. */
export function blockedReason(method: string, url: string): string | null {
  const m = method.toUpperCase();
  if (/\/functions\/v1\//.test(url)) return 'función';
  const rpc = url.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/i);
  if (rpc) return m === 'POST' && READ_RPCS.has(rpc[1]) ? null : `rpc ${rpc[1]}`;
  if (m !== 'GET' && m !== 'HEAD') return `método ${m}`;
  return null;
}

/** Instala la guarda en esta pestaña. `log` acumula lo cortado (lo muestra la vista previa). */
export function installWriteGuard(log: string[], label: string): void {
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const reason = blockedReason(method, url);
    if (reason) {
      log.push(`${method} ${url.split('?')[0]} (${reason})`);
      console.info(`${label} pedido cortado:`, method, url.split('?')[0], reason);
      return Promise.reject(new TypeError('Vista previa de plantilla: escritura bloqueada'));
    }
    return original(input, init);
  };
  if (navigator.sendBeacon) {
    navigator.sendBeacon = (url: string | URL) => {
      log.push(`BEACON ${String(url).split('?')[0]}`);
      return true;
    };
  }
}
