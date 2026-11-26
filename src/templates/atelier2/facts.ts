/**
 * Atelier 2 · A4: qué datos de la ficha muestra la plantilla.
 *
 * storeConfig (lib/storeConfig.ts) completa con valores por defecto lo que el
 * comercio nunca guardó, y la configuración ya normalizada no dice cuál es cuál.
 * Classic muestra esos valores como si fueran del comercio; Atelier 2 (mismo
 * criterio que FIN0 en Atelier 1) sólo muestra lo que se puede distinguir como
 * configurado. Ningún número ni texto cambia: acá sólo se decide si se muestra.
 *
 * Cuotas: storeConfig expone `installmentsExplicit` (presencia de la clave
 * guardada), así que no se infiere nada. Promesa de envío e insignias: las
 * constantes repiten los valores por defecto de lib/storeConfig.ts (no están
 * exportados); diagnóstico aparte en BLOQUEOS_ORDEN_Y_CUOTAS.md.
 */
import type { StoreConfig } from '@/lib/types';

/** lib/storeConfig.ts · DEFAULTS.shippingPromiseTitle. */
export const DEFAULT_SHIPPING_TITLE = 'Envío rápido';
/** lib/storeConfig.ts · trustBadgeLabels cuando falta trust_badges (después del título de envío). */
export const DEFAULT_TRUST_LABELS = ['Abonás al recibir', 'Pagás como quieras', 'Compra protegida'];

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

/** Promesa de envío: encendida y con un título propio o un subtítulo (el subtítulo nunca tiene valor por defecto). */
export function shippingPromiseBacked(c: Pick<StoreConfig, 'shippingPromiseEnabled' | 'shippingPromiseTitle' | 'shippingPromiseSubtitle'>): boolean {
  if (!c.shippingPromiseEnabled) return false;
  if (c.shippingPromiseSubtitle) return true;
  return Boolean(c.shippingPromiseTitle) && c.shippingPromiseTitle !== DEFAULT_SHIPPING_TITLE;
}

/** Insignias de confianza: encendidas y distintas de la lista por defecto («Abonás al recibir»…). */
export function trustBadgesBacked(c: Pick<StoreConfig, 'sections' | 'trustBadgeLabels' | 'shippingPromiseTitle'>): boolean {
  if (!c.sections.trustBadges || c.trustBadgeLabels.length === 0) return false;
  const fallback = [c.shippingPromiseTitle, ...DEFAULT_TRUST_LABELS].filter(Boolean);
  return !(c.trustBadgeLabels.length === fallback.length && c.trustBadgeLabels.every((l, i) => l === fallback[i]));
}
