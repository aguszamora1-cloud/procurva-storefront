// Promociones automáticas del storefront (tabla ecommerce_promotions de ProCurva).
// A diferencia de los cupones (códigos que el cliente tipea), las promos se
// aplican SOLAS y ajustan el precio que ve el cliente. Soportan pricing dual:
// un valor de descuento para minorista y otro para mayorista.
//
// NOTA de esquema (idéntico criterio que la Parte 1 / bundle_promotions):
//  - La empresa se identifica por company_id (no tenant_id).
//  - Las categorías de ProCurva son STRINGS (products.categories: text[]); el
//    junction guarda el nombre de la categoría o el uuid del producto en item_id.

import type { Product, StoreType } from './types';

export interface PromotionItem {
  item_type: 'category' | 'product';
  item_id: string;
}

/** Fila de ecommerce_promotions + sus items (scope categories/products). */
export interface Promotion {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value_minorista: number;
  discount_value_mayorista: number;
  scope: 'all' | 'categories' | 'products';
  starts_at: string;
  ends_at: string;
  stackable_with_coupons: boolean | null;
  min_purchase_amount: number | null;
  max_discount_amount: number | null;
  badge_text: string | null;
  badge_color: string | null;
  show_countdown: boolean | null;
  banner_image_url: string | null;
  is_active: boolean | null;
  // Embebido por el select anidado del provider.
  ecommerce_promotion_items?: PromotionItem[];
}

/** Resultado de aplicar la mejor promo a un precio. */
export interface PromoResult {
  /** Precio final con la promo aplicada (= original si no hay promo). */
  finalPrice: number;
  /** La promo aplicada, o null. */
  promo: Promotion | null;
  /** Ahorro en $ (original - final). 0 si no hay promo. */
  savings: number;
  /** % de descuento sobre el original (para el badge "-X%"). */
  discountPct: number;
}

/** Valor de descuento de la promo según el tipo de tienda. */
export function promoDiscountValue(promo: Promotion, storeType: StoreType): number {
  const v = storeType === 'wholesale' ? promo.discount_value_mayorista : promo.discount_value_minorista;
  return Number(v ?? 0);
}

/** ¿La promo alcanza a este producto? (scope all / categorías / productos). */
export function promoAppliesToProduct(promo: Promotion, product: Pick<Product, 'id' | 'categories'>): boolean {
  if (promo.scope === 'all') return true;
  const items = promo.ecommerce_promotion_items ?? [];
  if (promo.scope === 'products') {
    return items.some((i) => i.item_type === 'product' && i.item_id === product.id);
  }
  if (promo.scope === 'categories') {
    const cats = Array.isArray(product.categories) ? product.categories.filter(Boolean) : [];
    return items.some((i) => i.item_type === 'category' && cats.includes(i.item_id));
  }
  return false;
}

/**
 * Aplica una promo a un precio unitario.
 *  - percentage: resta value% del precio.
 *  - fixed: resta value (en minorista, del precio; en mayorista, por unidad).
 * Respeta max_discount_amount (tope de descuento en $). Nunca baja de 0.
 */
export function applyPromoToPrice(price: number, promo: Promotion, storeType: StoreType): number {
  const value = promoDiscountValue(promo, storeType);
  if (!(price > 0) || value <= 0) return price;
  let discounted = promo.discount_type === 'percentage' ? price * (1 - value / 100) : price - value;
  let savings = price - discounted;
  if (savings < 0) savings = 0;
  if (promo.max_discount_amount != null && savings > promo.max_discount_amount) {
    discounted = price - promo.max_discount_amount;
  }
  return Math.max(0, Math.round(discounted));
}

/**
 * Mejor promo (la que deja el precio más bajo) para un producto y un precio de
 * referencia. Devuelve el precio final, la promo, el ahorro y el %.
 *
 * Solo considera promos que efectivamente bajan el precio (descuento > 0 para el
 * storeType). `min_purchase_amount` es una regla de carrito y NO se evalúa acá
 * (se mostraría un precio que no se cumpliría a nivel item); el descuento
 * automático por producto se muestra siempre que la promo esté vigente.
 */
export function getPromotionalPrice(
  originalPrice: number,
  product: Pick<Product, 'id' | 'categories'>,
  promotions: Promotion[],
  storeType: StoreType,
): PromoResult {
  let best: { promo: Promotion; finalPrice: number } | null = null;
  for (const promo of promotions) {
    if (promoDiscountValue(promo, storeType) <= 0) continue;
    if (!promoAppliesToProduct(promo, product)) continue;
    const finalPrice = applyPromoToPrice(originalPrice, promo, storeType);
    if (finalPrice >= originalPrice) continue; // no descuenta nada
    if (!best || finalPrice < best.finalPrice) best = { promo, finalPrice };
  }
  if (!best) return { finalPrice: originalPrice, promo: null, savings: 0, discountPct: 0 };
  const savings = originalPrice - best.finalPrice;
  const discountPct = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;
  return { finalPrice: best.finalPrice, promo: best.promo, savings, discountPct };
}

/** Mejor promo aplicable a un producto (para badge/countdown), sin un precio puntual. */
export function bestPromoForProduct(
  product: Pick<Product, 'id' | 'categories'>,
  promotions: Promotion[],
  storeType: StoreType,
): Promotion | null {
  let best: Promotion | null = null;
  for (const promo of promotions) {
    const v = promoDiscountValue(promo, storeType);
    if (v <= 0 || !promoAppliesToProduct(promo, product)) continue;
    if (!best) {
      best = promo;
    } else {
      // Prioridad: scope más específico, luego mayor valor de descuento.
      const rank = (p: Promotion) => (p.scope === 'products' ? 0 : p.scope === 'categories' ? 1 : 2);
      if (rank(promo) < rank(best) || (rank(promo) === rank(best) && v > promoDiscountValue(best, storeType))) {
        best = promo;
      }
    }
  }
  return best;
}
