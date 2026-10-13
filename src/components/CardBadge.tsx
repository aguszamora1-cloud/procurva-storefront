import type { CSSProperties, ReactNode } from 'react';
import { contrastColor } from '@/lib/theme';
import { useTypography } from '@/hooks/useTypography';
import { useInk } from '@/hooks/useInk';

interface Props {
  children: ReactNode;
  /** Color del badge (hex o CSS var): fondo en solid/glass, texto/borde en outline. */
  bg: string;
  /** Color del texto en solid/glass. Default blanco. */
  color?: string;
  className?: string;
  /** Borde luminoso animado (luz que gira alrededor del pill). */
  glow?: boolean;
  /** Preset de estilo global de la tienda. Default 'solid' (look actual). */
  variant?: 'solid' | 'glass' | 'outline';
}

/**
 * Color de texto del badge `outline` (texto sobre fondo blanco): el color del
 * badge tal cual, salvo que sea muy claro (ilegible sobre blanco) → se oscurece.
 * Para CSS vars (acento) se usa tal cual: suelen ser colores saturados.
 */
function outlineText(bg: string): string {
  if (!bg.startsWith('#')) return bg;
  // contrastColor devuelve '#111111' sólo cuando el fondo es claro.
  return contrastColor(bg) === '#111111' ? `color-mix(in srgb, ${bg}, #000 40%)` : bg;
}

/**
 * Badge tipo pill para las product cards y la ficha (NUEVO, ÚLTIMAS UNIDADES,
 * descuento). Diseño vivo: rounded, font-bold uppercase, sombra sutil.
 *
 * Con `glow`, un conic-gradient rotando (clase .badge-glow en globals.css) genera
 * una luz que recorre el borde. El fondo real pasa a un ::after inset 2px, así el
 * tamaño y los estilos del pill no cambian: sólo se suma el rim luminoso.
 */
export function CardBadge({ children, bg: rawBg, color: rawColor = '#ffffff', className = '', glow = false, variant = 'solid' }: Props) {
  // Pill compacto: ancho al contenido, esquina de la imagen, sombra sutil. Sin
  // mayúsculas ni full-width (el diseño viejo era una barra sólida pesada).
  const { ty } = useTypography();
  // Contraste AA (C2), sólo en v2 dentro de las páginas del alcance: el badge
  // conserva su color y su texto, y si no llegan a 4,5:1 se ajusta lo mínimo
  // el relleno (o, si cambiaría demasiado, el texto). Afuera, `ink.fill`
  // devuelve exactamente lo recibido.
  const ink = useInk();
  const pair = ink.fill(rawBg, rawColor);
  const bg = pair.fill;
  const color = pair.text;
  const base = ty('inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-1 text-[calc(11px_*_var(--font-scale,1))] font-semibold leading-none shadow-sm', 'badge', 'inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-1 shadow-sm');

  if (glow) {
    return (
      <span
        className={`badge-glow ${base} ${className}`}
        style={{ color, '--badge-bg': bg, '--badge-glow': bg } as CSSProperties}
      >
        <span className="relative z-[2] inline-flex items-center gap-1">{children}</span>
      </span>
    );
  }

  if (variant === 'glass') {
    // Fondo translúcido del color del badge + blur. color-mix tolera hex y CSS
    // var; si el navegador no soporta backdrop-filter, queda el sólido translúcido.
    // Sobre la foto: en v2 la opacidad sube lo justo para que el texto llegue a
    // AA aun sobre el píxel más desfavorable (fondo de protección). Con el
    // acento (CSS var, no se puede calcular acá) va sólido.
    const glassPct = ink.aa ? (bg.startsWith('#') ? Math.round(ink.glass(bg, color) * 100) : 100) : 85;
    return (
      <span
        style={{ backgroundColor: ink.aa ? `color-mix(in srgb, ${bg} ${glassPct}%, transparent)` : `color-mix(in srgb, ${bg} 85%, transparent)`, color }}
        className={`${base} backdrop-blur-sm ${className}`}
      >
        {children}
      </span>
    );
  }

  if (variant === 'outline') {
    return (
      <span
        style={{
          backgroundColor: '#ffffff',
          // v2: el color del badge llevado a AA sobre la pastilla blanca (el
          // oscurecido fijo de hoy no alcanzaba con rojos o verdes medios).
          color: ink.aa ? ink.onWhite(rawBg) : outlineText(bg),
          border: `1px solid color-mix(in srgb, ${rawBg} 25%, transparent)`,
        }}
        className={`${base} ${className}`}
      >
        {children}
      </span>
    );
  }

  // solid (default)
  return (
    <span style={{ backgroundColor: bg, color }} className={`${base} ${className}`}>
      {children}
    </span>
  );
}
