import { useMemo } from 'react';
import { trackAddToCart, trackInitiateCheckout, trackViewContent } from '@/lib/metaPixel';
import { sendServerEvent } from '@/lib/serverEvents';
import { useStore, useStoreStatus } from '@/context/StoreProvider';

/**
 * API de tracking de ecommerce del storefront: DISPARO DUAL pixel (browser) + CAPI (server),
 * con el MISMO event_id → las plataformas deduplican y cuentan una sola conversión.
 *
 * El pixel del browser es no-op si el tenant no cargó `meta_pixel_id` (Analytics no lo
 * instala). El CAPI (sendServerEvent → Edge Function track-event) se dispara solo si el
 * tenant tiene tracking configurado (`trackingOn`), para no llamar al edge en tiendas sin
 * publicidad. El edge fn igual no-opea si no hay CAPI activa; el gate evita el request de más.
 *
 * El Purchase NO se expone acá: se maneja con stash/flush (checkout + pantalla de éxito),
 * que ya dispara pixel + CAPI con el event_id guardado — ver metaPixel.ts.
 */
export function useMetaPixel() {
  const { companyId } = useStoreStatus();
  const { metaPixelId } = useStore();
  const trackingOn = !!metaPixelId && !!companyId;

  return useMemo(() => {
    const newId = () => crypto.randomUUID();
    return {
      trackViewContent: (p: { contentId: string; name: string; value: number }) => {
        const id = newId();
        trackViewContent(p, id);
        if (trackingOn) sendServerEvent({ companyId, eventId: id, eventName: 'ViewContent', value: p.value, contentIds: [p.contentId] });
      },
      trackAddToCart: (p: { contentId: string; name: string; value: number }) => {
        const id = newId();
        trackAddToCart(p, id);
        if (trackingOn) sendServerEvent({ companyId, eventId: id, eventName: 'AddToCart', value: p.value, contentIds: [p.contentId] });
      },
      trackInitiateCheckout: (p: { contentIds: string[]; value: number; numItems: number }) => {
        const id = newId();
        trackInitiateCheckout(p, id);
        if (trackingOn) sendServerEvent({ companyId, eventId: id, eventName: 'InitiateCheckout', value: p.value, contentIds: p.contentIds });
      },
    };
  }, [companyId, trackingOn]);
}
