import { useStore } from '@/context/StoreProvider';
import { usePromotions } from '@/context/PromotionsContext';
import { formatPrice, getPriceInfo } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface Props {
  product: Pick<Product, 'id' | 'categories' | 'retail_price' | 'retail_price_card' | 'retail_price_transfer' | 'compare_at_price'>;
  /** 'card' = grilla. 'detail' = ficha (precio accent grande + badge inline). */
  variant?: 'card' | 'detail';
}

/**
 * Jerarquía de precios:
 *   - Precio principal (grande, bold) = tarjeta (o transferencia si no hay tarjeta).
 *   - Tachado al lado = precio anterior. Si hay PROMOCIÓN automática vigente, el
 *     tachado es el precio sin promo y el principal el promocional (en accent);
 *     si no, el tachado es el precio de lista (compare_at_price), sólo si es mayor.
 *   - Debajo: "$X efectivo/transferencia" + badge "% OFF" si hay tarjeta y el de
 *     transferencia es más barato. Luego, cuotas sin interés sobre el precio de tarjeta.
 * El badge de promo sobre la imagen lo pone ProductCard.
 */
export function PriceDisplay({ product, variant = 'card' }: Props) {
  const config = useStore();
  const { priceFor } = usePromotions();
  const { mainPrice, cardPrice, cashPrice, cashDiscountPct, comparePrice, hasCard } = getPriceInfo(product);

  if (mainPrice <= 0) {
    return <p className="text-[16px] font-semibold text-subtle">Consultar precio</p>;
  }

  const detail = variant === 'detail';

  // Promoción automática sobre el precio principal (y el de contado, si hay).
  const promoMain = priceFor(mainPrice, product);
  const onPromo = Boolean(promoMain.promo);
  const shownMain = onPromo ? promoMain.finalPrice : mainPrice;
  const shownCash = cashPrice != null ? (onPromo ? priceFor(cashPrice, product).finalPrice : cashPrice) : null;

  // Tachado: en promo, el precio sin promo; si no, el precio de lista anterior.
  const strikePrice = onPromo ? mainPrice : comparePrice;
  const hasCashDiscount = Boolean(shownCash != null && shownCash > 0 && cashDiscountPct > 0);

  const mainCls = detail
    ? `text-[30px] md:text-[34px] font-extrabold leading-none tracking-[-0.02em] ${onPromo ? 'text-accent' : 'text-accent'}`
    : `text-[16px] md:text-[20px] font-extrabold leading-none ${onPromo ? 'text-accent' : 'text-text'}`;
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
        <span className={mainCls}>{formatPrice(shownMain)}</span>
        {strikePrice && (
          <span className={`font-medium text-subtle line-through ${strikeCls}`}>{formatPrice(strikePrice)}</span>
        )}
      </div>

      {/* Ahorro por promoción automática. */}
      {onPromo && promoMain.savings > 0 && (
        <p className={`mt-1 font-semibold text-accent ${detail ? 'text-[13px]' : 'text-[11px] md:text-[12px]'}`}>
          Ahorrás {formatPrice(promoMain.savings)}
        </p>
      )}

      {hasCashDiscount && (
        <p className={`mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-subtle ${detail ? 'text-[13px]' : 'text-[11px] md:text-[12px]'}`}>
          <span className="font-semibold text-text">{formatPrice(shownCash as number)}</span>
          <span className="font-medium">efectivo o transferencia</span>
          {detail && (
            <span className="shrink-0 rounded bg-accent px-2 py-0.5 text-[10px] font-bold leading-none text-on-accent shadow-sm">
              -{cashDiscountPct}%
            </span>
          )}
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
