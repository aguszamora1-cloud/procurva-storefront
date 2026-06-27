import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackMetaPixelEvent } from '@/lib/metaPixel';

/**
 * Dispara `PageView` en cada cambio de ruta (la tienda es una SPA, así que sin
 * esto Meta sólo vería la primera vista). El PageView del primer load ya lo
 * cubre el snippet base de Meta (`Analytics.tsx`), por eso salteamos la primera
 * navegación para no duplicarlo. No-op si el tenant no tiene pixel cargado.
 *
 * Debe renderizarse DENTRO del <BrowserRouter> (usa useLocation).
 */
export function MetaPixelPageView() {
  const { pathname } = useLocation();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return; // el snippet base ya disparó el PageView inicial
    }
    trackMetaPixelEvent('PageView');
  }, [pathname]);

  return null;
}
