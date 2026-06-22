import { useMemo } from 'react';
import { useCart } from '@/context/CartContext';
import { usePromotions } from '@/context/PromotionsContext';
import { useStoreStatus } from '@/context/StoreProvider';
import { cartLineKey } from '@/lib/cart';
import {
  computeQuantityPromos,
  quantityPromoMessage,
  type QtyPromoCartLine,
  type QtyPromoLineResult,
} from '@/lib/promotions';
import type { CartItem } from '@/lib/types';

export interface CartNudge {
  key: string;
  productName: string;
  missing: number;
  message: string;
}

export interface CartPromosValue {
  /** Resultado de promo por cantidad por línea (clave = cartLineKey). */
  byLine: Map<string, QtyPromoLineResult>;
  /** Precio unitario final de una línea (con la promo por cantidad si está activa). */
  unitFinal: (item: CartItem) => number;
  /** Subtotal del carrito ya con las promos por cantidad aplicadas. */
  adjustedSubtotal: number;
  /** Ahorro total por promos de cantidad ($). */
  quantitySavings: number;
  /** Nudges: promos por cantidad disponibles a las que les falta poco para activarse. */
  nudges: CartNudge[];
}

/**
 * Capa derivada sobre el carrito: aplica las promos POR CANTIDAD
 * (ecommerce_promotions con promo_type='quantity') sobre todo el carrito.
 * Vive fuera de CartContext porque PromotionsProvider es descendiente de
 * CartProvider; cualquier componente bajo PromotionsProvider puede usar este hook.
 */
export function useCartPromos(): CartPromosValue {
  const { items } = useCart();
  const { promotions } = usePromotions();
  const { storeType } = useStoreStatus();
  const effectiveStoreType = storeType ?? 'retail';

  return useMemo(() => {
    const lines: QtyPromoCartLine[] = items.map((it) => ({
      key: cartLineKey(it),
      productId: it.product_id,
      categories: Array.isArray(it.categories) ? it.categories.filter(Boolean) as string[] : [],
      qty: it.qty,
      unitPriceBase: it.unit_price,
      unitPriceOriginal: it.unit_price_original ?? it.unit_price,
    }));

    const byLine = computeQuantityPromos(lines, promotions, effectiveStoreType);

    const unitFinal = (item: CartItem): number => {
      const r = byLine.get(cartLineKey(item));
      return r?.active ? r.unitPriceFinal : item.unit_price;
    };

    let adjustedSubtotal = 0;
    let quantitySavings = 0;
    for (const it of items) {
      const final = unitFinal(it);
      adjustedSubtotal += final * it.qty;
      quantitySavings += Math.max(0, it.unit_price - final) * it.qty;
    }

    // Nudges: una entrada por promo no activa más cercana (dedupe por promo.id).
    const seen = new Set<string>();
    const nudges: CartNudge[] = [];
    for (const it of items) {
      const r = byLine.get(cartLineKey(it));
      if (!r || r.active || !r.promo || r.missing <= 0) continue;
      if (seen.has(r.promo.id)) continue;
      seen.add(r.promo.id);
      nudges.push({
        key: r.promo.id,
        productName: it.name,
        missing: r.missing,
        message: quantityPromoMessage(r.promo, effectiveStoreType),
      });
    }

    return { byLine, unitFinal, adjustedSubtotal, quantitySavings, nudges };
  }, [items, promotions, effectiveStoreType]);
}
