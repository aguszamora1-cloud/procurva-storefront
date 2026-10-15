// Página propia de cada promoción (/promo/:slug) y sus links en el menú.
//
// Archivo aparte de promotions.ts A PROPÓSITO: aquél es el motor de precios y
// tiene copias en el ERP (lib/promotions.ts) y en la vista SQL del detector de
// diferencias. Acá sólo se decide QUÉ productos listar y CÓMO nombrar la promo;
// ningún precio se calcula en este archivo.
//
// El slug NO se guarda en la base (no hay columna): se deriva del nombre + los
// primeros 8 caracteres del id. Así no hace falta migración, renombrar la promo
// no rompe los links viejos (se resuelve por el id) y dos promos con el mismo
// nombre no chocan.

import type { Product, StoreType } from './types';
import { formatMoney } from './regional';
import {
  isQuantityPromo,
  parsePromoColorItemId,
  promoAppliesToProduct,
  promoDiscountValue,
  quantityPromoMessage,
  type Promotion,
} from './promotions';

const ID_LEN = 8;

/** Texto -> segmento de URL legible (sin acentos ni símbolos). */
function slugify(v: string): string {
  return v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/** Slug de la promo: "llevate-5-paga-4-1a2b3c4d". */
export function promoSlug(promo: Pick<Promotion, 'id' | 'name'>): string {
  const base = slugify(promo.name ?? '');
  const id = promo.id.slice(0, ID_LEN);
  return base ? `${base}-${id}` : id;
}

/** Ruta interna de la página de la promo. */
export const promoPath = (promo: Pick<Promotion, 'id' | 'name'>): string => `/promo/${promoSlug(promo)}`;

/**
 * Promo a la que apunta un slug, entre las VIGENTES que cargó el provider. Se
 * resuelve por el id (lo que va después del último guión), no por el nombre.
 * null = no existe, venció, todavía no empezó o la desactivaron.
 */
export function findPromoBySlug(promotions: Promotion[], slug: string): Promotion | null {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  const idPart = clean.slice(clean.lastIndexOf('-') + 1);
  return (
    promotions.find((p) => p.id.toLowerCase() === clean) ??
    (idPart.length === ID_LEN ? promotions.find((p) => p.id.toLowerCase().startsWith(idPart)) : undefined) ??
    null
  );
}

/** ¿La promo descuenta algo en esta tienda? (canal y valor > 0). */
export const promoVisibleIn = (promo: Promotion, storeType: StoreType): boolean =>
  promoDiscountValue(promo, storeType) > 0;

/**
 * ¿El producto va en la grilla de la promo?
 *
 * Difiere de promoAppliesToProduct en un punto: una promo acotada a colores
 * SÍ lista el producto (sin color en contexto el motor la descarta, y con razón
 * para el PRECIO). La card agrupada ya avisa "30% OFF en Rojo" sola.
 */
export function productInPromo(promo: Promotion, product: Product, storeType: StoreType): boolean {
  if (promo.scope !== 'products') return promoAppliesToProduct(promo, product, storeType);
  return (promo.ecommerce_promotion_items ?? []).some((i) => {
    if (i.item_type === 'product') return i.item_id === product.id;
    if (i.item_type !== 'product_color' || storeType === 'wholesale') return false;
    return parsePromoColorItemId(i.item_id)?.productId === product.id;
  });
}

/** Frase corta de la promo para el encabezado: "20% OFF", "Llevá 5 y …". */
export function promoHeadline(promo: Promotion, storeType: StoreType): string {
  if (isQuantityPromo(promo)) return quantityPromoMessage(promo, storeType);
  const v = promoDiscountValue(promo, storeType);
  return promo.discount_type === 'fixed' ? `${formatMoney(Math.round(v))} OFF` : `${v}% OFF`;
}
