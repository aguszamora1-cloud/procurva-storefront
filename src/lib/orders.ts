import { supabase } from './supabase';
import type { CartItem, StoreConfig, StoreType } from './types';

/** Códigos de error de cupón que ahora emite la RPC create_catalog_order_dedup
 * (validación/redención server-side). El checkout los mapea a un texto en español. */
export type CouponErrorCode =
  | 'COUPON_NOT_FOUND'
  | 'COUPON_INACTIVE'
  | 'COUPON_EXPIRED'
  | 'COUPON_NOT_YET_VALID'
  | 'COUPON_EXHAUSTED'
  | 'COUPON_MIN_NOT_MET'
  | 'COUPON_WRONG_CHANNEL'
  | 'COUPON_DISCOUNT_MISMATCH';

/** Error específico de cupón al crear la orden: lleva el código crudo (`COUPON_*`)
 * para que el checkout muestre el mensaje correcto y limpie el cupón aplicado. */
export class CouponError extends Error {
  code: CouponErrorCode;
  constructor(code: CouponErrorCode) {
    super(code);
    this.name = 'CouponError';
    this.code = code;
  }
}

/** Una línea del carrito que se quedó sin stock suficiente. La devuelve la RPC
 * `catalog_cart_stock_shortfalls` y también viaja en el DETAIL del error
 * `STOCK_INSUFICIENTE` que lanza el trigger de `catalog_orders`. */
export interface StockShortfall {
  name: string;
  size: string | null;
  color: string | null;
  requested: number;
  available: number;
}

/** El pedido no se registró porque falta stock. Lleva el detalle de qué faltó
 * para que el checkout lo muestre producto por producto. */
export class StockError extends Error {
  shortfalls: StockShortfall[];
  constructor(shortfalls: StockShortfall[]) {
    super('STOCK_INSUFICIENTE');
    this.name = 'StockError';
    this.shortfalls = shortfalls;
  }
}

/**
 * Revalida el stock del carrito contra `deposit_stock` (la fuente de verdad del
 * ERP, no el cache `product_variants.stock` que lee el catálogo). Devuelve las
 * líneas que no alcanzan, o `[]` si está todo bien.
 *
 * El carrito vive en localStorage sin vencimiento y nunca se revalida, así que un
 * ítem agregado hace días puede llegar al checkout con stock 0. Esto sirve para
 * avisarlo ANTES de que el cliente cargue sus datos; el bloqueo de verdad lo hace
 * el trigger `trg_catalog_orders_assert_stock` al insertar el pedido.
 *
 * Ante cualquier fallo devuelve `[]`: es un aviso temprano, no puede ser el motivo
 * de que alguien no pueda comprar.
 */
export async function checkCartStock(
  companyId: string,
  items: CartItem[],
  priceMode: 'cash' | 'card',
): Promise<StockShortfall[]> {
  try {
    const { data, error } = await supabase.rpc('catalog_cart_stock_shortfalls', {
      p_company_id: companyId,
      p_items: mapItems(items, priceMode),
    });
    if (error) {
      console.error('[orders] no se pudo revalidar el stock', error);
      return [];
    }
    return Array.isArray(data) ? (data as StockShortfall[]) : [];
  } catch (e) {
    console.error('[orders] no se pudo revalidar el stock', e);
    return [];
  }
}

/**
 * Desglose de precio completo del pedido. El checkout ya calcula todos estos
 * números (subtotal de lista, ahorro por promo, ahorro por contado, cupón,
 * envío, total); los estampamos como un objeto para que el ERP muestre SIEMPRE
 * el desglose en el detalle de la venta (promo + tarjeta/contado + cupón + envío),
 * en vez de que el descuento quede horneado invisible dentro del precio de línea.
 * Viaja: catalog_orders.price_breakdown -> orders.meta.price_breakdown.
 *
 * Invariante: list_subtotal - promo_discount - payment_discount - coupon_discount
 *             + surcharge + shipping == total
 */
