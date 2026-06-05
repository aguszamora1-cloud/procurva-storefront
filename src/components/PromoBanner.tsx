import { useEffect, useState } from 'react';
import { useStore } from '@/context/StoreProvider';

/** Una unidad del countdown (número en pill + label). */
function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="min-w-[2.1rem] rounded bg-white/20 px-1.5 py-0.5 text-center text-[15px] font-bold tabular-nums leading-tight md:text-[17px]">
        {String(Math.max(0, value)).padStart(2, '0')}
      </span>
      <span className="mt-0.5 text-[8px] uppercase tracking-wide opacity-80 md:text-[9px]">{label}</span>
    </div>
  );
}

const Sep = () => <span className="self-start pt-1 text-[15px] font-bold opacity-60 md:text-[17px]">:</span>;

/** Clases del texto principal según el tamaño elegido en el admin. */
const TEXT_SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-sm font-semibold',
  md: 'text-base md:text-lg font-semibold',
  lg: 'text-lg md:text-2xl font-bold',
};

/**
 * Franja promocional (PRO) para eventos de venta. Color de fondo/texto
 * configurables y countdown opcional en tiempo real. Al llegar a 0 muestra el
 * texto alternativo o se oculta. Vive dentro del bloque sticky del Layout.
 */
export function PromoBanner() {
  const config = useStore();
  const promo = config.promoBanner;

  const target = promo.countdownEnabled && promo.countdownEnd ? new Date(promo.countdownEnd).getTime() : NaN;
  const hasTimer = !Number.isNaN(target);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasTimer) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasTimer]);

  // Gating: PRO + activada.
  if (!config.isPro || !promo.enabled) return null;

  const remaining = hasTimer ? target - now : 0;
  const ended = hasTimer && remaining <= 0;

  // Terminó: texto alternativo o se oculta.
  const displayText = ended ? promo.endedText : promo.text;
  const showTimer = hasTimer && !ended;

  if (!displayText && !showTimer) return null;

  const totalSec = Math.max(0, Math.floor(remaining / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  return (
    <div style={{ backgroundColor: promo.bgColor, color: promo.textColor }} className="w-full">
      <div className="mx-auto flex flex-col items-center justify-center gap-2 px-4 py-2 text-center md:flex-row md:gap-6">
        {displayText && (
          <span className={`uppercase tracking-[0.5px] ${TEXT_SIZE_CLASSES[promo.textSize]}`}>{displayText}</span>
        )}
        {showTimer && (
          <div className="flex items-start gap-1.5">
            <TimeUnit value={days} label="Días" />
            <Sep />
            <TimeUnit value={hours} label="Horas" />
            <Sep />
            <TimeUnit value={mins} label="Min" />
            <Sep />
            <TimeUnit value={secs} label="Seg" />
          </div>
        )}
      </div>
    </div>
  );
}
