import { formatPrice, resolvePricePair } from '@/lib/utils';
import type { StoreConfig } from '@/lib/types';

export type PriceVariant = 'card' | 'detail' | 'compact';

interface Props {
  /** Precio de contado (efectivo/transferencia). null = no hay descuento de contado → precio único. */
  cash: number | null;
  /** Precio de tarjeta (o precio único cuando `cash` es null). */
  card: number;
  /** Qué precios mostrar. Lo pasa el caller desde la config de la tienda. */
  priceDisplay?: StoreConfig['priceDisplay'];
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
 * `priceDisplay` decide qué renglones entran (ver `resolvePricePair`): en modo
 * 'contado' desaparecen la línea de tarjeta, el badge de % y las cuotas — el
 * badge porque un "-15%" sin el precio contra el que compara no dice nada.
 *
 * Presentacional puro: recibe montos ya calculados, y el modo por prop (no lee
 * la config). El precio de producto entra por `PriceStack`; el carrito, el
 * drawer y los combos arman su markup y llaman a `resolvePricePair` directo.
 */
export function PriceHierarchy({
  cash,
  card,
  priceDisplay = 'all',
  strike,
  discountPct = 0,
  savings = 0,
  installments = '',
  variant = 'card',
  cashLabel: cashLabelProp,
  cardLabel = 'con tarjeta',
}: Props) {
  const detail = variant === 'detail';
  const compact = variant === 'compact';
  const pair = resolvePricePair({ priceDisplay, cashLabel: cashLabelProp ?? 'efectivo o transferencia' }, cash, card);
  const { primary, cardLine } = pair;
  const hasCash = pair.isCash;
  const cashLabel = pair.cashLabel;

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
        {cardLine != null && detail && discountPct > 0 && (
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

      {cardLine != null && (
        <p className={`mt-1 text-subtle ${labelCls}`}>
          <span className="font-semibold">{formatPrice(cardLine)}</span> <span className="font-medium">{cardLabel}</span>
        </p>
      )}

      {priceDisplay !== 'contado' && installments && (
        <p className={`mt-1 font-medium text-muted ${detail ? 'text-[calc(14px_*_var(--font-scale,1))]' : 'text-[calc(12px_*_var(--font-scale,1))] md:text-[calc(13px_*_var(--font-scale,1))]'}`}>
          {installments}
        </p>
      )}
    </div>
  );
}
