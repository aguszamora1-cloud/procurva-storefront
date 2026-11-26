/**
 * Atelier 2 · A4: qué datos de la ficha muestra la plantilla.
 *
 * storeConfig (lib/storeConfig.ts) completa con valores por defecto lo que el
 * comercio nunca guardó, y la configuración ya normalizada no dice cuál es cuál.
 * Classic muestra esos valores como si fueran del comercio; Atelier 2 (mismo
 * criterio que FIN0 en Atelier 1) sólo muestra lo que se puede distinguir como
 * configurado. Ningún número ni texto cambia: acá sólo se decide si se muestra.
 *
 * Nada se decide comparando textos con un valor por defecto: storeConfig expone
 * la presencia del dato guardado (`installmentsExplicit`,
 * `shippingPromiseTitleExplicit`). Lo que no se puede demostrar, no se muestra.
 */
import type { StoreConfig } from '@/lib/types';

/**
 * Renglón de cuotas (installmentsLabel): sólo con una configuración explícita del
 * comercio. `installmentsExplicit` (storeConfig) dice si `card_installments` está
 * guardado; sin la clave, el 3 es el valor por defecto y no se anuncia. El
 * «Texto informativo Tarjeta» también es explícito: lo escribe el comercio y
 * nunca tiene valor por defecto. Con 0 el comercio eligió no anunciar cuotas
 * (installmentsLabel ya devuelve vacío, también para el texto).
 */
export function installmentsBacked(c: Pick<StoreConfig, 'installmentsCount' | 'installmentsExplicit' | 'cardPaymentText'>): boolean {
  if (c.installmentsCount <= 0) return false;
  return c.installmentsExplicit === true || Boolean(c.cardPaymentText);
}

/**
 * Promesa de envío: qué renglones mostrar, o null para no mostrarla.
 * - Apagada por el comercio (shipping_promise_enabled), no se muestra; la
 *   visibilidad del bloque en el diseño de la ficha la decide la plantilla.
 * - Título: sólo si el comercio lo guardó (`shippingPromiseTitleExplicit`); sin
 *   la clave, «Envío rápido» es el valor por defecto y no se anuncia.
 * - Subtítulo: storeConfig no le pone valor por defecto, así que un subtítulo
 *   con texto siempre es el que guardó el comercio.
 */
export function shippingPromiseLines(
  c: Pick<StoreConfig, 'shippingPromiseEnabled' | 'shippingPromiseTitle' | 'shippingPromiseTitleExplicit' | 'shippingPromiseSubtitle'>,
): { title: string; subtitle: string } | null {
  if (!c.shippingPromiseEnabled) return null;
  const title = c.shippingPromiseTitleExplicit === true ? c.shippingPromiseTitle.trim() : '';
  const subtitle = c.shippingPromiseSubtitle.trim();
  return title || subtitle ? { title, subtitle } : null;
}

/**
 * Insignias de confianza: ocultas en Atelier 2 (decisión de Agus del 26/11,
 * opción B). No se puede demostrar qué etiqueta eligió el comercio: al editar
 * una, el editor guarda las cuatro, y la lista por defecto del editor no es la
 * de la tienda. Pendiente de producto antes de A8: que el editor guarde cada
 * etiqueta sólo cuando el comercio la escribe. Classic no cambia.
 */
export function trustBadgesBacked(): boolean {
  return false;
}
