import { formatPrice, resolvePricePair } from '@/lib/utils';
import type { StoreConfig } from '@/lib/types';
import { useTypography } from '@/hooks/useTypography';

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
  /**
   * Prefijo del precio protagonista, para cuando el producto no tiene UN precio
   * sino un piso: "Desde $12.000" en las cards de un producto con precio por
   * talle (lib/sizePrice). Vacío = sin prefijo.
   */
  pricePrefix?: string;
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
  pricePrefix = '',
}: Props) {
  const detail = variant === 'detail';
  const compact = variant === 'compact';
  // v2 (lib/typography) sólo para 'card' y 'detail'. 'compact' queda en v1
  // siempre: lo usa ComplementaryBlock, que también se pinta en el carrito
  // lateral, y el carrito está fuera del alcance de v2 (Fase 1).
  const { version } = useTypography();
  const v2 = version === 'v2' && !compact;
  const pair = resolvePricePair({ priceDisplay, cashLabel: cashLabelProp ?? 'efectivo o transferencia' }, cash, card);
  const { primary, cardLine } = pair;
  const hasCash = pair.isCash;
  const cashLabel = pair.cashLabel;

  // v2: el principal manda (números de ancho fijo), el tachado mide como mucho
  // el 75 % del principal (16→12 / 20→15 en la card) y nada legible baja de
  // 12px aunque el comercio achique la escala. Colores: los mismos tokens.
  const primaryCls = v2
    ? detail
      ? 'text-[calc(30px_*_var(--font-scale,1))] md:text-[calc(34px_*_var(--font-scale,1))] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-accent'
      : 'text-[calc(16px_*_var(--font-scale,1))] md:text-[calc(20px_*_var(--font-scale,1))] font-extrabold leading-none tracking-[-0.01em] tabular-nums text-accent'
    : (detail
    ? 'text-[calc(30px_*_var(--font-scale,1))] md:text-[calc(34px_*_var(--font-scale,1))] font-extrabold leading-none tracking-[-0.02em] text-accent'
    : compact
      ? 'text-[calc(14px_*_var(--font-scale,1))] font-bold leading-none text-accent'
      : 'text-[calc(16px_*_var(--font-scale,1))] md:text-[calc(20px_*_var(--font-scale,1))] font-extrabold leading-none text-accent');
  const labelCls = v2
    ? detail ? 'text-[length:max(12px,calc(13px_*_var(--font-scale,1)))]' : 'text-[length:max(12px,calc(12px_*_var(--font-scale,1)))]'
    : (detail ? 'text-[calc(13px_*_var(--font-scale,1))]' : compact ? 'text-[calc(11px_*_var(--font-scale,1))]' : 'text-[calc(11px_*_var(--font-scale,1))] md:text-[calc(12px_*_var(--font-scale,1))]');
  const strikeCls = v2
    ? detail ? 'text-[calc(16px_*_var(--font-scale,1))]' : 'text-[length:max(12px,calc(12px_*_var(--font-scale,1)))] md:text-[calc(15px_*_var(--font-scale,1))]'
    : (detail ? 'text-[calc(16px_*_var(--font-scale,1))]' : compact ? 'text-[calc(11px_*_var(--font-scale,1))]' : 'text-[calc(13px_*_var(--font-scale,1))] md:text-[calc(15px_*_var(--font-scale,1))]');

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {pricePrefix && <span className={`font-medium text-muted ${labelCls}`}>{pricePrefix}</span>}
        <span className={primaryCls}>{formatPrice(primary)}</span>
        {hasCash && cashLabel && <span className={`font-medium text-muted ${labelCls}`}>{cashLabel}</span>}
        {cardLine != null && detail && discountPct > 0 && (
          <span className={v2 ? 'shrink-0 rounded bg-accent px-2 py-0.5 text-[length:max(12px,calc(12px_*_var(--font-scale,1)))] font-bold leading-none tabular-nums text-on-accent shadow-sm' : 'shrink-0 rounded bg-accent px-2 py-0.5 text-[calc(10px_*_var(--font-scale,1))] font-bold leading-none text-on-accent shadow-sm'}>
            -{discountPct}%
          </span>
        )}
        {strike != null && strike > 0 && (
          <span className={`font-medium text-subtle line-through ${strikeCls}`}>{formatPrice(strike)}</span>
        )}
      </div>

      {savings > 0 && (
        <p className={v2 ? `mt-1 font-semibold text-accent ${labelCls}` : `mt-1 font-semibold text-accent ${detail ? 'text-[calc(13px_*_var(--font-scale,1))]' : 'text-[calc(11px_*_var(--font-scale,1))] md:text-[calc(12px_*_var(--font-scale,1))]'}`}>
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
