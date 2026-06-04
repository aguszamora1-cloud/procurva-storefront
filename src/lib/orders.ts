import { supabase } from './supabase';
import type { CartItem, StoreConfig } from './types';

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
function mapItems(items: CartItem[]) {
  return items.map((i) => ({
    name: i.name,
    product_id: i.product_id,
    variant_id: i.variant_id,
    image_url: i.image_url,
    size: i.size,
    color: i.color,
    quantity: i.qty,
    price: i.unit_price,
    source: 'suelto',
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
  paymentMethod: 'MercadoPago' | 'WhatsApp',
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
    items: mapItems(items),
    total,
    notes: customer.notes || null,
    status: 'pending',
    shipping_method: hasAddress ? 'Envío' : 'Retiro',
    shipping_address: shippingAddress,
    is_pickup: !hasAddress,
    payment_method: paymentMethod,
  };

  const { error } = await supabase.from('catalog_orders').insert(orderData);
  if (error) {
    console.error('[orders] error creando catalog_order', error);
    throw new Error('No pudimos registrar tu pedido. Probá de nuevo.');
  }

  return orderId;
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
