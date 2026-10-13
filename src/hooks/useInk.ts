import { useStore } from '@/context/StoreProvider';
import { useContrastAA } from '@/components/ContrastScope';
import { accentInk, glassAlpha, readableFill, readableText, type FillPair, type TextOn } from '@/lib/contrast';

const ACCENT_VAR = 'var(--color-accent)';

/**
 * Colores legibles para componentes que arman el color en código (badges,
 * avisos de promo, cuenta regresiva, promesa de envío). Fuera del ámbito v2
 * (`aa` = false) todas las funciones devuelven EXACTAMENTE lo que reciben: el
 * componente pinta lo de siempre.
 */
export function useInk() {
  const aa = useContrastAA();
  const config = useStore();
  return {
    aa,
    /** Color de texto legible sobre el fondo de la tienda, mismo tono (C4/C3). */
    text(color: string): string {
      if (!aa) return color;
      if (color === ACCENT_VAR) return 'var(--color-accent-ink)';
      return accentInk(color, config.colorBackground, config.colorSecondary);
    },
    /** Relleno + texto legibles para un badge o cinta (C2). */
    fill(bg: string, text: string): FillPair {
      if (!aa) return { fill: bg, text };
      if (bg === ACCENT_VAR) return { fill: 'var(--color-accent-fill)', text: 'var(--color-on-accent-aa)' };
      // Texto que viene como var (on-accent) sobre un hex: se decide con el hex.
      return readableFill(bg, text.startsWith('#') ? text : undefined);
    },
    /** Texto (y opacidad) legibles sobre un fondo propio, ej. la barra de beneficios. */
    on(text: string, background: string, alpha = 1): TextOn {
      if (!aa) return { text, alpha };
      return readableText(text, background, alpha);
    },
    /** Texto de un badge outline (pastilla blanca fija). */
    onWhite(color: string): string {
      if (!aa) return color;
      if (color === ACCENT_VAR) return 'var(--color-accent-ink-on-white)';
      return accentInk(color, '#ffffff');
    },
    /** Opacidad de un badge translúcido sobre foto (fondo de protección). */
    glass(fill: string, text: string): number {
      return aa ? glassAlpha(fill, text) : 0.85;
    },
    /**
     * Tinte de un color para fondos de avisos. Con color-mix sirve para hex de
     * 3 o 6 dígitos y para variables CSS (el `+ '12'` de antes sólo andaba con
     * hex de 6 dígitos).
     */
    tint(color: string, pct: number): string {
      return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
    },
  };
}
