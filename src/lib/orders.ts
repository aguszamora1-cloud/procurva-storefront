import { supabase } from './supabase';
import type { CartItem, StoreConfig, StoreType } from './types';

/** Datos del cliente que se cargan en el checkout. */
export interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  address?: string;
  city?: string;
  province?: string;
  zip?: string;
  notes?: string;
}

/**
 * Mapea los items del carrito al formato JSONB que espera `catalog_orders`
 * (el mismo que arma PublicCatalog en procurva2 y que leen tanto
 * create-preference como mp-catalog-webhook).
 */
/** Método de pago elegido en el checkout (etiqueta que se guarda en catalog_orders). */
export type PaymentMethodLabel = 'Transferencia' | 'Efectivo' | 'Tarjeta';

/**
 * Precio unitario según el método: 'cash' (efectivo/transferencia) usa el precio
 * de contado si existe; 'card' (tarjeta) usa el precio de tarjeta (`unit_price`).
 */
function itemPrice(i: CartItem, priceMode: 'cash' | 'card'): number {
  if (priceMode === 'cash' && typeof i.unit_price_cash === 'number') return i.unit_price_cash;
  return i.unit_price;
}

function mapItems(items: CartItem[], priceMode: 'cash' | 'card') {
  return items.map((i) => ({
    name: i.name,
    product_id: i.product_id,
    variant_id: i.variant_id,
    image_url: i.image_url,
    size: i.size,
    color: i.color,
    quantity: i.qty,
    price: itemPrice(i, priceMode),
    // 'suelto' (retail y compra suelta mayorista), 'curva' o 'pack' (mayorista).
    source: i.source ?? 'suelto',
    ...(i.source === 'curva' && i.curves ? { curves: i.curves } : {}),
    ...(i.source === 'pack' ? { pack_id: i.packId, pack_label: i.packLabel, packs: i.packs } : {}),
  }));
}

/**
 * Crea una orden `pending` en `catalog_orders` (misma tabla y estructura que
 * usa el catálogo de ProCurva). El id se genera client-side: anon puede
 * INSERT pero no SELECT bajo RLS, así que NO encadenamos `.select()` y
 * devolvemos el id que generamos nosotros. Devuelve el id de la orden.
 */
export async function createCatalogOrder(
  config: StoreConfig,
  items: CartItem[],
  total: number,
  customer: CustomerInfo,
  paymentMethod: PaymentMethodLabel,
  // Tienda de origen: define el canal de venta (Catálogo Minorista / Mayorista)
  // que las Edge Functions asignan al crear la orden real en el ERP.
  storeType: StoreType,
  opts: {
    // 'cash' (efectivo/transferencia, con descuento de contado) o 'card' (tarjeta).
    priceMode: 'cash' | 'card';
    // true si el pago se cobra online por Mercado Pago. Si es true NO se
    // auto-confirma (create-preference necesita la orden en 'pending').
    viaMercadoPago: boolean;
    // Cupón aplicado (opcional). El `total` que se pasa ya viene con el
    // descuento restado; estos campos son para el desglose y el tracking.
    discount?: {
      coupon_code: string;
      discount_type: 'percent' | 'fixed';
      discount_value: number;
      discount_amount: number;
    } | null;
  },
): Promise<string> {
  const orderId = crypto.randomUUID();

  const hasAddress = Boolean(customer.address);
  const shippingAddress = hasAddress
    ? [customer.address, customer.city, customer.province, customer.zip]
        .filter(Boolean)
        .join(', ')
    : null;

  const orderData = {
    id: orderId,
    company_id: config.companyId,
    customer_name: customer.name,
    customer_phone: customer.phone,
    customer_email: customer.email || null,
    customer_address: customer.address || null,
    customer_city: customer.city || null,
    customer_province: customer.province || null,
    customer_zip: customer.zip || null,
    items: mapItems(items, opts.priceMode),
    total,
    notes: customer.notes || null,
    status: 'pending',
    shipping_method: hasAddress ? 'Envío' : 'Retiro',
    shipping_address: shippingAddress,
    is_pickup: !hasAddress,
    payment_method: paymentMethod,
    store_type: storeType,
    // Descuento por cupón (si hay). create_catalog_order_dedup mapea estas
    // claves a las columnas homónimas de catalog_orders vía jsonb_populate_record.
    ...(opts.discount
      ? {
          coupon_code: opts.discount.coupon_code,
          discount_type: opts.discount.discount_type,
          discount_value: opts.discount.discount_value,
          discount_amount: opts.discount.discount_amount,
        }
      : {}),
  };

  // Insert vía RPC con dedup en DB: si ya entró un pedido idéntico (misma
  // empresa + email + items + total) en los últimos minutos, devuelve el id
  // del existente en vez de duplicar. Defensa contra doble-submit / reintentos
  // de red (anon no tiene SELECT sobre catalog_orders, así que el dedup vive
  // en la función SECURITY DEFINER create_catalog_order_dedup).
  const { data: dedupId, error } = await supabase.rpc('create_catalog_order_dedup', {
    p_order: orderData,
  });
  if (error) {
    console.error('[orders] error creando catalog_order', error);
    throw new Error('No pudimos registrar tu pedido. Probá de nuevo.');
  }
  // id efectivo: el recién creado, o el del existente si hubo dedup.
  const effectiveOrderId = (dedupId as string) || orderId;

  // Auto-confirmación para plan PROFESIONAL: crea la orden real en el ERP al
  // momento de la creación (descuenta stock, registra el movimiento), sin
  // depender del webhook de MercadoPago. Server-side, idempotente y no
  // bloqueante: ante cualquier fallo el pedido queda `pending`.
  //
  // IMPORTANTE: NO se auto-confirma cuando el pago va por Mercado Pago.
  // create-preference exige que la orden esté en 'pending'; si el auto-confirm
  // la pasa a 'confirmed' primero, create-preference responde 400 ("La orden
  // ya fue procesada") y el cliente NO puede pagar. Para MP, la orden real la
  // crea mp-catalog-webhook recién cuando el pago se aprueba (descuenta stock
  // + registra la transacción). El auto-confirm queda para WhatsApp (cobro
  // coordinado, sin pago online que dispare webhook).
  if (!opts.viaMercadoPago) {
    await triggerAutoConfirm(effectiveOrderId);
  }

  return effectiveOrderId;
}

