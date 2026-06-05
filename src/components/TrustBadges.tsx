import type { ReactNode } from 'react';
import { useStore } from '@/context/StoreProvider';

// Íconos line-art (mismo viewBox/stroke que lucide para mantener el look RSW).
const ICON = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const TruckIcon = () => (
  <svg {...ICON}>
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
    <path d="M15 18H9" />
    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
    <circle cx="17" cy="18" r="2" />
    <circle cx="7" cy="18" r="2" />
  </svg>
);
const CreditCardIcon = () => (
  <svg {...ICON}>
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
  </svg>
);
const ShieldCheckIcon = () => (
  <svg {...ICON}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
const HandCoinsIcon = () => (
  <svg {...ICON}>
    <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" />
    <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
    <path d="m2 16 6 6" />
    <circle cx="16" cy="9" r="2.9" />
    <circle cx="6" cy="5" r="3" />
  </svg>
);

/**
 * Trust badges (4 columnas desktop, 2x2 mobile) con separadores verticales.
 * Las etiquetas vienen de la config del tenant (trust_badges) con defaults.
 * El gate (section_trust_badges) lo hace el caller.
 */
const ICONS: ReactNode[] = [<TruckIcon />, <HandCoinsIcon />, <CreditCardIcon />, <ShieldCheckIcon />];

interface Props {
  /** Variante acoplada al hero: banda full-width, sin borde superior, con color
   *  de fondo configurable. Sin esta prop, render clásico (ej. detalle de producto). */
  attached?: boolean;
  /** Color de fondo de la banda (solo en variante attached). Vacío = transparente. */
  background?: string;
}

export function TrustBadges({ attached = false, background }: Props = {}) {
  const config = useStore();
  const labels = config.trustBadgeLabels;

  const grid = (
    <div
      className={`grid grid-cols-2 gap-y-5 border-b border-line py-6 md:grid-cols-4 md:gap-y-0 ${
        attached ? '' : 'border-t'
      }`}
    >
      {ICONS.map((icon, i) => (
        <div
          key={i}
          className="flex flex-col items-center border-line px-3 text-center odd:border-r md:border-r md:last:border-r-0"
        >
          <span className="mb-2 text-text">{icon}</span>
          <span className="text-[11px] font-medium uppercase leading-[1.35] tracking-[0.3px] text-muted md:text-[12px]">
            {labels[i] ?? ''}
          </span>
        </div>
      ))}
    </div>
  );

  // Uso clásico (detalle de producto): sin cambios.
  if (!attached) return grid;

  // Variante acoplada al hero: banda full-width con color de fondo configurable.
  return (
    <div className="w-full" style={background ? { backgroundColor: background } : undefined}>
      <div className="mx-auto max-w-none px-6">{grid}</div>
    </div>
  );
}
