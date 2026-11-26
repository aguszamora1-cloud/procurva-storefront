// Líneas del carrito sin contado de lista (P1.2-FIN0-A.2). Módulo liviano: lo usa
// CartContext; la reconstrucción contra el catálogo vive en cartCashRecovery.ts
// y se carga sólo cuando hace falta.

import { cartLineKey } from './cart';
import type { CartItem } from './types';

/**
 * ¿La línea es un suelto con promo automática y contado, sin contado de lista?
 * Quedan afuera escalones, curvas, packs, outfits, oferta antes de pagar y las
 * líneas que ya traen el dato.
 */
export function needsCashOriginal(it: CartItem): boolean {
  return (
    it.source == null &&
    !it.tierGroupId &&
    !it.outfit_id &&
    !it.order_bump &&
    !!it.promo_id &&
    typeof it.unit_price_cash === 'number' &&
    typeof it.unit_price_original === 'number' &&
    it.unit_price_original > it.unit_price &&
    it.unit_price_cash_original === undefined
  );
}

/**
 * Huella de lo que determina el precio de la línea (todo menos la cantidad, que
 * el comprador puede cambiar mientras se verifica). Sirve para completar SÓLO la
 * línea que se verificó: si fue quitada, reemplazada o cambió, no coincide.
 */
export function cashRecoverySignature(it: CartItem): string {
  return JSON.stringify([
    cartLineKey(it),
    it.product_id,
    it.variant_id,
    it.size ?? null,
    it.color ?? null,
    it.unit_price,
    it.unit_price_cash ?? null,
    it.unit_price_original ?? null,
    it.promo_id ?? null,
    it.promo_name ?? null,
    it.promo_stackable ?? null,
    Array.isArray(it.categories) ? it.categories : null,
  ]);
}