export interface PriceBreakdownItem {
  product_id: string;
  variant_id: string | null;
  size?: string | null;
  color?: string | null;
  name: string;
  quantity: number;
  /** Precio unitario de lista/tarjeta (pre-promo, pre-contado). */
  price_list: number;
  /** Precio unitario efectivamente cobrado (post-promo, en el modo elegido). */
  price_final: number;
  promo_name?: string | null;
}
export interface PriceBreakdown {
  source: 'storefront';
  list_subtotal: number;
  promo_discount: number;
  promo_name: string | null;
  payment_discount: number;
  payment_discount_pct: number;
  payment_method: string;
  coupon_discount: number;
  coupon_code: string | null;
  shipping: number;
  surcharge: number;
  total: number;
  items: PriceBreakdownItem[];
}

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
  // Horario en que el cliente puede recibir (envío) o retirar (pickup) el pedido.
  // Texto libre, obligatorio en el checkout. Se propaga a meta.shipping_time_range
  // en la orden real, que es de donde lo lee el detalle de venta del ERP.
  deliveryTime?: string;
}

/**
 * Mapea los items del carrito al formato JSONB que espera `catalog_orders`
 * (el mismo que arma PublicCatalog en procurva2 y que leen tanto
 * create-preference como mp-catalog-webhook).
 */
