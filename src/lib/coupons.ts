import { supabase } from './supabase';
import type { CartItem, StoreType } from './types';

/** Alcance del cupón (mismo criterio que ecommerce_promotions: ids = nombres de
 * categoría o UUIDs de producto, según applies_to). */
export type CouponAppliesTo = 'all' | 'products' | 'categories';
/** Canal habilitado para el cupón. */
export type CouponChannel = 'minorista' | 'mayorista' | 'ambos';

/**
 * Cupón tal como lo devuelve storefront_coupon_lookup: sólo lo necesario para
 * mostrar el descuento. Sin id, usos, vigencia ni descripción (eso lo chequea y se
 * lo guarda el servidor).
 */
export interface CouponRecord {
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_subtotal: number | null;
  // Alcance del descuento: ids = UUIDs de producto o NOMBRES de categoría.
  applies_to?: CouponAppliesTo | null;
  applies_to_ids?: string[] | null;
  // Canal habilitado. undefined/null -> 'ambos'.
  sales_channel?: CouponChannel | null;
}

/** Canal de la tienda actual mapeado al vocabulario del cupón. */
export function channelOfStore(storeType: StoreType): Exclude<CouponChannel, 'ambos'> {
  return storeType === 'wholesale' ? 'mayorista' : 'minorista';
}

/** ¿El cupón alcanza a este item del carrito? (alcance all / productos / categorías). */
export function couponMatchesItem(coupon: CouponRecord, item: CartItem): boolean {
  const scope = coupon.applies_to ?? 'all';
  if (scope === 'all') return true;
  const ids = coupon.applies_to_ids ?? [];
  if (ids.length === 0) return false; // acotado pero sin nada seleccionado -> no aplica
  if (scope === 'products') return ids.includes(item.product_id);
  if (scope === 'categories') {
    const cats = Array.isArray(item.categories) ? item.categories.filter(Boolean) : [];
    return cats.some((c) => ids.includes(c));
  }
  return true;
}

/** Items del carrito alcanzados por el cupón (según su alcance). */
export function eligibleItems(coupon: CouponRecord, items: CartItem[]): CartItem[] {
  const scope = coupon.applies_to ?? 'all';
  if (scope === 'all') return items;
  return items.filter((it) => couponMatchesItem(coupon, it));
}

/** Precio unitario de un item según el modo de pago (contado vs tarjeta/lista). */
function unitPriceForMode(item: CartItem, mode: 'cash' | 'card'): number {
  return mode === 'cash' && typeof item.unit_price_cash === 'number' ? item.unit_price_cash : item.unit_price;
}

/**
 * Subtotal de los items alcanzados por el cupón, en el modo de pago dado. Es la
 * base sobre la que se calcula el descuento cuando el alcance es acotado: los
 * items fuera del alcance se cobran a precio normal.
 */
export function eligibleSubtotal(coupon: CouponRecord, items: CartItem[], mode: 'cash' | 'card'): number {
  return eligibleItems(coupon, items).reduce((s, it) => s + unitPriceForMode(it, mode) * it.qty, 0);
}

/**
 * Monto contra el que se mide la COMPRA MÍNIMA del cupón: TODO el carrito a precio
 * de lista (tarjeta, ya con las promos por cantidad), sin importar el alcance del
 * cupón ni el descuento del medio de pago. Es lo que el comercio tiene en la cabeza
 * al cargar "compra mínima $X" (caso Las Popas 27/10: camisa del cupón + pantalón
 * de otra categoría = $400.000, pero se medía solo la camisa a precio de contado,
 * $160.000, y rebotaba con mínimo $165.000). La RPC create_catalog_order_dedup mide
 * lo mismo con `price_card` de cada item (ver mapItems en orders.ts).
 */
export function minimumBase(items: CartItem[]): number {
  return items.reduce((s, it) => s + it.unit_price * it.qty, 0);
}

/**
 * Calcula el monto descontado para un cupón y un subtotal dados.
 * - percent: subtotal * (discount_value / 100)
 * - fixed:   discount_value
 * Nunca supera el subtotal.
 *
 * El `subtotal` que se pasa debe ser el SUBTOTAL ELEGIBLE (ver eligibleSubtotal)
 * cuando el alcance es acotado, así el descuento sólo se aplica a esos items.
 */
export function computeDiscount(coupon: CouponRecord, subtotal: number): number {
  const raw = coupon.discount_type === 'percent' ? subtotal * (coupon.discount_value / 100) : coupon.discount_value;
  return Math.min(Math.max(0, raw), subtotal);
}

/**
 * Qué respondió el servidor cuando el código no sirve (ver storefront_coupon_lookup).
 * Inexistente, pausado, vencido, no vigente, agotado y de otro canal llegan todos como
 * 'invalido', a propósito: la respuesta pública no revela si el código existe ni qué
 * condición no cumple.
 */
export type CouponLookupReason = 'invalido' | 'demasiados_intentos' | 'error';

export type CouponLookup =
  | { ok: true; coupon: CouponRecord }
  | { ok: false; reason: CouponLookupReason; error: string };

const LOOKUP_MESSAGES: Record<CouponLookupReason, string> = {
  invalido: 'El código no es válido o no está disponible.',
  demasiados_intentos: 'Probaste muchos códigos. Esperá unos minutos y volvé a intentar.',
  error: 'No pudimos validar el cupón. Probá de nuevo.',
};

/**
 * ¿El cupón guardado hay que descartarlo? Sí cuando el servidor dice que no sirve;
 * no cuando el problema es pasajero (red, demasiados intentos): ahí se conserva y
 * se vuelve a consultar en la próxima carga.
 */