/**
 * Dispara la Edge Function `auto-confirm-catalog-order`. Para empresas en plan
 * PROFESIONAL crea automáticamente la orden real (vía RPC `create_order_atomic`:
 * descuenta stock, registra el movimiento) en el momento de la creación, sin
 * esperar el webhook de MercadoPago — clave para efectivo/transferencia, que
 * nunca disparan webhook.
 *
 * La función chequea el plan del lado del servidor y hace `skip` si no es
 * PROFESIONAL, así que es seguro llamarla siempre. Es idempotente (si el
 * catalog_order ya tiene `linked_order_id` no hace nada), por lo que si después
 * paga por MP, el webhook detecta el pedido vinculado y solo actualiza el
 * estado de pago (no crea una orden duplicada).
 *
 * NO bloquea el checkout: cualquier fallo se loggea y el pedido queda `pending`
 * para que el negocio lo confirme manualmente.
 */
async function triggerAutoConfirm(catalogOrderId: string): Promise<void> {
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  try {
    const res = await fetch(`${baseUrl}/functions/v1/auto-confirm-catalog-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalog_order_id: catalogOrderId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      console.error('[orders] auto-confirm rechazó el pedido', res.status, data);
    } else if (data?.skipped) {
      console.warn('[orders] auto-confirm skipped', data);
    } else {
      console.log('[orders] auto-confirm OK', data);
    }
  } catch (err) {
    console.error('[orders] auto-confirm falló (no bloqueante)', err);
  }
}

/**
 * Llama a la Edge Function `create-preference` (service_role: lee mp_credentials
 * del tenant y arma la preferencia de Checkout Pro). Le pasa `return_base` con
 * el origin del storefront para que MP redirija a /checkout/success|failure|pending
 * de ESTA tienda. Devuelve el `init_point` (URL de pago de MP).
 */
export async function startMercadoPagoCheckout(catalogOrderId: string): Promise<string> {
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/functions/v1/create-preference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      catalog_order_id: catalogOrderId,
      return_base: window.location.origin,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.init_point) {
    console.error('[orders] create-preference falló', res.status, data);
    throw new Error(
      data?.error || 'No pudimos iniciar el pago con MercadoPago. Probá de nuevo o pagá por WhatsApp.',
    );
  }
  return data.init_point as string;
}
