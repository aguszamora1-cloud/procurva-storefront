import { supabase } from './supabase';

/** Cupón tal como vive en `ecommerce_coupons` (las columnas que necesita el checkout). */
export interface CouponRecord {
  id: string;
  code: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  min_purchase: number | null;
  max_uses: number | null;
  used_count: number | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

/** Cupón aplicado en el checkout: el registro + el monto en $ que descuenta. */
export interface AppliedCoupon {
  coupon: CouponRecord;
  discountAmount: number;
}

export type CouponValidation =
  | { ok: true; applied: AppliedCoupon }
  | { ok: false; error: string };

/**
 * Calcula el monto descontado para un cupón y un subtotal dados.
 * - percentage: subtotal * (value / 100)
 * - fixed_amount: value
 * Nunca supera el subtotal.
 */
export function computeDiscount(coupon: CouponRecord, subtotal: number): number {
  const raw = coupon.type === 'percentage' ? subtotal * (coupon.value / 100) : coupon.value;
  return Math.min(Math.max(0, raw), subtotal);
}

/**
 * Valida un cupón contra Supabase para el checkout público (rol anon).
 * Reglas: existe + activo + vigente + no agotado + alcanza la compra mínima.
 * Devuelve el monto a descontar si todo OK.
 */
export async function validateCoupon(
  companyId: string,
  rawCode: string,
  subtotal: number,
): Promise<CouponValidation> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: 'Ingresá un código.' };

  // anon puede leer cupones activos (policy anon_read_active_coupons). Filtramos
  // por empresa + código (case-insensitive) en la query.
  const { data, error } = await supabase
    .from('ecommerce_coupons')
    .select('id, code, type, value, min_purchase, max_uses, used_count, starts_at, expires_at, is_active')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .ilike('code', code)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[coupons] error validando cupón', error);
    return { ok: false, error: 'No pudimos validar el cupón. Probá de nuevo.' };
  }
  const coupon = data as CouponRecord | null;
  if (!coupon) return { ok: false, error: 'El código no es válido.' };

  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    return { ok: false, error: 'El cupón todavía no está vigente.' };
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= now) {
    return { ok: false, error: 'El cupón está vencido.' };
  }
  if (coupon.max_uses != null && (coupon.used_count ?? 0) >= coupon.max_uses) {
    return { ok: false, error: 'El cupón alcanzó su límite de usos.' };
  }
  if (coupon.min_purchase && subtotal < coupon.min_purchase) {
    return {
      ok: false,
      error: `Compra mínima de $${Number(coupon.min_purchase).toLocaleString('es-AR')} para usar este cupón.`,
    };
  }

  const discountAmount = computeDiscount(coupon, subtotal);
  if (discountAmount <= 0) return { ok: false, error: 'El cupón no aplica a este pedido.' };

  return { ok: true, applied: { coupon, discountAmount } };
}

/**
 * Registra el uso de un cupón tras confirmar la compra: incrementa used_count
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
