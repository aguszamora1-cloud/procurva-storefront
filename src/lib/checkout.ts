import type { CartItem, StoreConfig } from './types';
import type { CustomerInfo } from './orders';
import { groupCartItems, type CartDisplayRow } from './cart';
import { formatPrice, whatsappLink } from './utils';

/**
 * Desglose compacto de las variantes de una fila agrupada: "S, M, L, XL, XXL"
 * (o "S ×2, M ×2, …" si hay más de una unidad por talle). Con `withColor` cada
 * variante sale como "M/Negro" —packs y escalones mezclan colores; la curva no,
 * porque se agrupa por color y ese color ya va en el encabezado de la línea—.
 * Devuelve '' cuando los items no tienen variante (ej.: la curva surtida, que
 * asigna los colores recién al confirmar el pedido).
 */
function variantBreakdown(items: CartItem[], withColor: boolean): string {
  const counts = new Map<string, number>();
  for (const i of items) {
    const label = withColor ? [i.size, i.color].filter(Boolean).join('/') : (i.size ?? '');
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + i.qty);
  }
  if (counts.size === 0) return '';
  return Array.from(counts, ([label, qty]) => (qty > 1 ? `${label} ×${qty}` : label)).join(', ');
}

/**
 * Una línea de mensaje por fila AGRUPADA del carrito (la misma agrupación que ve
 * el cliente en el carrito y en el resumen del checkout). Sin esto, un pedido
 * mayorista de 5 curvas llegaba como 25 renglones de "1x PRODUCTO (Blanco / S)"
 * y el vendedor no podía leer qué le compraron: ahora dice "Curva completa".
 * `unit` resuelve el precio unitario según el medio de pago elegido.
 */
function orderLine(row: CartDisplayRow, unit: (i: CartItem) => number): string {
  const total = formatPrice(row.items.reduce((s, i) => s + unit(i) * i.qty, 0));
  const first = row.items[0];

  if (row.source === 'suelto') {
    const variant = [first?.color, first?.size].filter(Boolean).join(' / ');
    return `• ${row.units}x ${row.name}${variant ? ` (${variant})` : ''} — ${total}`;
  }

  // Curva: el color es común a toda la fila (se agrupa por producto+color), así
  // que va en el encabezado y el desglose queda sólo con los talles.
  const isCurva = row.source === 'curva';
  const curves = first?.curves ?? 1;
  const head = isCurva && first?.color ? `${row.name} (${first.color})` : row.name;
  const what = isCurva
    ? curves === 1 ? 'Curva completa' : `${curves} curvas completas`
    : row.detail;
  const breakdown = variantBreakdown(row.items, !isCurva);

  const qtyText = breakdown ? `${row.units} u. (${breakdown})` : `${row.units} u.`;
  return `• ${head} — ${[what, qtyText].filter(Boolean).join(' · ')} — ${total}`;
}

/**
 * Fase 1: el checkout es por WhatsApp. Construye un mensaje con el detalle del
 * pedido y devuelve el link de wa.me. Si el tenant no tiene WhatsApp configurado
 * devuelve string vacío (la UI esconde el botón). Fase 2 reemplaza esto por
 * MercadoPago (create-preference + catalog_orders).
 */
export function buildWhatsappOrder(
  config: StoreConfig,
  items: CartItem[],
  subtotal: number,
): string {
  if (!config.whatsapp || items.length === 0) return '';

  const lines = groupCartItems(items).map((row) => orderLine(row, (i) => i.unit_price));

  const message = [
    `¡Hola ${config.name}! Quiero hacer este pedido:`,
    '',
    ...lines,
    '',
    `Total: ${formatPrice(subtotal)}`,
  ].join('\n');

  return whatsappLink(config.whatsapp, message);
}

/**
 * Igual que buildWhatsappOrder pero incluye los datos del cliente cargados en
 * el checkout (nombre, contacto, dirección). Se usa desde la página /checkout
 * cuando el cliente elige "Pagar por WhatsApp".
 */
export function buildWhatsappOrderWithCustomer(
  config: StoreConfig,
  items: CartItem[],
  subtotal: number,
  customer: CustomerInfo,
  // Método de pago elegido: ajusta los precios mostrados (contado vs tarjeta) y
  // se aclara en el mensaje. Default 'Efectivo' (contado).
  // GoCuotas y 'Dinero en cuenta' no llegan por este camino (se redirigen a la
  // pasarela antes), pero el tipo los incluye para aceptar la etiqueta común del
  // checkout. Cuentan como contado (no 'Tarjeta').
  paymentMethod: 'Transferencia' | 'Efectivo' | 'Tarjeta' | 'GoCuotas' | 'Dinero en cuenta' = 'Efectivo',
  // Referencia corta del pedido ya creado (opcional). Si se pasa, se cita en el
  // mensaje; en transferencia además se le pide al cliente que mande el comprobante.
  orderRef?: string,
): string {
  if (!config.whatsapp || items.length === 0) return '';

  const useCash = paymentMethod !== 'Tarjeta';
  const unit = (i: CartItem) =>
    useCash && typeof i.unit_price_cash === 'number' ? i.unit_price_cash : i.unit_price;

  const lines = groupCartItems(items).map((row) => orderLine(row, unit));

  const datos = [
    `Nombre: ${customer.name}`,
    `Tel: ${customer.phone}`,
    customer.email ? `Email: ${customer.email}` : '',
    customer.address
      ? `Dirección: ${[customer.address, customer.city, customer.province, customer.zip].filter(Boolean).join(', ')}`
      : 'Retiro en local',
  ].filter(Boolean);

  const message = [
    `¡Hola ${config.name}! Quiero hacer este pedido:`,
    '',
    ...lines,
    '',
    `Total: ${formatPrice(subtotal)}`,
    `Pago: ${paymentMethod}`,
    ...(orderRef ? [`Pedido: #${orderRef}`] : []),
    '',
    'Mis datos:',
    ...datos,
    ...(customer.notes ? ['', `Notas: ${customer.notes}`] : []),
    ...(orderRef && paymentMethod === 'Transferencia' ? ['', 'Te envío el comprobante de la transferencia.'] : []),
  ].join('\n');

  return whatsappLink(config.whatsapp, message);
}

/** Link de WhatsApp para consultar por un producto puntual. */
export function buildWhatsappInquiry(config: StoreConfig, productName: string): string {
  if (!config.whatsapp) return '';
  const message = `¡Hola ${config.name}! Quería consultar por el producto: ${productName}`;
  return whatsappLink(config.whatsapp, message);
}
