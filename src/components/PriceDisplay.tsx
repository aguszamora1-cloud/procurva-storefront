import { useStore } from '@/context/StoreProvider';
import { formatPrice, getPriceInfo } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface Props {
  product: Pick<Product, 'retail_price' | 'retail_price_card' | 'retail_price_transfer' | 'compare_at_price'>;
  /** 'card' = grilla. 'detail' = ficha (precio accent grande + badge inline). */
  variant?: 'card' | 'detail';
}

/**
 * Jerarquía de precios:
 *   - Precio principal (grande, bold) = tarjeta (o transferencia si no hay tarjeta).
 *   - Tachado al lado = precio de lista anterior (compare_at_price), sólo si es mayor.
 *   - Debajo: "$X efectivo/transferencia" + badge "% OFF" si hay tarjeta y el de
 *     transferencia es más barato. Luego, cuotas sin interés sobre el precio de tarjeta.
 * El badge "-X%" sobre la imagen lo pone ProductCard (descuento del precio de lista).
 */
export function PriceDisplay({ product, variant = 'card' }: Props) {
  const config = useStore();
  const { mainPrice, cardPrice, cashPrice, cashDiscountPct, comparePrice, hasCard } = getPriceInfo(product);

  if (mainPrice <= 0) {
    return <p className="text-[16px] font-semibold text-subtle">Consultar precio</p>;
  }

  const detail = variant === 'detail';
  const hasCashDiscount = Boolean(cashPrice && cashDiscountPct > 0);

  const mainCls = detail
    ? 'text-[30px] md:text-[34px] font-extrabold leading-none tracking-[-0.02em] text-accent'
    : 'text-[16px] md:text-[20px] font-extrabold leading-none text-text';
  const strikeCls = detail ? 'text-[16px]' : 'text-[13px] md:text-[15px]';

  const installments =
    hasCard
      ? config.cardPaymentText ||
        (config.installmentsCount > 1
          ? `${config.installmentsCount} cuotas sin interés de ${formatPrice(Math.round(cardPrice / config.installmentsCount))}`
          : '')
      : '';

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={mainCls}>{formatPrice(mainPrice)}</span>
        {comparePrice && (
          <span className={`font-medium text-subtle line-through ${strikeCls}`}>{formatPrice(comparePrice)}</span>
        )}
      </div>

      {hasCashDiscount && (
        <p className={`mt-1 flex items-center gap-1.5 text-muted ${detail ? 'text-[13px]' : 'text-[11px] md:text-[12px]'}`}>
          <span className="font-semibold text-text">{formatPrice(cashPrice as number)}</span>
          <span>efectivo o transferencia</span>
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold leading-none text-on-accent shadow-sm">
            -{cashDiscountPct}%
          </span>
        </p>
      )}

      {installments && (
        <p className={`mt-1 font-medium text-muted ${detail ? 'text-[14px]' : 'text-[12px] md:text-[13px]'}`}>
          {installments}
        </p>
      )}
    </div>
  );
}
