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
 */

const KEY = 'pc_preview';

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
    on = new URLSearchParams(window.location.search).get(KEY) === '1';
    if (on) sessionStorage.setItem(KEY, '1');
    else on = sessionStorage.getItem(KEY) === '1';
  } catch {
    // Safari en modo privado tira al tocar sessionStorage: con la URL alcanza.
  }

  cached = on;
  return on;
}
