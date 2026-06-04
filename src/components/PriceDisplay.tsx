import { useStore } from '@/context/StoreProvider';
import { formatPrice, getPriceInfo } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface Props {
  product: Pick<Product, 'retail_price' | 'retail_price_card' | 'retail_price_transfer'>;
  /** 'card' = grilla (precio en color de texto). 'detail' = ficha (precio accent grande). */
  variant?: 'card' | 'detail';
}

/**
 * Jerarquía de precios estilo RSW:
 *   1. Precio principal (tarjeta) grande
 *   2. "N cuotas sin interés de $X" (sólo si hay precio de tarjeta real)
 *   3. "$X efectivo/transferencia" + badge "Y% OFF"
 */
export function PriceDisplay({ product, variant = 'card' }: Props) {
  const config = useStore();
  const { cardPrice, cashPrice, cashDiscountPct, hasCard } = getPriceInfo(product);

  if (cardPrice <= 0) {
    return <p className="text-[16px] font-semibold text-subtle">Consultar precio</p>;
  }

  const detail = variant === 'detail';
  const mainCls = detail
    ? 'text-[30px] md:text-[34px] font-extrabold leading-none text-accent'
    : 'text-[16px] md:text-[20px] font-extrabold leading-none text-text';

  // Texto de cuotas: el del comercio si lo cargó, si no lo calculamos.
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
        <span className={mainCls}>{formatPrice(cardPrice)}</span>
      </div>

      {installments && (
        <p className={`mt-1 font-medium text-muted ${detail ? 'text-[14px]' : 'text-[12px] md:text-[13px]'}`}>
          {installments}
        </p>
      )}

      {cashPrice && (
        <p className={`mt-1 flex flex-wrap items-baseline gap-1.5 font-medium ${detail ? 'text-[14px]' : 'text-[12px] md:text-[13px]'}`}>
          <span>
            <span className="font-semibold text-text">{formatPrice(cashPrice)}</span>
            <span className="text-subtle"> efectivo/transferencia</span>
          </span>
          {cashDiscountPct > 0 && (
            <span className="bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-on-accent md:text-[11px]">
              {cashDiscountPct}% OFF
            </span>
          )}
        </p>
      )}
    </div>
  );
}
