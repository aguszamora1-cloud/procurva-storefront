/**
 * Atelier 2 · A4: qué datos de la ficha muestra la plantilla.
 *
 * storeConfig (lib/storeConfig.ts) completa con valores por defecto lo que el
 * comercio nunca guardó, y la configuración ya normalizada no dice cuál es cuál.
 * Classic muestra esos valores como si fueran del comercio; Atelier 2 (mismo
 * criterio que FIN0 en Atelier 1) sólo muestra lo que se puede distinguir como
 * configurado. Ningún número ni texto cambia: acá sólo se decide si se muestra.
 *
 * Las constantes repiten los valores por defecto de lib/storeConfig.ts (no están
 * exportados). Decisión pendiente, documentada en A4_ENTREGA.md: si storeConfig
 * expusiera «configurado o por defecto», estas reglas se reemplazan por ese dato.
 */
import type { StoreConfig } from '@/lib/types';

/** lib/storeConfig.ts · installmentsCount cuando falta card_installments. */
export const DEFAULT_INSTALLMENTS = 3;
/** lib/storeConfig.ts · DEFAULTS.shippingPromiseTitle. */
export const DEFAULT_SHIPPING_TITLE = 'Envío rápido';
/** lib/storeConfig.ts · trustBadgeLabels cuando falta trust_badges (después del título de envío). */
export const DEFAULT_TRUST_LABELS = ['Abonás al recibir', 'Pagás como quieras', 'Compra protegida'];

/**
 * Renglón de cuotas (installmentsLabel): sólo con otra cantidad que la de por
 * defecto o con el «Texto informativo Tarjeta» escrito por el comercio. Con 0 el
 * comercio eligió no anunciar cuotas (installmentsLabel ya devuelve vacío).
 */
export function installmentsBacked(c: Pick<StoreConfig, 'installmentsCount' | 'cardPaymentText'>): boolean {
  if (c.installmentsCount <= 0) return false;
  return Boolean(c.cardPaymentText) || c.installmentsCount !== DEFAULT_INSTALLMENTS;
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
