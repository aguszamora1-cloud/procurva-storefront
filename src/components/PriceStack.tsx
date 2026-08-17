import { useStore } from '@/context/StoreProvider';
import { usePromotions } from '@/context/PromotionsContext';
import { formatPrice, getPriceInfo } from '@/lib/utils';
import type { Product } from '@/lib/types';
import { PriceHierarchy, type PriceVariant } from './PriceHierarchy';

interface Props {
  product: Pick<Product, 'id' | 'categories' | 'retail_price' | 'retail_price_card' | 'retail_price_transfer' | 'compare_at_price'> & {
    variant_color?: string | null;
  };
  /** 'card' = grilla · 'detail' = ficha · 'compact' = filas chicas (complementarios). */
  variant?: PriceVariant;
  /**
   * Color elegido, para las promos acotadas a un color. Lo pasa la FICHA (donde el
   * color se elige); la grilla no lo necesita porque la virtual card ya trae
   * `variant_color`. Sin esto, la ficha mostraría el precio de lista mientras el
   * carrito cobra el promocional.
   */
  color?: string | null;
}

/**
 * Precio de PRODUCTO: resuelve tarjeta/contado + promo automática desde
 * `getPriceInfo` (que NO se toca: mainPrice sigue siendo tarjeta, lo que va al
 * carrito/checkout/orden/cupones) y delega la JERARQUÍA en `PriceHierarchy`
 * (contado protagonista, tarjeta secundaria). 'compact' omite las cuotas.
 */
export function PriceStack({ product, variant = 'card', color }: Props) {
  const config = useStore();
  const { priceFor } = usePromotions();
  const { mainPrice, cardPrice, cashPrice, cashDiscountPct, comparePrice, hasCard } = getPriceInfo(product);

  if (mainPrice <= 0) {
    return <p className="text-[calc(16px_*_var(--font-scale,1))] font-semibold text-subtle">Consultar precio</p>;
  }

  // Promoción automática aplicada al precio de tarjeta y al de contado.
  const promoMain = priceFor(mainPrice, product, color);
  const onPromo = Boolean(promoMain.promo);
  const shownCard = onPromo ? promoMain.finalPrice : mainPrice;
  const shownCash = cashPrice != null ? (onPromo ? priceFor(cashPrice, product, color).finalPrice : cashPrice) : null;
  const hasCashDiscount = shownCash != null && shownCash > 0 && shownCash < shownCard && cashDiscountPct > 0;

  const installments =
    variant !== 'compact' && hasCard && config.installmentsCount > 0
      ? config.cardPaymentText ||
        (config.installmentsCount > 1
          ? `${config.installmentsCount} cuotas sin interés de ${formatPrice(Math.round(cardPrice / config.installmentsCount))}`
          : '')
      : '';

  return (
    <PriceHierarchy
      cash={hasCashDiscount ? (shownCash as number) : null}
      card={shownCard}
      strike={onPromo ? mainPrice : comparePrice}
      discountPct={cashDiscountPct}
      savings={onPromo ? promoMain.savings : 0}
      installments={installments}
      variant={variant}
    />
  );
}
