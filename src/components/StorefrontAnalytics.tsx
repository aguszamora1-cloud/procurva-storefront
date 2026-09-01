import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useStoreStatus } from '@/context/StoreProvider';
import { setTrackingTenant, track } from '@/lib/tracking';

/**
 * Analytics propio del storefront (tipo Tiendanube). Hace dos cosas:
 *
 *  1) Sincroniza el tenant resuelto (companyId + canal + slug) hacia el módulo `tracking.ts`.
 *     R7 del audit: SOLO cuando está TODO resuelto (status 'ready' + companyId + storeType +
 *     slug). Mientras tanto el tenant queda en null y `track()` hace no-op — preferimos perder
 *     los primeros ms de eventos antes que registrarlos con el canal equivocado.
 *
 *  2) Dispara `page_view` en cada cambio de ruta (la tienda es una SPA). Incluye el landing
 *     inicial: si la ruta cambió o cargó antes de resolver el tenant, el page_view se emite
 *     recién cuando el tenant queda listo (una sola vez por pathname).
 *
 * Debe renderizarse DENTRO del <BrowserRouter> (usa useLocation).
 */
export function StorefrontAnalytics() {
  const { status, companyId, storeType, storeKey, slug } = useStoreStatus();
  const { pathname } = useLocation();
  const lastTrackedPath = useRef<string | null>(null);

  const ready = status === 'ready' && !!companyId && !!storeType && !!slug;

  // (1) Sync tenant → tracking singleton.
  useEffect(() => {
    if (ready) {
      setTrackingTenant({
        companyId: companyId as string,
        // Las dos tiendas históricas conservan su etiqueta de siempre (cambiarla
        // partiría en dos el histórico de todos los dashboards); una tienda nueva
        // manda SU clave, si no dos marcas minoristas mezclan su embudo. El canal
        // definitivo igual lo decide la Edge Function desde el slug resuelto.
        channel:
          storeKey === 'wholesale' || (!storeKey && storeType === 'wholesale')
            ? 'mayorista'
            : !storeKey || storeKey === 'retail'
              ? 'minorista'
              : storeKey,
        slug: slug as string,
      });
    } else {
      setTrackingTenant(null);
    }
  }, [ready, companyId, storeType, storeKey, slug]);

  // (2) page_view por ruta (una vez que el tenant está listo; incluye el landing).
  useEffect(() => {
    if (!ready) return;
    if (lastTrackedPath.current === pathname) return;
    lastTrackedPath.current = pathname;
    track('page_view', { metadata: { path: pathname } });
  }, [ready, pathname]);

  return null;
}
