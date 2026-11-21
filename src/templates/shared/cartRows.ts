/**
 * Filas del carrito de las plantillas (P1.2-B0). Puro: sin React, para poder
 * probarlo con node (scripts/template-cart.test.mjs).
 *
 * MISMA agrupación, mismos precios por fila y mismo subtotal que el carrito de
 * Classic (components/CartDrawer.tsx y pages/Cart.tsx), resueltos con sus mismos
 * helpers: groupCartItems (lib/cart), el resultado de useCartPromos y
 * resolvePricePair (lib/utils). Las plantillas sólo deciden cómo se ve.
 */
import { groupCartItems } from '@/lib/cart';
import { resolvePricePair } from '@/lib/utils';
import type { QtyPromoLineResult } from '@/lib/promotions';
import type { CartItem, StoreConfig } from '@/lib/types';

/** Grupo comercial indivisible del carrito (mismos tipos que agrupa Classic). */
export type CartGroupKind = 'tier' | 'curva' | 'curva_surtida' | 'pack';

/** Precio de una fila o del subtotal, ya resuelto como lo muestra Classic. */
export interface CartAmount {
  big: number;
  /** Segunda línea ("$35.715 con tarjeta"), si la tienda la muestra. */
  small: number | null;
  smallLabel: string;
  /** Tachado: precio antes del descuento, sólo si es mayor que `big`. */
  strike: number | null;
}

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

type PriceConfig = Pick<StoreConfig, 'priceDisplay' | 'cashLabel'> & Partial<Pick<StoreConfig, 'priceEmphasis'>>;

export interface CartActions {
  updateQty: (lineKey: string, qty: number) => void;
  removeItem: (lineKey: string) => void;
}

export function buildCartRows(
  items: CartItem[],
  byLine: Map<string, QtyPromoLineResult>,
  config: PriceConfig,
  { updateQty, removeItem }: CartActions,
): CartRow[] {
  return groupCartItems(items).map((row) => {
    const isTier = row.source === 'tier';
    // Precio de la fila: mismas ramas que CartDrawer.
    let price: CartAmount;
    const promo = isTier ? undefined : byLine.get(row.removeKeys[0]);
    if (isTier) {
      const pair = resolvePricePair(config, row.cashTotal, row.lineTotal);
      const strike = row.originalTotal != null && row.originalTotal > row.lineTotal ? row.originalTotal : null;
      price = { big: pair.big, small: pair.small, smallLabel: pair.smallLabel, strike };
    } else if (promo?.active) {
      price = { big: promo.unitPriceFinal * row.units, small: null, smallLabel: '', strike: row.lineTotal };
    } else {
      const pair = resolvePricePair(config, row.cashTotal, row.lineTotal);
      // Suelto con promo automática: el precio de lista queda tachado (dato real
      // de la línea: unit_price_original). Classic no lo muestra; no cambia el total.
      const only = row.source === 'suelto' ? row.items[0] : null;
      const original = only ? (only.unit_price_original ?? only.unit_price) * only.qty : 0;
      price = { big: pair.big, small: pair.small, smallLabel: pair.smallLabel, strike: original > pair.big ? original : null };
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
  subtotal: CartAmount;
  freeShippingFrom: number;
  freeShippingLeft: number | null;
  freeShippingPct: number;
}

/**
 * Subtotal: el mismo par que Classic (contado protagonista si la tienda lo
 * muestra), con la misma base para el envío gratis que Classic le pasa a
 * FreeShippingProgress. `adjustedSubtotal` sale de useCartPromos.
 */
export function cartTotals(
  items: CartItem[],
  adjustedSubtotal: number,
  config: PriceConfig & Pick<StoreConfig, 'freeShippingFrom'>,
): CartTotals {
  const cashSubtotal = items.reduce((s, i) => s + (typeof i.unit_price_cash === 'number' ? i.unit_price_cash : i.unit_price) * i.qty, 0);
  const hasCash = cashSubtotal > 0 && cashSubtotal < adjustedSubtotal;
  const pair = resolvePricePair(config, hasCash ? cashSubtotal : null, adjustedSubtotal);
  const base = pair.primary;
  const from = config.freeShippingFrom;
  return {
    subtotal: { big: pair.big, small: pair.small, smallLabel: pair.smallLabel, strike: null },
    freeShippingFrom: from,
    freeShippingLeft: from > 0 ? Math.max(0, from - base) : null,
    freeShippingPct: from > 0 ? Math.min(100, Math.round((base / from) * 100)) : 0,
  };
}

/** "3 unidades" / "1 unidad". */
export function unitsLabel(n: number): string {
  return `${n} ${n === 1 ? 'unidad' : 'unidades'}`;
}
