import type { CSSProperties, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Color de fondo (hex o CSS var). */
  bg: string;
  /** Color del texto. Default blanco. */
  color?: string;
  className?: string;
  /** Borde luminoso animado (luz que gira alrededor del pill). */
  glow?: boolean;
}

/**
 * Badge tipo pill para las product cards y la ficha (NUEVO, ÚLTIMAS UNIDADES,
 * descuento). Diseño vivo: rounded, font-bold uppercase, sombra sutil.
 *
 * Con `glow`, un conic-gradient rotando (clase .badge-glow en globals.css) genera
 * una luz que recorre el borde. El fondo real pasa a un ::after inset 2px, así el
 * tamaño y los estilos del pill no cambian: sólo se suma el rim luminoso.
 */
export function CardBadge({ children, bg, color = '#ffffff', className = '', glow = false }: Props) {
  const base = 'inline-flex items-center gap-1 whitespace-nowrap rounded px-3 py-1 text-xs font-bold uppercase leading-none tracking-[0.3px] shadow-sm';

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

  return (
    <span style={{ backgroundColor: bg, color }} className={`${base} ${className}`}>
      {children}
    </span>
  );
}
