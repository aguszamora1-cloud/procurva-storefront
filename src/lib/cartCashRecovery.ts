// Contado de lista de las líneas guardadas antes de P1.2-FIN0-A (sin
// `unit_price_cash_original`). Sin ese dato, priceCartItems no puede comparar en
// contado la promo por cantidad contra la automática y la línea queda con el
// resguardo (conserva su contado, sin acumular).
//
// No hay historial de precios: la única fuente es el catálogo VIGENTE. Se usa
// sólo si, al rearmar la línea hoy con el mismo builder de la ficha
// (buildSingleCartItem), sale EXACTAMENTE lo que está guardado. Si algo cambió
// (precio, talle, color, promo, categorías) la línea no se toca. Nunca se deduce
// el contado desandando porcentajes.

import { buildSingleCartItem } from './tierPurchase';
import { getPriceInfo, productCategories } from './utils';
import { bestPromoForProduct, getPromotionalPrice, type Promotion } from './promotions';
import { needsCashOriginal } from './cartCashLine';
import type { CartItem, Product, Variant } from './types';

/** Lo que se lee del producto para rearmar la línea. */
export type RecoveryProduct = Pick<
  Product,
  'id' | 'categories' | 'retail_price' | 'retail_price_card' | 'retail_price_transfer' | 'compare_at_price'
> & {
  size_price_adjustments?: Product['size_price_adjustments'];
  product_variants?: { id: string; size: string | null; color: string | null }[] | null;
};

const sameList = (a: string[] | null | undefined, b: string[] | null | undefined) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Contado de lista vigente de la línea, o null si no se puede verificar.
 *
 * Exige, con el catálogo de hoy:
 *  - el mismo producto y UNA sola variante con ese id, con el mismo talle y color;
 *  - la misma promo automática (id, nombre y si acumula con cupones), resuelta
 *    con el color de la línea (las promos por color cuentan);
 *  - los mismos precios: tarjeta con promo, contado con promo y tarjeta de lista
 *    (que ya incluyen el ajuste por talle);
 *  - las mismas categorías (deciden qué promos alcanzan a la línea).
 * `promotions` tiene que ser la lista COMPLETA de promos vigentes de la tienda.
 */
export function recoverCashOriginal(
  line: CartItem,
  product: RecoveryProduct | null | undefined,
  promotions: Promotion[],
): number | null {
  if (!needsCashOriginal(line) || !product || product.id !== line.product_id) return null;
  const same = (product.product_variants ?? []).filter((v) => v.id === line.variant_id);
  if (same.length !== 1) return null;
  const variant = same[0];
  if ((variant.size ?? null) !== (line.size ?? null) || (variant.color ?? null) !== (line.color ?? null)) return null;

  // Exactamente lo que hace la ficha (pages/ProductDetail.tsx y las plantillas).
  const { mainPrice, cashPrice } = getPriceInfo(product, variant.size);
  const promo = bestPromoForProduct(product, promotions, 'retail', variant.color);
  const finalPrice = getPromotionalPrice(mainPrice, product, promotions, 'retail', variant.color).finalPrice;
  const finalCash = cashPrice != null ? getPromotionalPrice(cashPrice, product, promotions, 'retail', variant.color).finalPrice : null;
  const rebuilt = buildSingleCartItem({
    product: { id: product.id, name: line.name },
    categories: productCategories(product),
    variant: { ...variant, image_url: null } as unknown as Variant,
    finalPrice,
    finalCash,
    mainPrice,
    cashPrice,
    promo,
    fallbackImage: null,
  });

  const matches =
    rebuilt.product_id === line.product_id &&
    rebuilt.variant_id === line.variant_id &&
    rebuilt.unit_price === line.unit_price &&
    rebuilt.unit_price_cash === line.unit_price_cash &&
    rebuilt.unit_price_original === line.unit_price_original &&
    rebuilt.promo_id === line.promo_id &&
    rebuilt.promo_name === line.promo_name &&
    rebuilt.promo_stackable === line.promo_stackable &&
    sameList(rebuilt.categories as string[], line.categories);
  if (!matches || typeof rebuilt.unit_price_cash_original !== 'number') return null;
  return rebuilt.unit_price_cash_original;
}
