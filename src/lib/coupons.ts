import { supabase } from './supabase';
import type { CartItem, StoreType } from './types';

/** Alcance del cupón (mismo criterio que ecommerce_promotions: ids = nombres de
 * categoría o UUIDs de producto, según applies_to). */
export type CouponAppliesTo = 'all' | 'products' | 'categories';
/** Canal habilitado para el cupón. */
export type CouponChannel = 'minorista' | 'mayorista' | 'ambos';

/** Cupón tal como vive en `ecommerce_coupons` (las columnas que necesita el checkout). */
export interface CouponRecord {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_subtotal: number | null;
  max_uses: number | null;
  current_uses: number | null;
  valid_from: string | null;
  valid_until: string | null;
  active: boolean;
  // Alcance del descuento. Cupones viejos sin la columna llegan como undefined
  // -> se tratan como 'all'.
  applies_to?: CouponAppliesTo | null;
  // IDs del alcance: UUIDs de producto o NOMBRES de categoría. Puede venir null.
  applies_to_ids?: string[] | null;
  // Canal habilitado. undefined/null -> 'ambos'.
  sales_channel?: CouponChannel | null;
}

/** Cupón aplicado en el checkout: el registro + el monto en $ que descuenta. */
export interface AppliedCoupon {
  coupon: CouponRecord;
  discountAmount: number;
  // true si el cupón sólo alcanza a algunos productos del carrito (alcance acotado).
  partial: boolean;
  // Nombres de los productos del carrito a los que se les aplicó el descuento
  // (para mostrar el desglose). Vacío cuando el alcance es 'all'.
  eligibleNames: string[];
}

export type CouponValidation =
  | { ok: true; applied: AppliedCoupon }
  | { ok: false; error: string };

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

/** Contexto del carrito necesario para validar alcance y canal del cupón. */
export interface CouponContext {
  /** Tipo de tienda actual (para el canal habilitado del cupón). */
  storeType: StoreType;
  /** Items del carrito (con precios y categorías) para el alcance acotado. */
  items: CartItem[];
  /** Modo de pago vigente: define qué precio unitario usa el subtotal elegible. */
  mode: 'cash' | 'card';
}

/**
 * Valida un cupón contra Supabase para el checkout público (rol anon).
 * Reglas: existe + activo + vigente + no agotado + alcanza la compra mínima +
 * el canal coincide + el alcance toca al menos un item del carrito.
 * El descuento se calcula sobre el SUBTOTAL ELEGIBLE (sólo los items alcanzados).
 */
export async function validateCoupon(
  companyId: string,
  rawCode: string,
  subtotal: number,
  ctx: CouponContext,
): Promise<CouponValidation> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: 'Ingresá un código.' };

  // anon puede leer cupones activos (policy anon_read_active_coupons). Filtramos
  // por empresa + código (case-insensitive) en la query.
  const { data, error } = await supabase
    .from('ecommerce_coupons')
    .select('id, code, discount_type, discount_value, min_subtotal, max_uses, current_uses, valid_from, valid_until, active, applies_to, applies_to_ids, sales_channel')
    .eq('company_id', companyId)
    .eq('active', true)
    .ilike('code', code)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[coupons] error validando cupón', error);
    return { ok: false, error: 'No pudimos validar el cupón. Probá de nuevo.' };
  }
  const coupon = data as CouponRecord | null;
  if (!coupon) return { ok: false, error: 'El código no es válido.' };

  // Canal: si el cupón es exclusivo de un canal, debe coincidir con esta tienda.
  const channel = coupon.sales_channel ?? 'ambos';
  if (channel !== 'ambos' && channel !== channelOfStore(ctx.storeType)) {
    return { ok: false, error: 'Este cupón no es válido para esta tienda.' };
  }

  const now = Date.now();
  if (coupon.valid_from && new Date(coupon.valid_from).getTime() > now) {
    return { ok: false, error: 'El cupón todavía no está vigente.' };
  }
  if (coupon.valid_until && new Date(coupon.valid_until).getTime() <= now) {
    return { ok: false, error: 'El cupón está vencido.' };
  }
  if (coupon.max_uses != null && (coupon.current_uses ?? 0) >= coupon.max_uses) {
    return { ok: false, error: 'El cupón alcanzó su límite de usos.' };
  }
  // La compra mínima se evalúa sobre el subtotal total del pedido.
  if (coupon.min_subtotal && subtotal < coupon.min_subtotal) {
    return {
      ok: false,
      error: `Compra mínima de $${Number(coupon.min_subtotal).toLocaleString('es-AR')} para usar este cupón.`,
    };
  }

  // Alcance: items del carrito alcanzados por el cupón y su subtotal.
  const matched = eligibleItems(coupon, ctx.items);
  const scope = coupon.applies_to ?? 'all';
  if (scope !== 'all' && matched.length === 0) {
    return {
      ok: false,
      error: scope === 'categories'
        ? 'El cupón no aplica a ningún producto de tu carrito (categorías no incluidas).'
        : 'El cupón no aplica a ningún producto de tu carrito.',
    };
  }

  const elig = eligibleSubtotal(coupon, ctx.items, ctx.mode);
  const discountAmount = computeDiscount(coupon, elig);
  if (discountAmount <= 0) return { ok: false, error: 'El cupón no aplica a este pedido.' };

  const partial = scope !== 'all' && matched.length < ctx.items.length;
  // Nombres únicos de los productos alcanzados (para el desglose en el checkout).
  const eligibleNames = scope === 'all' ? [] : Array.from(new Set(matched.map((it) => it.name)));

  return { ok: true, applied: { coupon, discountAmount, partial, eligibleNames } };
}

/**
 * Registra el uso de un cupón tras confirmar la compra: incrementa current_uses
 * (vía RPC SECURITY DEFINER, porque anon no tiene UPDATE) e inserta la fila de
 * tracking en ecommerce_coupon_uses. No bloquea el checkout: cualquier fallo se
 * loggea y sigue (el pedido ya quedó registrado con el descuento).
 */
export async function registerCouponUse(
  couponId: string,
  orderId: string,
  discountAmount: number,
): Promise<void> {
  try {
    await supabase.rpc('increment_coupon_use', { p_coupon_id: couponId });
    await supabase.from('ecommerce_coupon_uses').insert({
      coupon_id: couponId,
      order_id: orderId,
      discount_amount: discountAmount,
    });
  } catch (err) {
    console.error('[coupons] no se pudo registrar el uso del cupón (no bloqueante)', err);
  }
}
