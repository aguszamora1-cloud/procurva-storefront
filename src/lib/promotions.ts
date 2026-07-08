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
  // Tipo: 'automatic' (se aplica siempre) o 'quantity' (al llevar min_quantity+).
  // Campos viejos sin la columna llegan como undefined -> se tratan como 'automatic'.
  promo_type?: 'automatic' | 'quantity' | null;
  min_quantity?: number | null;
  quantity_message?: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value_minorista: number;
  discount_value_mayorista: number;
  // Canal en el que aplica la promo. Filas viejas sin la columna llegan como
  // undefined -> se tratan como 'both' (comportamiento histórico).
  channel?: 'retail' | 'wholesale' | 'both' | null;
  scope: 'all' | 'categories' | 'products';
  // Vigencia OPCIONAL: null = sin límite (starts_at null aplica desde siempre;
  // ends_at null no vence). Una promo activa sin fechas es permanente.
  starts_at: string | null;
  ends_at: string | null;
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

/** ¿Es una promo por cantidad? (las viejas sin promo_type son 'automatic'). */
export function isQuantityPromo(promo: Promotion): boolean {
  return promo.promo_type === 'quantity';
}

/**
 * ¿La promo aplica al canal de este carrito? 'both' aplica a los dos; una promo
 * sin `channel` (cache viejo pre-columna) se trata como 'both' para no cambiar
 * el comportamiento histórico.
 */
export function promoMatchesChannel(promo: Promotion, storeType: StoreType): boolean {
  const channel = promo.channel ?? 'both';
  return channel === 'both' || channel === storeType;
}

/**
 * Valor de descuento de la promo según el tipo de tienda. Chokepoint ÚNICO del
 * filtro por canal: si la promo no aplica a `storeType`, devuelve 0 y así TODAS
 * las funciones del motor (que descartan cuando el valor es <= 0) la ignoran
 * sin necesidad de repetir el chequeo en cada loop.
 */
