import { useMemo } from 'react';
import { useCart } from '@/context/CartContext';
import { useCoupon } from '@/context/CouponContext';
import { useStoreType } from '@/context/StoreProvider';
import { useCartPromos } from '@/hooks/useCartPromos';
import { priceCartItems } from '@/lib/cart';
import { evaluateCouponForCart } from '@/lib/coupons';
import type { CartItem } from '@/lib/types';

export interface CartCouponValue {
  /** Items con las promos por cantidad ya aplicadas (los mismos que usa el checkout). */
  pricedItems: CartItem[];
  /** Promo automática NO acumulable en el carrito → bloquea el cupón. */
  hasNonStackablePromo: boolean;
  /** Subtotal de contado y de tarjeta, con promos por cantidad y SIN cupón. */
  cashSubtotal: number;
  cardSubtotal: number;
  /** Descuento del cupón aplicado, por modo de pago (0 si no hay o no aplica). */
  discountCash: number;
  discountCard: number;
}

/**
 * Descuento del cupón aplicado sobre el carrito, calculado igual que el checkout
 * (priceCartItems + evaluateCouponForCart), para que el carrito muestre el total
 * con el cupón y no el precio entero.
 */
export function useCartCoupon(): CartCouponValue {
  const { items } = useCart();
  const { byLine } = useCartPromos();
  const { savedCoupon, couponRecord } = useCoupon();
  const storeType = useStoreType() ?? 'retail';

  return useMemo(() => {
    const pricedItems = priceCartItems(items, byLine, storeType);
    const hasNonStackablePromo = pricedItems.some((i) => i.promo_id && i.promo_stackable === false);
    const cardSubtotal = pricedItems.reduce((s, i) => s + i.unit_price * i.qty, 0);
    const cashSubtotal = pricedItems.reduce(
      (s, i) => s + (typeof i.unit_price_cash === 'number' ? i.unit_price_cash : i.unit_price) * i.qty,
      0,
    );
    let discountCash = 0;
    let discountCard = 0;
    if (savedCoupon?.applied && couponRecord) {
      discountCash = evaluateCouponForCart(couponRecord, pricedItems, 'cash', storeType, hasNonStackablePromo).discount;
      discountCard = evaluateCouponForCart(couponRecord, pricedItems, 'card', storeType, hasNonStackablePromo).discount;
    }
    return { pricedItems, hasNonStackablePromo, cashSubtotal, cardSubtotal, discountCash, discountCard };
  }, [items, byLine, storeType, savedCoupon?.applied, couponRecord]);
}
