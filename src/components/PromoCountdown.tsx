import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

/** Diferencia en ms entre `end` y ahora (0 si ya venció). */
function remaining(endIso: string): number {
  const end = new Date(endIso).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, end - Date.now());
}

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

/**
 * Countdown hasta el fin de una promoción ("Quedan 2d 14h 32m"). Se autooculta
 * cuando la promo vence. Tickea cada segundo. Usa los colores de la promo.
 */
export function PromoCountdown({
  endsAt,
  label = 'Termina en',
  color,
  className = '',
}: {
  endsAt: string | null;
  label?: string;
  color?: string | null;
  className?: string;
}) {
  const [ms, setMs] = useState(() => (endsAt ? remaining(endsAt) : 0));

  useEffect(() => {
    if (!endsAt) return;
    setMs(remaining(endsAt));
    const id = window.setInterval(() => setMs(remaining(endsAt)), 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  // Promo sin fecha de fin (permanente) -> no hay countdown que mostrar.
  if (!endsAt || ms <= 0) return null;

  const accent = color || 'var(--color-accent)';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-bold leading-none ${className}`}
      style={{ backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}
    >
      <Clock size={13} className="flex-none" />
      {label} {fmt(ms)}
    </span>
  );
}