/** Método de pago elegido en el checkout (etiqueta que se guarda en catalog_orders). */
export type PaymentMethodLabel = 'Transferencia' | 'Efectivo' | 'Tarjeta' | 'GoCuotas' | 'Dinero en cuenta';

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
    // Curva surtida: sin variante (la asigna el server al confirmar).
    variant_id: i.source === 'curva_surtida' ? null : i.variant_id,
    image_url: i.image_url,
    size: i.size,
    color: i.color,
    quantity: i.qty,
    price: itemPrice(i, priceMode),
    // 'suelto' (retail y compra suelta mayorista), 'curva', 'curva_surtida' o 'pack'.
    source: i.source ?? 'suelto',
    ...((i.source === 'curva' || i.source === 'curva_surtida') && i.curves ? { curves: i.curves } : {}),
    // Curva surtida: el server explota las variantes al confirmar; le pasamos el
    // precio por unidad del tier para que cada variante lleve ese precio.
    ...(i.source === 'curva_surtida' ? { curve_price_per_unit: i.curve_price_per_unit ?? itemPrice(i, priceMode) } : {}),
    ...(i.source === 'pack' ? { pack_id: i.packId, pack_label: i.packLabel, packs: i.packs } : {}),
    // Promoción automática aplicada (si la hubo). `price` ya viene con el
    // descuento; estos campos quedan en catalog_orders.items para trackear
    // ventas por promo en el dashboard de marketing (sin migración).
    ...(i.promo_id
      ? { promotion_id: i.promo_id, promotion_name: i.promo_name, price_original: i.unit_price_original }
      : {}),
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
    // Monto de envío que el cliente pagó (0 en retiro). Ya está sumado dentro de
    // `total`, pero lo persistimos aparte para que las Edge Functions de promoción
    // lo copien a orders.meta.shippingCostCustomer y el desglose de la venta lo
    // muestre como "Envío cobrado al cliente" (pass-through, no infla la ganancia).
    shippingCost?: number;
    // true si el pago se cobra online por una pasarela (Mercado Pago o GoCuotas).
    // Si es true NO se auto-confirma: la pasarela exige la orden en 'pending' y
    // la venta real la crea su propio webhook recién al aprobarse el pago (si el
    // cliente abandona el checkout, nunca se genera la venta).
    viaMercadoPago: boolean;
    // Transferencia bancaria directa (con alias/CBU cargado). Se trata igual que
    // efectivo: SÍ se auto-confirma al confirmar el pedido — cae al listado de
    // ventas como Pendiente (Por cobrar) y el comercio marca el pago cuando llega
    // el comprobante. (Se conserva la flag por trazabilidad; ya no altera el gate.)
    manualTransfer?: boolean;
    // Cupón aplicado (opcional). El `total` que se pasa ya viene con el
    // descuento restado; estos campos son para el desglose y el tracking.
    discount?: {
      coupon_code: string;
      discount_type: 'percent' | 'fixed';
      discount_value: number;
      discount_amount: number;
    } | null;
    // Desglose de precio completo para que el ERP lo muestre en el detalle de la
    // venta. Se persiste en catalog_orders.price_breakdown y la edge fn lo copia
    // a orders.meta.price_breakdown.
    priceBreakdown?: PriceBreakdown | null;
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
    // Envío cobrado al cliente (ya incluido en `total`). Se guarda aparte para el
    // desglose de la venta; create_catalog_order_dedup lo mapea a la columna homónima.
    shipping_cost: opts.shippingCost ?? 0,
    notes: customer.notes || null,
    delivery_time_range: customer.deliveryTime?.trim() || null,
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
    // Desglose de precio: create_catalog_order_dedup lo mapea a la columna
    // homónima de catalog_orders (jsonb_populate_record). Si falta la columna en
    // una base sin migrar, jsonb_populate_record simplemente lo descarta (no rompe).
    ...(opts.priceBreakdown ? { price_breakdown: opts.priceBreakdown } : {}),
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
    // La RPC ahora valida y redime el cupón server-side: puede fallar con un
    // código COUPON_* (RAISE EXCEPTION). Lo detectamos en el mensaje del error
    // de Postgres y lo re-lanzamos tipado para que el checkout lo humanice y
    // limpie el cupón. Cualquier otro error cae al genérico de abajo.
    const couponCode = String(error.message || '').match(/COUPON_[A-Z_]+/)?.[0];
    if (couponCode) {
      throw new CouponError(couponCode as CouponErrorCode);
    }
    // Falta stock: lo bloquea el trigger trg_catalog_orders_assert_stock. El
    // detalle de qué líneas fallaron viene en `details` (el DETAIL del RAISE),
    // así no hay que parsear el mensaje.
    if (/STOCK_INSUFICIENTE/.test(String(error.message || '')) || /STOCK_INSUFICIENTE/.test(String(error.hint || ''))) {
      let shortfalls: StockShortfall[] = [];
      try {
        const parsed = JSON.parse(String(error.details || '[]'));
        if (Array.isArray(parsed)) shortfalls = parsed as StockShortfall[];
      } catch {
        /* sin detalle: igual bloqueamos, con el mensaje genérico */
      }
      throw new StockError(shortfalls);
    }
    console.error('[orders] error creando catalog_order', error);
    throw new Error('No pudimos registrar tu pedido. Probá de nuevo.');
  }
  // id efectivo: el recién creado, o el del existente si hubo dedup.
  const effectiveOrderId = (dedupId as string) || orderId;

  // Auto-confirmación para plan PROFESIONAL: crea la orden real en el ERP al
  // momento de la creación (descuenta stock, registra el movimiento), sin
  // depender de un webhook. Server-side, idempotente y no bloqueante: ante
  // cualquier fallo el pedido queda `pending`.
  //
  // Se auto-confirma para EFECTIVO y TRANSFERENCIA: son ventas comprometidas
  // (el cobro se coordina/verifica fuera de línea), así que caen al listado de
  // ventas al instante como Pendiente (Por cobrar) y el comercio marca el pago
  // cuando llega. `viaMercadoPago` es false para todos estos (routing 'wa').
  //
  // NO se auto-confirma cuando el pago va por una pasarela online (Mercado Pago
  // o GoCuotas). Dos motivos: (1) create-preference exige la orden en 'pending'
  // — si se pasara a 'confirmed' antes, responde 400 y el cliente no puede
  // pagar; (2) si el cliente abandona el checkout, NO debe generarse la venta.
  // Para esos casos la orden real la crea el webhook recién al aprobarse el pago.
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
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  try {
    const res = await fetch(`${baseUrl}/functions/v1/auto-confirm-catalog-order`, {
      method: 'POST',
      // El gateway de Edge Functions rechaza la llamada con 401
      // (UNAUTHORIZED_NO_AUTH_HEADER) si no mandamos la apikey/Authorization,
      // y el catch de abajo lo tragaba en silencio: el pedido quedaba `pending`
      // y nunca se creaba la orden real. La anon key alcanza (la función usa el
      // service_role internamente y valida plan/empresa del lado del servidor).
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
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
 * Extrae un mensaje legible del error crudo que devuelve la API de MercadoPago.
 * `detail` puede ser un string JSON (`{"message":"...","cause":[{"description":"..."}]}`)
 * o texto plano. Devuelve null si no hay nada útil.
 */
function extractMpError(detail: unknown): string | null {
  if (!detail || typeof detail !== 'string') return null;
  try {
    const j = JSON.parse(detail);
    const cause = Array.isArray(j?.cause) && j.cause.length
      ? j.cause.map((c: any) => c?.description || c?.code).filter(Boolean).join(' · ')
      : '';
    const msg = cause || j?.message || j?.error || '';
    return msg ? `MercadoPago: ${msg}` : null;
  } catch {
    return detail.length > 200 ? null : `MercadoPago: ${detail}`;
  }
}

/**
 * Llama a la Edge Function `create-preference` (service_role: lee mp_credentials
 * del tenant y arma la preferencia de Checkout Pro). Le pasa `return_base` con
 * el origin del storefront para que MP redirija a /checkout/success|failure|pending
 * de ESTA tienda. Devuelve el `init_point` (URL de pago de MP).
 *
 * `onlyAccountMoney`: si es true, la preferencia se restringe a "dinero en cuenta"
 * (saldo de Mercado Pago) excluyendo tarjetas/efectivo. Se usa para el medio
 * "Dinero en cuenta", que cobra a precio de contado y por eso NO debe permitir
 * pagar con tarjeta (se estaría dando el precio de contado a quien paga en cuotas).
 */
export async function startMercadoPagoCheckout(
  catalogOrderId: string,
  onlyAccountMoney = false,
): Promise<string> {
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/functions/v1/create-preference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      catalog_order_id: catalogOrderId,
      return_base: window.location.origin,
      only_account_money: onlyAccountMoney,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.init_point) {
    console.error('[orders] create-preference falló', res.status, data);
    // `detail` trae el error crudo de la API de MercadoPago (lo que de verdad
    // está fallando). Lo mostramos para que el problema sea accionable en vez
    // del genérico "No pudimos iniciar el pago".
    const mpMsg = extractMpError(data?.detail);
    throw new Error(
      mpMsg ||
        data?.error ||
        'No pudimos iniciar el pago con MercadoPago. Probá de nuevo o pagá por WhatsApp.',
    );
  }
  return data.init_point as string;
}

/**
 * Llama a la Edge Function `gocuotas-checkout` (service_role: lee
 * gocuotas_credentials del tenant, se autentica con GoCuotas y crea el checkout).
 * Le pasa `return_base` con el origin del storefront para las URLs de retorno
 * (/checkout/success|failure de ESTA tienda). Devuelve la `url_init` (URL de pago
 * de GoCuotas). Como create-preference, exige la orden en 'pending' (por eso
 * createCatalogOrder NO auto-confirma cuando el pago va por una pasarela online).
 */
export async function startGoCuotasCheckout(catalogOrderId: string): Promise<string> {
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/functions/v1/gocuotas-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      catalog_order_id: catalogOrderId,
      return_base: window.location.origin,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url_init) {
    console.error('[orders] gocuotas-checkout falló', res.status, data);
    throw new Error(
      data?.error ||
        'No pudimos iniciar el pago con GoCuotas. Probá de nuevo o elegí otro medio de pago.',
    );
  }
  return data.url_init as string;
}
