/**
 * Atelier 2 · Paleta: los colores efectivos (colors.ts) como variables CSS y en
 * los términos de Classic para las piezas compartidas. El color guardado no se
 * modifica.
 *
 * Sólo presentación. No lee ni escribe nada fuera de la configuración ya cargada.
 */

import { useMemo, type CSSProperties } from 'react';
import { useStore } from '@/context/StoreProvider';
import type { TemplateInk } from '../shared/StoreContent';
import { atelier2Colors, atelier2Vars, newsletterButton } from './colors';

const INTER = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

export interface Atelier2Palette {
  /** Variables CSS del kit (todas con prefijo --a2-). */
  vars: CSSProperties;
  /** Lo mismo en los términos de Classic, para las piezas compartidas (barras, popup, secciones del comercio). */
  ink: TemplateInk;
  /**
   * Newsletter: la sección de Classic sobre el color secundario, con el principal
   * del comercio sólo en el botón (maqueta v2.1). Classic pinta la sección con
   * `primary` y el botón con `accent`: acá van el secundario y el principal.
   */
  newsletterInk: TemplateInk;
}

export function useAtelier2Palette(): Atelier2Palette {
  const c = useStore();
  return useMemo(() => {
    const { bg, text, primary, secondary, onSecondary } = atelier2Colors(c);
    const ink: TemplateInk = {
      background: bg,
      text,
      primary: primary.fill,
      accent: c.colorAccent,
      secondary,
      headingFamily: 'Inter',
      bodyFamily: 'Inter',
      headingStack: INTER,
      bodyStack: INTER,
      corners: 'soft',
      buttonCorners: 'rounded',
      titleAlign: 'left',
    };
    const newsletterInk: TemplateInk = { ...ink, primary: secondary, accent: newsletterButton(primary.fill, secondary, onSecondary) };
    return { vars: atelier2Vars(c) as CSSProperties, ink, newsletterInk };
  }, [c.colorBackground, c.colorText, c.colorPrimary, c.colorAccent, c.colorSecondary, c.headerBackground]);
}
