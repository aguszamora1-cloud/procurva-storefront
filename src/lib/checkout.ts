import type { CartItem, StoreConfig } from './types';
import type { CustomerInfo } from './orders';
import { formatPrice, whatsappLink } from './utils';

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

  const lines = items.map((i) => {
    const variant = [i.color, i.size].filter(Boolean).join(' / ');
    const variantTxt = variant ? ` (${variant})` : '';
    return `• ${i.qty}x ${i.name}${variantTxt} — ${formatPrice(i.unit_price * i.qty)}`;
  });

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
): string {
  if (!config.whatsapp || items.length === 0) return '';

  const lines = items.map((i) => {
    const variant = [i.color, i.size].filter(Boolean).join(' / ');
    const variantTxt = variant ? ` (${variant})` : '';
    return `• ${i.qty}x ${i.name}${variantTxt} — ${formatPrice(i.unit_price * i.qty)}`;
  });

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
    '',
    'Mis datos:',
    ...datos,
    ...(customer.notes ? ['', `Notas: ${customer.notes}`] : []),
  ].join('\n');

  return whatsappLink(config.whatsapp, message);
}

/** Link de WhatsApp para consultar por un producto puntual. */
export function buildWhatsappInquiry(config: StoreConfig, productName: string): string {
  if (!config.whatsapp) return '';
  const message = `¡Hola ${config.name}! Quería consultar por el producto: ${productName}`;
  return whatsappLink(config.whatsapp, message);
}
