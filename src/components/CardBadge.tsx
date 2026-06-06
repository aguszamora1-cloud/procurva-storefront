import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Color de fondo (hex o CSS var). */
  bg: string;
  /** Color del texto. Default blanco. */
  color?: string;
  className?: string;
}

/**
 * Badge tipo pill para las product cards y la ficha (NUEVO, ÚLTIMAS UNIDADES,
 * descuento). Diseño vivo: rounded-full, font-bold uppercase, sombra sutil.
 */
export function CardBadge({ children, bg, color = '#ffffff', className = '' }: Props) {
  return (
    <span
      style={{ backgroundColor: bg, color }}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase leading-none tracking-[0.3px] shadow-sm ${className}`}
    >
      {children}
    </span>
  );
}
