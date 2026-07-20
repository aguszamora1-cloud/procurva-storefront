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
  _subtotal: number,
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

  // Alcance: items del carrito alcanzados por el cupón y su subtotal elegible.
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

  // La compra mínima se evalúa sobre el SUBTOTAL ELEGIBLE (los items que matchean
  // el alcance del cupón), igual que la RPC create_catalog_order_dedup server-side.
  // Así el cliente nunca muestra un descuento que el servidor va a rechazar.
  if (coupon.min_subtotal && elig < coupon.min_subtotal) {
    return {
      ok: false,
      error: `Compra mínima de $${Number(coupon.min_subtotal).toLocaleString('es-AR')} para usar este cupón.`,
    };
  }

  const discountAmount = computeDiscount(coupon, elig);
  if (discountAmount <= 0) return { ok: false, error: 'El cupón no aplica a este pedido.' };

  const partial = scope !== 'all' && matched.length < ctx.items.length;
  // Nombres únicos de los productos alcanzados (para el desglose en el checkout).
  const eligibleNames = scope === 'all' ? [] : Array.from(new Set(matched.map((it) => it.name)));

  return { ok: true, applied: { coupon, discountAmount, partial, eligibleNames } };
}

// NOTA: la validación de este cupón es solo para MOSTRAR el descuento (UX). La
// redención REAL (incrementar current_uses + insertar en ecommerce_coupon_uses)
// ahora ocurre server-side, dentro de la RPC create_catalog_order_dedup, en la
// misma transacción que inserta el pedido. Esto cierra el agujero de gastar un
// cupón max_uses:1 abriendo pestañas en paralelo. La antigua registerCouponUse()
// (client-side, post-orden, sin atomicidad) se eliminó; la RPC increment_coupon_use
// quedó huérfana y puede dropearse en una limpieza futura.

/**
 * Trae el registro crudo de un cupón por código (case-insensitive), solo activos.
 * NO valida contra el carrito: es la lectura que usa el store del cupón guardado
 * (CouponContext) para tener los datos del cupón sin depender del carrito.
 */
export async function fetchCoupon(companyId: string, rawCode: string): Promise<CouponRecord | null> {
  const code = rawCode.trim();
  if (!code) return null;
  const { data, error } = await supabase
    .from('ecommerce_coupons')
    .select('id, code, discount_type, discount_value, min_subtotal, max_uses, current_uses, valid_from, valid_until, active, applies_to, applies_to_ids, sales_channel')
    .eq('company_id', companyId)
    .eq('active', true)
    .ilike('code', code)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[coupons] fetchCoupon', error);
    return null;
  }
  return (data as CouponRecord | null) ?? null;
}

/**
 * Validez CART-INDEPENDIENTE de un cupón: canal + vigencia + tope de usos. Es lo
 * que se puede chequear sin carrito (para guardar el cupón, magic link, revalidar
 * el guardado). El mínimo de compra y el alcance dependen del carrito y se evalúan
 * aparte con evaluateCouponForCart().
 */
export function couponBasicValidity(coupon: CouponRecord, storeType: StoreType): { ok: boolean; error?: string } {
  const channel = coupon.sales_channel ?? 'ambos';
  if (channel !== 'ambos' && channel !== channelOfStore(storeType)) {
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
  return { ok: true };
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
 * no-aplicable). Alinea la regla de mínimo con la RPC server-side: se mide sobre el
 * subtotal ELEGIBLE. `hasNonStackablePromo` bloquea el cupón (promo no acumulable).
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
  const missingForMin = Math.max(0, min - eligible);
  const rawDiscount = Math.round(computeDiscount(coupon, eligible));

  let applicable = true;
  let reason: CouponCartEval['reason'];
  if (hasNonStackablePromo) {
    applicable = false;
    reason = 'nonstackable';
  } else if (scope !== 'all' && matched.length === 0) {
    applicable = false;
    reason = 'scope';
  } else if (min > 0 && eligible < min) {
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
