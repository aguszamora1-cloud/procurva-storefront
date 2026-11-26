/**
 * Atelier 2 · Paleta: los cinco colores del comercio (storeConfig) llevados a
 * variables CSS legibles con los controles de contraste que ya usa ProCurva
 * (lib/contrast y lib/theme). El color guardado no se modifica: sólo se ajusta,
 * para cada uso, lo mínimo necesario para llegar a 4,5:1.
 *
 * Sólo presentación. No lee ni escribe nada fuera de la configuración ya cargada.
 */

import { useMemo, type CSSProperties } from 'react';
import { useStore } from '@/context/StoreProvider';
import { accentInk, contrastRatio, greyAlphas, legacyTextOn, parseHex, readableFill } from '@/lib/contrast';
import { contrastColor, luminance, safeText } from '@/lib/theme';
import type { TemplateInk } from '../shared/StoreContent';

const INTER = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
const AA = 4.5;

/** Texto legible sobre `surface`: el preferido si llega a 4,5:1; si no, el que usa ProCurva sobre ese relleno. */
function textOn(surface: string, preferred: string): string {
  const s = parseHex(surface);
  const p = parseHex(preferred);
  if (s && p && contrastRatio(s, p) >= AA) return preferred;
  return legacyTextOn(surface);
}

/**
 * Botón del newsletter. Classic lo pinta con `safeFill(accent, sección)` y le pone el
 * texto de `contrastColor`; acá se elige el relleno para que ese resultado cumpla:
 * texto 4,5:1 sobre el botón y botón 3:1 contra la sección (contraste de componente).
 * Orden: el principal (ya legible), su versión llevada al extremo (accentInk) y, si
 * ninguno alcanza, el color de texto de la sección. El color guardado no cambia.
 */
export function newsletterButton(primaryFill: string, section: string, sectionText: string): string {
  const ok = (fill: string) => {
    const f = parseHex(fill);
    const s = parseHex(section);
    const t = parseHex(contrastColor(fill));
    if (!f || !s || !t) return false;
    const keptByClassic = Math.abs(luminance(fill) - luminance(section)) >= 0.25;
    return keptByClassic && contrastRatio(t, f) >= AA && contrastRatio(f, s) >= 3;
  };
  for (const fill of [primaryFill, accentInk(primaryFill, section)]) if (ok(fill)) return fill;
  return sectionText;
}

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
    const bg = c.colorBackground;
    const text = safeText(c.colorText, bg);
    const primary = readableFill(c.colorPrimary);
    const accent = readableFill(c.colorAccent);
    const secondary = c.colorSecondary;
    const onSecondary = textOn(secondary, text);
    const { muted, subtle } = greyAlphas(text, bg, secondary);
    const header = c.headerBackground ?? bg;
    const headerText = c.headerBackground ? textOn(c.headerBackground, text) : text;
    const pct = (a: number) => `${Math.round(Math.min(1, Math.max(0, a)) * 100)}%`;
    const vars: Record<string, string> = {
      '--a2-bg': bg,
      '--a2-text': text,
      '--a2-primary': primary.fill,
      '--a2-on-primary': primary.text,
      '--a2-accent': accent.fill,
      '--a2-on-accent': accent.text,
      '--a2-accent-ink': accentInk(c.colorAccent, bg, secondary),
      '--a2-secondary': secondary,
      '--a2-on-secondary': onSecondary,
      '--a2-muted': `color-mix(in srgb, ${text} ${pct(muted)}, ${bg})`,
      '--a2-subtle': `color-mix(in srgb, ${text} ${pct(subtle)}, ${bg})`,
      '--a2-header-bg': header,
      '--a2-header-text': headerText,
    };
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
    return { vars: vars as CSSProperties, ink, newsletterInk };
  }, [c.colorBackground, c.colorText, c.colorPrimary, c.colorAccent, c.colorSecondary, c.headerBackground]);
}
