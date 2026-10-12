import { effectiveTypography, parseTypographyPreview, type TypographyPreview } from './typography';
import type { StoreConfig } from './types';

/**
 * Pedido de vista previa tipográfica de esta pestaña. Se captura UNA vez, al
 * cargar el módulo (arranque de la tienda), porque la tienda es una SPA: los
 * links internos no llevan `?typo=` y el parámetro se pierde en el primer cambio
 * de ruta. Vive en memoria: no va a localStorage, sessionStorage ni a la caché
 * de config, así que no puede filtrarse a otra pestaña ni a otro visitante.
 *
 * El modo vista previa se lee de la URL (`pc_preview=1`) y NO con
 * isPreviewMode(): esa función guarda la marca en sessionStorage, y llamarla
 * acá (antes del primer render) hacía aparecer de entrada el banner "Producto de
 * ejemplo" del onboarding, que lee la misma marca (PreviewBanner).
 */
const preview: TypographyPreview = (() => {
  if (typeof window === 'undefined') return { version: null, titleCase: null };
  let inPreview = false;
  try {
    inPreview = new URLSearchParams(window.location.search).get('pc_preview') === '1';
  } catch {
    /* URL rara: sin vista previa */
  }
  return parseTypographyPreview(window.location.search, inPreview);
})();

/** Versión y capitalización que se pintan para esta config en esta pestaña. */
export function typographyFor(config: Pick<StoreConfig, 'typographyVersion' | 'titleCase'>) {
  return effectiveTypography(config, preview);
}