export function isPermanentLookupFailure(reason: CouponLookupReason): boolean {
  return reason !== 'error' && reason !== 'demasiados_intentos';
}

/**
 * Consulta UN código exacto de esta tienda (RPC storefront_coupon_lookup). El
 * servidor chequea tienda publicada, existencia, activo, vigencia, tope de usos y
 * canal, con límite de intentos, y devuelve sólo lo necesario para MOSTRAR el
 * descuento. No hay lectura directa de ecommerce_coupons ni búsqueda por patrón.
 *
 * Es sólo para la interfaz: la autoridad es create_catalog_order_dedup, que vuelve
 * a validar y redime el cupón al crear el pedido. El mínimo de compra y el alcance
 * dependen del carrito y se evalúan aparte con evaluateCouponForCart().
 */
export async function lookupCoupon(companyId: string, rawCode: string, storeType: StoreType): Promise<CouponLookup> {
  const code = rawCode.trim();
  if (!code) return { ok: false, reason: 'invalido', error: 'Ingresá un código.' };
  if (!companyId) return { ok: false, reason: 'error', error: LOOKUP_MESSAGES.error };

  const { data, error } = await supabase.rpc('storefront_coupon_lookup', {
    p_company_id: companyId,
    p_code: code,
    p_store_type: storeType === 'wholesale' ? 'wholesale' : 'retail',
  });
  if (error || !data || typeof data !== 'object') {
    if (error) console.error('[coupons] lookupCoupon', error);
    return { ok: false, reason: 'error', error: LOOKUP_MESSAGES.error };
  }
  const r = data as Record<string, unknown>;
  if (r.estado !== 'ok') {
    // Cualquier estado desconocido cuenta como inválido (mensaje genérico).
    const reason: CouponLookupReason =
      r.estado === 'demasiados_intentos' || r.estado === 'error' ? r.estado : 'invalido';
    return { ok: false, reason, error: LOOKUP_MESSAGES[reason] };
  }
  const discountType = r.discount_type === 'fixed' ? 'fixed' : 'percent';
  return {
    ok: true,
    coupon: {
      code: String(r.code ?? code),
      discount_type: discountType,
      discount_value: Number(r.discount_value) || 0,
      min_subtotal: r.min_subtotal == null ? null : Number(r.min_subtotal),
      applies_to: (r.applies_to as CouponAppliesTo | null) ?? 'all',
      applies_to_ids: Array.isArray(r.applies_to_ids) ? (r.applies_to_ids as unknown[]).map(String) : [],
      sales_channel: (r.sales_channel as CouponChannel | null) ?? 'ambos',
    },
  };
}

/** Resultado de evaluar un cupón contra el carrito actual (para el chip tri-estado). */
export interface CouponCartEval {
  /** Canal del cupón compatible con esta tienda. Si es false, el chip se oculta. */
  channelOk: boolean;
  /** Subtotal de los items alcanzados por el cupón (en el modo de pago dado). */
  eligible: number;
  /** Descuento en $ si se aplica (0 si no es aplicable). */
  discount: number;
  /** ¿Se puede aplicar? (canal aparte). */
  applicable: boolean;
  /** Por qué NO es aplicable (si applicable === false). */
  reason?: 'nonstackable' | 'min' | 'scope' | 'nodiscount';
  /** $ que faltan para llegar a la compra mínima (0 si ya se alcanzó). */
  missingForMin: number;
  /** Nombres de los productos alcanzados (vacío si el alcance es 'all'). */
  eligibleNames: string[];
  /** true si alcanza solo a algunos items del carrito (alcance acotado). */
  partial: boolean;
}

/**
 * Evalúa un cupón contra el carrito para el chip tri-estado (disponible / aplicado /
 * no-aplicable). Alinea la regla de mínimo con la RPC server-side: se mide sobre todo
 * el carrito a precio de lista (minimumBase). `hasNonStackablePromo` bloquea el cupón
 * (promo no acumulable).
 */
export function evaluateCouponForCart(
  coupon: CouponRecord,
  items: CartItem[],
  mode: 'cash' | 'card',
  storeType: StoreType,
  hasNonStackablePromo: boolean,
): CouponCartEval {
  const channel = coupon.sales_channel ?? 'ambos';
  const channelOk = channel === 'ambos' || channel === channelOfStore(storeType);

  const scope = coupon.applies_to ?? 'all';
  const matched = eligibleItems(coupon, items);
  const eligible = eligibleSubtotal(coupon, items, mode);
  const eligibleNames = scope === 'all' ? [] : Array.from(new Set(matched.map((it) => it.name)));
  const partial = scope !== 'all' && matched.length > 0 && matched.length < items.length;
  const min = coupon.min_subtotal ?? 0;
  const base = minimumBase(items);
  const missingForMin = Math.max(0, min - base);
  const rawDiscount = Math.round(computeDiscount(coupon, eligible));

  let applicable = true;
  let reason: CouponCartEval['reason'];
  if (hasNonStackablePromo) {
    applicable = false;
    reason = 'nonstackable';
  } else if (scope !== 'all' && matched.length === 0) {
    applicable = false;
    reason = 'scope';
  } else if (min > 0 && base < min) {
    applicable = false;
    reason = 'min';
  } else if (rawDiscount <= 0) {
    applicable = false;
    reason = 'nodiscount';
  }

  return {
    channelOk,
    eligible,
    discount: applicable ? rawDiscount : 0,
    applicable,
    reason,
    missingForMin,
    eligibleNames,
    partial,
  };
}
