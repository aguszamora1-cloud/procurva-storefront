/**
 * Modo vista previa: la tienda abierta DESDE el ERP llega con `?pc_preview=1`.
 * Lo usa el panel que aparece al deslizar en la ficha del producto (y sirve
 * para cualquier otra previsualización que abramos nosotros).
 *
 * POR QUÉ: esas visitas son del comercio mirando su propio producto, no de un
 * cliente. Sin esto, cada vez que alguien desliza en una ficha se registra un
 * page_view + un product_view en `storefront_events` y un PageView/ViewContent
 * en el pixel: el embudo de conversión queda inflado con visitas propias que
 * nunca iban a comprar, y los reportes de la tienda dejan de servir.
 *
 * Se recuerda en sessionStorage porque adentro del panel se navega (la tienda
 * es una SPA) y el parámetro se pierde en el primer cambio de ruta. Es por
 * pestaña: no se contagia a la navegación real del cliente.
 *
 * Entran las dos vistas previas del ERP: `?pc_preview=1` (diseñador, panel de
 * la ficha) y `?preview=1` (la del onboarding). Esta marca SÓLO apaga la
 * analítica: el banner "Producto de ejemplo" del onboarding usa la suya propia
 * (PreviewBanner), porque compartirla lo hacía aparecer en el diseñador.
 */

const KEY = 'pc_preview';
/** Parámetros de URL que marcan una vista previa nuestra. */
const URL_PARAMS = ['pc_preview', 'preview'];

let cached: boolean | null = null;

/** true si esta pestaña es una vista previa nuestra (no cuenta para analytics). */
export function isPreviewMode(): boolean {
  if (cached !== null) return cached;
  if (typeof window === 'undefined') {
    cached = false;
    return cached;
  }

  let on = false;
  try {
    const params = new URLSearchParams(window.location.search);
    on = URL_PARAMS.some((p) => params.get(p) === '1');
    if (on) sessionStorage.setItem(KEY, '1');
    else on = sessionStorage.getItem(KEY) === '1';
  } catch {
    // Safari en modo privado tira al tocar sessionStorage: con la URL alcanza.
  }

  cached = on;
  return on;
}
