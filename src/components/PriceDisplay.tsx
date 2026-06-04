import { useStore } from '@/context/StoreProvider';
import { formatPrice, getPriceInfo } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface Props {
  product: Pick<Product, 'retail_price' | 'retail_price_card' | 'retail_price_transfer'>;
  /** 'card' = grilla. 'detail' = ficha (precio accent grande + badge inline). */
  variant?: 'card' | 'detail';
}

/**
 * Jerarquía de precios:
 *   - Si hay precio tarjeta (descuento): precio principal = efectivo/transferencia
 *     (el más barato), con el precio tarjeta tachado al lado y el % de descuento.
 *     Debajo, las cuotas sin interés sobre el precio tarjeta.
 *   - Si no hay precio tarjeta: un solo precio, sin tachado ni cuotas.
 * El badge "-X%" sobre la imagen lo pone ProductCard; en la ficha (detail) se
 * muestra inline al lado del precio.
 */
export function PriceDisplay({ product, variant = 'card' }: Props) {
  const config = useStore();
  const { cardPrice, cashPrice, cashDiscountPct, hasCard } = getPriceInfo(product);

  if (cardPrice <= 0) {
    return <p className="text-[16px] font-semibold text-subtle">Consultar precio</p>;
  }

  const detail = variant === 'detail';
  const hasDiscount = Boolean(cashPrice && cashDiscountPct > 0);
  const mainPrice = cashPrice ?? cardPrice; // el precio prominente (efectivo si hay descuento)
  const strikePrice = hasDiscount ? cardPrice : null;

  const mainCls = detail
    ? 'text-[30px] md:text-[34px] font-extrabold leading-none text-accent'
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
        {strikePrice && (
          <span className={`font-medium text-subtle line-through ${strikeCls}`}>{formatPrice(strikePrice)}</span>
        )}
        {detail && hasDiscount && (
          <span className="bg-accent px-1.5 py-0.5 text-[11px] font-bold leading-none text-on-accent">
            -{cashDiscountPct}%
          </span>
        )}
      </div>

      {hasDiscount && (
        <p className={`mt-0.5 text-subtle ${detail ? 'text-[13px]' : 'text-[11px] md:text-[12px]'}`}>
          Efectivo o transferencia
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
