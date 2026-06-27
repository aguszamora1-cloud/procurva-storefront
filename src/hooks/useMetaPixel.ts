import { trackAddToCart, trackInitiateCheckout, trackViewContent } from '@/lib/metaPixel';

/**
 * API de tracking del Meta Pixel para los componentes del storefront.
 *
 * El snippet base lo inyecta `components/Analytics.tsx` (sólo si el tenant cargó
 * `meta_pixel_id` en su config). Estos trackers son no-op si el pixel no está
 * cargado, así que se pueden llamar siempre sin romper las tiendas sin pixel.
 *
 * El Purchase NO se expone acá: se maneja con `stashPendingPurchase` (en el
 * checkout, antes de redirigir a la pasarela) + `flushPendingPurchase` (en la
 * pantalla de éxito), para disparar sólo cuando el pago está confirmado.
 */
export function useMetaPixel() {
  // Los trackers son funciones de módulo (identidad estable), seguras para usar
  // en handlers o como deps de efectos.
  return { trackViewContent, trackAddToCart, trackInitiateCheckout };
}
