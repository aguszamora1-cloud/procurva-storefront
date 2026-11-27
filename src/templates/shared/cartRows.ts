/**
 * Filas del carrito de las plantillas (P1.2-B0). Puro: sin React, para poder
 * probarlo con node (scripts/template-cart.test.mjs).
 *
 * MISMA agrupación, mismos precios por fila y mismo subtotal que el carrito de
 * Classic (components/CartDrawer.tsx y pages/Cart.tsx), resueltos con sus mismos
 * helpers: lib/cartAmounts (P1.2-FIN0-B: los precios que cobra el checkout,
 * priceCartItems + cupón) y el resultado de useCartPromos. Las plantillas sólo
 * deciden cómo se ve.
 */
import {
  cartAmountRows,
  cartSubtotalAmount,
  freeShippingBase,
  type CartAmount,
  type CartPriceConfig,
  type CartSubtotals,
} from '@/lib/cartAmounts';
import type { QtyPromoLineResult } from '@/lib/promotions';
import type { CartItem, StoreConfig } from '@/lib/types';

export type { CartAmount } from '@/lib/cartAmounts';

/** Grupo comercial indivisible del carrito (mismos tipos que agrupa Classic). */
export type CartGroupKind = 'tier' | 'curva' | 'curva_surtida' | 'pack';

/**
 * Una fila del carrito tal como la agrupa Classic (`groupCartItems`).
 *
 * Los escalones «Lleva N», las curvas y los packs son UNA fila indivisible: no
 * traen `qty` (no hay acción para sumar o restar unidades sueltas, ni con mouse,
 * ni con teclado, ni con el botón del celular) y `remove` quita el grupo entero,
 * igual que el tacho de Classic. Sólo un producto suelto editable trae `qty`.
 */
export interface CartRow {
  key: string;
  productId: string;
  name: string;
  image: string | null;
  /** null = producto suelto. */
  group: CartGroupKind | null;
  /** Suelto: su línea (color y talle). Grupo: null. */
  item: CartItem | null;
  /** Texto del grupo armado por Classic ("Lleva 3 — 20% OFF — M/Negro · L/Rojo"). */
  detail: string;
  units: number;
  price: CartAmount;
  /** Precio por unidad de un suelto con más de una unidad. */
  unit: number | null;
  qty: { dec: () => void; inc: () => void } | null;
  remove: () => void;
}

type PriceConfig = CartPriceConfig;

export interface CartActions {
  updateQty: (lineKey: string, qty: number) => void;
  removeItem: (lineKey: string) => void;
}

/**
 * Tachado de un suelto con promo automática (Classic no lo muestra; no cambia el
 * total). Sólo con una promo real de la línea (`promo_id` y lista mayor que el
 * precio) y en la MISMA base que el número grande: si el grande es el contado,
 * se tacha el contado de lista; si es la tarjeta, la tarjeta de lista. Nunca el
 * precio de otro medio de pago: «$25.000 ~~$35.715~~» con $35.715 = tarjeta se
 * leía como un descuento que no existe (T8, 24/11).
 */
export function autoPromoStrike(only: CartItem, price: CartAmount): number | null {
  if (!only.promo_id || typeof only.unit_price_original !== 'number' || !(only.unit_price_original > only.unit_price)) return null;
  const cash = typeof only.unit_price_cash === 'number' ? only.unit_price_cash * only.qty : null;
  const card = only.unit_price * only.qty;
  let list: number | null = null;
  if (price.isCash && cash != null && price.big === cash) {
    list = typeof only.unit_price_cash_original === 'number' ? only.unit_price_cash_original * only.qty : null;
  } else if (price.big === card) {
    list = only.unit_price_original * only.qty;
  }
  return list != null && list > price.big ? list : null;
}

/**
 * `pricedItems` = los de useCartCoupon (priceCartItems), los mismos del checkout.
 */
export function buildCartRows(
  items: CartItem[],
  pricedItems: CartItem[],
  byLine: Map<string, QtyPromoLineResult>,
  config: PriceConfig,
  { updateQty, removeItem }: CartActions,
): CartRow[] {
  return cartAmountRows(items, pricedItems, byLine, config).map(({ row, price: amount, qtyPromo }) => {
    let price = amount;
    if (row.source === 'suelto' && !qtyPromo && price.strike == null) {
      const strike = autoPromoStrike(row.items[0], price);
      if (strike != null) price = { ...price, strike };
    }
    const single = row.source === 'suelto' && row.editable && row.removeKeys.length === 1 && row.items.length === 1;
    const key = row.removeKeys[0];
    return {
      key: row.key,
      productId: row.productId,
      name: row.name,
      image: row.image,
      group: row.source === 'suelto' ? null : row.source,
      item: single ? row.items[0] : null,
      detail: row.detail,
      units: row.units,
      price,
      unit: single && row.units > 1 ? Math.round(price.big / row.units) : null,
      qty: single ? { dec: () => updateQty(key, row.units - 1), inc: () => updateQty(key, row.units + 1) } : null,
      remove: () => row.removeKeys.forEach(removeItem),
    };
  });
}

export interface CartTotals {
  /** Con cupón aplicado: el subtotal con el cupón y el de antes en `strike`. */
  subtotal: CartAmount;
  /** Código del cupón que bajó el subtotal, o null. */
  couponCode: string | null;
  freeShippingFrom: number;
  freeShippingLeft: number | null;
  freeShippingPct: number;
}

/**
 * Subtotal y envío gratis: los mismos de Classic (lib/cartAmounts), sobre los
 * subtotales de useCartCoupon (los del checkout).
 */
export function cartTotals(
  sums: CartSubtotals,
  config: PriceConfig & Pick<StoreConfig, 'freeShippingFrom'>,
  couponCode: string | null = null,
): CartTotals {
  const { couponActive, ...subtotal } = cartSubtotalAmount(sums, config);
  const base = freeShippingBase(sums);
  const from = config.freeShippingFrom;
  return {
    subtotal,
    couponCode: couponActive ? couponCode : null,
    freeShippingFrom: from,
    freeShippingLeft: from > 0 ? Math.max(0, from - base) : null,
    freeShippingPct: from > 0 ? Math.min(100, Math.round((base / from) * 100)) : 0,
  };
}

/** "3 unidades" / "1 unidad". */
export function unitsLabel(n: number): string {
  return `${n} ${n === 1 ? 'unidad' : 'unidades'}`;
}