export function promoDiscountValue(promo: Promotion, storeType: StoreType): number {
  if (!promoMatchesChannel(promo, storeType)) return 0;
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
    if (isQuantityPromo(promo)) continue; // las de cantidad se aplican en el carrito, no per-unit
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

// ============================================================================
// Promociones POR CANTIDAD (promo_type='quantity')
// El descuento NO se aplica per-unit: se activa cuando el cliente lleva
// min_quantity o más unidades. Por producto cuenta la qty de ese producto; por
// categoría suma TODAS las unidades de la categoría en el carrito.
// ============================================================================

/** Rank de especificidad del scope (más específico gana). */
const scopeRank = (p: Promotion): number => (p.scope === 'products' ? 0 : p.scope === 'categories' ? 1 : 2);

/** Mejor promo POR CANTIDAD aplicable a un producto (para badge/banner condicional). */
export function quantityPromoForProduct(
  product: Pick<Product, 'id' | 'categories'>,
  promotions: Promotion[],
  storeType: StoreType,
): Promotion | null {
  let best: Promotion | null = null;
  let bestV = 0;
  for (const promo of promotions) {
    if (!isQuantityPromo(promo)) continue;
    const v = promoDiscountValue(promo, storeType);
    if (v <= 0 || !promoAppliesToProduct(promo, product)) continue;
    if (!best || scopeRank(promo) < scopeRank(best) || (scopeRank(promo) === scopeRank(best) && v > bestV)) {
      best = promo;
      bestV = v;
    }
  }
  return best;
}

/** Mensaje a mostrar para una promo por cantidad (el del admin o uno autogenerado). */
export function quantityPromoMessage(promo: Promotion, storeType: StoreType): string {
  const custom = (promo.quantity_message ?? '').trim();
  if (custom) return custom;
  const min = promo.min_quantity ?? 2;
  const v = promoDiscountValue(promo, storeType);
  if (promo.discount_type === 'fixed') return `Llevá ${min} y ahorrá $${Math.round(v).toLocaleString('es-AR')} por unidad`;
  return `Llevá ${min} y ahorrá un ${v}%`;
}

/** Línea de carrito (forma mínima) que entra al cálculo de promos por cantidad. */
export interface QtyPromoCartLine {
  key: string;
  productId: string;
  categories: string[];
  qty: number;
  /** Precio unitario actual (puede ya incluir una promo automática). */
  unitPriceBase: number;
  /** Precio de lista sin ninguna promo (base para recalcular el descuento por cantidad). */
  unitPriceOriginal: number;
}

/** Resultado por línea del cálculo de promos por cantidad. */
export interface QtyPromoLineResult {
  /** Promo que define el estado (activa si llega al mínimo; si no, la más cercana para el nudge). */
  promo: Promotion | null;
  active: boolean;
  /** Unidades que faltan para activar la promo más cercana (0 si está activa o no hay promo). */
  missing: number;
  /** Precio unitario final a cobrar (el mejor entre la promo automática y la de cantidad). */
  unitPriceFinal: number;
  /** Precio de lista para tachar cuando hay descuento. */
  unitPriceOriginal: number;
}

const matchesLine = (promo: Promotion, line: QtyPromoCartLine): boolean =>
  promoAppliesToProduct(promo, { id: line.productId, categories: line.categories });

/**
 * Calcula las promos por cantidad sobre TODO el carrito. Devuelve un mapa por
 * `key` de línea. Para scope categoría, la cantidad mínima se evalúa sumando
 * todas las unidades de la categoría en el carrito (no una sola línea).
 */
export function computeQuantityPromos(
  lines: QtyPromoCartLine[],
  promotions: Promotion[],
  storeType: StoreType,
): Map<string, QtyPromoLineResult> {
  const qPromos = promotions.filter((p) => isQuantityPromo(p) && promoDiscountValue(p, storeType) > 0);
  // Cantidad total en scope de cada promo (sumando todas las líneas que matchean).
  const totalForPromo = new Map<string, number>();
  for (const promo of qPromos) {
    let total = 0;
    for (const line of lines) if (matchesLine(promo, line)) total += line.qty;
    totalForPromo.set(promo.id, total);
  }

  const out = new Map<string, QtyPromoLineResult>();
  for (const line of lines) {
    const applicable = qPromos.filter((p) => matchesLine(p, line));
    // Promo activa que deje el mejor precio.
    let activeBest: { promo: Promotion; finalUnit: number } | null = null;
    // Promo no activa más cercana al mínimo (para el nudge).
    let nudge: { promo: Promotion; missing: number } | null = null;

    for (const promo of applicable) {
      const total = totalForPromo.get(promo.id) ?? 0;
      const min = promo.min_quantity ?? 2;
      if (total >= min) {
        const finalUnit = applyPromoToPrice(line.unitPriceOriginal, promo, storeType);
        if (!activeBest || finalUnit < activeBest.finalUnit) activeBest = { promo, finalUnit };
      } else {
        const missing = min - total;
        if (!nudge || missing < nudge.missing) nudge = { promo, missing };
      }
    }

    if (activeBest) {
      // El precio final es el mejor entre la promo automática (ya en base) y la de cantidad.
      const finalUnit = Math.min(line.unitPriceBase, activeBest.finalUnit);
      out.set(line.key, {
        promo: activeBest.promo,
        active: true,
        missing: 0,
        unitPriceFinal: finalUnit,
        unitPriceOriginal: line.unitPriceOriginal,
      });
    } else if (nudge) {
      out.set(line.key, {
        promo: nudge.promo,
        active: false,
        missing: nudge.missing,
        unitPriceFinal: line.unitPriceBase,
        unitPriceOriginal: line.unitPriceOriginal,
      });
    }
  }
  return out;
}

/** Mejor promo aplicable a un producto (para badge/countdown), sin un precio puntual. */
export function bestPromoForProduct(
  product: Pick<Product, 'id' | 'categories'>,
  promotions: Promotion[],
  storeType: StoreType,
): Promotion | null {
  let best: Promotion | null = null;
  for (const promo of promotions) {
    if (isQuantityPromo(promo)) continue; // las de cantidad tienen su propio badge condicional
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
