import { formatPrice } from '@/lib/utils';

export type PriceVariant = 'card' | 'detail' | 'compact';

interface Props {
  /** Precio de contado (efectivo/transferencia). null = no hay descuento de contado → precio único. */
  cash: number | null;
  /** Precio de tarjeta (o precio único cuando `cash` es null). */
  card: number;
  /** Precio anterior tachado (lista o pre-promo). */
  strike?: number | null;
  /** % de descuento de contado (badge, sólo variant 'detail'). */
  discountPct?: number;
  /** Ahorro por promoción automática ($). */
  savings?: number;
  /** Línea de cuotas (ya formateada). Vacío = no se muestra. */
  installments?: string;
  variant?: PriceVariant;
  /** Etiqueta del precio protagonista. Default "efectivo o transferencia". '' = sin etiqueta. */
  cashLabel?: string;
  /** Etiqueta del precio secundario (tarjeta). Default "con tarjeta". */
  cardLabel?: string;
}

/**
 * ÚNICO lugar que decide la jerarquía visual de precios de la tienda: el de
 * **contado** (efectivo/transferencia) es el protagonista (grande, bold, accent);
 * el de **tarjeta** queda secundario (chico, gris). Cuando no hay diferencia
 * contado/tarjeta (`cash` null o >= `card`), muestra un solo precio.
 *
 * Presentacional puro: recibe montos ya calculados. `PriceStack` lo usa para el
 * precio de producto; las superficies de totales (escalones, carrito, drawer,
 * checkout, sticky) lo usan con sus montos tarjeta/contado por línea.
 */
export function PriceHierarchy({
  cash,
  card,
  strike,
  discountPct = 0,
  savings = 0,
  installments = '',
  variant = 'card',
  cashLabel = 'efectivo o transferencia',
  cardLabel = 'con tarjeta',
}: Props) {
  const detail = variant === 'detail';
  const compact = variant === 'compact';
  const hasCash = cash != null && cash > 0 && cash < card;
  const primary = hasCash ? (cash as number) : card;

  const primaryCls = detail
    ? 'text-[calc(30px_*_var(--font-scale,1))] md:text-[calc(34px_*_var(--font-scale,1))] font-extrabold leading-none tracking-[-0.02em] text-accent'
    : compact
      ? 'text-[calc(14px_*_var(--font-scale,1))] font-bold leading-none text-accent'
      : 'text-[calc(16px_*_var(--font-scale,1))] md:text-[calc(20px_*_var(--font-scale,1))] font-extrabold leading-none text-accent';
  const labelCls = detail ? 'text-[calc(13px_*_var(--font-scale,1))]' : compact ? 'text-[calc(11px_*_var(--font-scale,1))]' : 'text-[calc(11px_*_var(--font-scale,1))] md:text-[calc(12px_*_var(--font-scale,1))]';
  const strikeCls = detail ? 'text-[calc(16px_*_var(--font-scale,1))]' : compact ? 'text-[calc(11px_*_var(--font-scale,1))]' : 'text-[calc(13px_*_var(--font-scale,1))] md:text-[calc(15px_*_var(--font-scale,1))]';

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={primaryCls}>{formatPrice(primary)}</span>
        {hasCash && cashLabel && <span className={`font-medium text-muted ${labelCls}`}>{cashLabel}</span>}
        {hasCash && detail && discountPct > 0 && (
          <span className="shrink-0 rounded bg-accent px-2 py-0.5 text-[calc(10px_*_var(--font-scale,1))] font-bold leading-none text-on-accent shadow-sm">
            -{discountPct}%
          </span>
        )}
        {strike != null && strike > 0 && (
          <span className={`font-medium text-subtle line-through ${strikeCls}`}>{formatPrice(strike)}</span>
        )}
      </div>

      {savings > 0 && (
        <p className={`mt-1 font-semibold text-accent ${detail ? 'text-[calc(13px_*_var(--font-scale,1))]' : 'text-[calc(11px_*_var(--font-scale,1))] md:text-[calc(12px_*_var(--font-scale,1))]'}`}>
          Ahorrás {formatPrice(savings)}
        </p>
      )}

      {hasCash && (
        <p className={`mt-1 text-subtle ${labelCls}`}>
          <span className="font-semibold">{formatPrice(card)}</span> <span className="font-medium">{cardLabel}</span>
        </p>
      )}

      {installments && (
        <p className={`mt-1 font-medium text-muted ${detail ? 'text-[calc(14px_*_var(--font-scale,1))]' : 'text-[calc(12px_*_var(--font-scale,1))] md:text-[calc(13px_*_var(--font-scale,1))]'}`}>
          {installments}
        </p>
      )}
    </div>
  );
}
