/**
 * P1.2-FIN0-B: importes que muestra el carrito (filas, subtotal y base del envío
 * gratis), sacados de la MISMA fuente que el checkout:
 *
 *   - `pricedItems` = priceCartItems(items, byLine) (useCartCoupon), con la
 *     regla de FIN0-A: la promo por cantidad no se acumula con la automática y
 *     en cada medio de pago queda el precio más conveniente;
 *   - el cupón de evaluateCouponForCart (useCartCoupon), por medio de pago.
 *
 * Acá no hay ninguna fórmula comercial: sólo se suman y se presentan los precios
 * que ya resolvió priceCartItems. Puro (sin React) para probarlo con node.
 * Lo usan el carrito y el carrito lateral de Classic y las plantillas.
 */
import { groupCartItems, type CartDisplayRow } from './cart';
import { resolvePricePair } from './utils';
import type { QtyPromoLineResult } from './promotions';
import type { CartItem, StoreConfig } from './types';

export type CartPriceConfig = Pick<StoreConfig, 'priceDisplay' | 'cashLabel'> & Partial<Pick<StoreConfig, 'priceEmphasis'>>;

/** Precio de una fila o del subtotal, ya resuelto según lo que muestra la tienda. */
export interface CartAmount {
  big: number;
  /** Segunda línea ("$35.715 con tarjeta"), si la tienda la muestra. */
  small: number | null;
  smallLabel: string;
  /** Tachado: precio antes del descuento, en la MISMA base que `big`; sólo si es mayor. */
  strike: number | null;
  /** `big` o `small` es un precio de contado. */
  isCash: boolean;
}

export interface CartAmountRow {
  /** Agrupación de los items del carrito (claves, unidades, edición, quitar). */
  row: CartDisplayRow;
  /** El precio que se cobra en el checkout. */
  price: CartAmount;
  /** La fila tiene una promo por cantidad que bajó su precio (en algún medio de pago). */
  qtyPromo: boolean;
}

/**
 * Filas del carrito con el precio de cada una tal como lo cobra el checkout
 * (groupCartItems sobre los `pricedItems`, igual que el resumen del checkout).
 *
 * - Escalones «Lleva N»: su precio propio (priceCartItems no los toca); el
 *   tachado sigue siendo la lista, como hasta ahora.
 * - Fila con promo por cantidad: contado y tarjeta ya con la promo; el tachado
 *   es el precio de ANTES de la promo por cantidad en la misma base que el
 *   número grande (contado contra contado, tarjeta contra tarjeta), así no se
 *   presenta como descuento lo que ya trae el producto ni el descuento por pago.
 *   Si la promo no mejora nada (gana la automática), no hay tachado.
 * - Resto: sin cambios (los `pricedItems` son los mismos items).
 */
export function cartAmountRows(
  items: CartItem[],
  pricedItems: CartItem[],
  byLine: Map<string, QtyPromoLineResult>,
  config: CartPriceConfig,
): CartAmountRow[] {
  const priced = new Map(groupCartItems(pricedItems).map((r) => [r.key, r]));
  return groupCartItems(items).map((row) => {
    const p = priced.get(row.key) ?? row;
    const pair = resolvePricePair(config, p.cashTotal, p.lineTotal);
    const amount = { big: pair.big, small: pair.small, smallLabel: pair.smallLabel, isCash: pair.isCash };
    if (row.source === 'tier') {
      const strike = p.originalTotal != null && p.originalTotal > p.lineTotal ? p.originalTotal : null;
      return { row, price: { ...amount, strike }, qtyPromo: false };
    }
    const active = !!byLine.get(row.removeKeys[0])?.active;
    const lowered = active && (p.lineTotal < row.lineTotal || (p.cashTotal ?? p.lineTotal) < (row.cashTotal ?? row.lineTotal));
    let strike: number | null = null;
    if (lowered) {
      const cashBig = pair.isCash && !pair.cardFirst;
      const before = cashBig ? (row.cashTotal ?? row.lineTotal) : row.lineTotal;
      strike = before > pair.big ? before : null;
    }
    return { row, price: { ...amount, strike }, qtyPromo: lowered };
  });
}

/**
 * Subtotal de tarjeta y de contado de los `pricedItems`, sin cupón: la misma
 * suma que hace el checkout (cardSubtotal / cashSubtotal).
 */
export function sumCartSubtotals(pricedItems: CartItem[]): { cashSubtotal: number; cardSubtotal: number } {
  let cardSubtotal = 0;
  let cashSubtotal = 0;
  for (const i of pricedItems) {
    cardSubtotal += i.unit_price * i.qty;
    cashSubtotal += (typeof i.unit_price_cash === 'number' ? i.unit_price_cash : i.unit_price) * i.qty;
  }
  return { cashSubtotal, cardSubtotal };
}

/** Subtotales que ya calcula useCartCoupon (mismos que el checkout). */
export interface CartSubtotals {
  cashSubtotal: number;
  cardSubtotal: number;
  discountCash: number;
  discountCard: number;
}

/**
 * Subtotal del carrito: el par contado/tarjeta de los `pricedItems`. Con un
 * cupón aplicado, el número es con el cupón (como el total del checkout) y el
 * de antes queda tachado.
 */
export function cartSubtotalAmount(s: CartSubtotals, config: CartPriceConfig): CartAmount & { couponActive: boolean } {
  const before = resolvePricePair(config, s.cashSubtotal, s.cardSubtotal);
  const couponActive = s.discountCash > 0 || s.discountCard > 0;
  const shown = couponActive
    ? resolvePricePair(config, s.cashSubtotal - s.discountCash, s.cardSubtotal - s.discountCard)
    : before;
  return {
    big: shown.big,
    small: shown.small,
    smallLabel: shown.smallLabel,
    isCash: shown.isCash,
    strike: couponActive && before.big > shown.big ? before.big : null,
    couponActive,
  };
}

/**
 * Base del envío gratis en el carrito. El checkout lo evalúa contra el subtotal
 * de mercadería del medio de pago elegido, sin cupón ni envío (evalFreeShipping
 * con cashSubtotal o cardSubtotal). El carrito todavía no sabe el medio, así
 * que usa el más bajo de los dos: si acá dice "envío gratis", el checkout lo da
 * con cualquier medio de pago.
 */
export function freeShippingBase(s: Pick<CartSubtotals, 'cashSubtotal' | 'cardSubtotal'>): number {
  return Math.min(s.cashSubtotal, s.cardSubtotal);
}
