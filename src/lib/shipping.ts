import { supabase } from './supabase';

/** Método de envío normalizado, derivado de companies.settings.shippingMethods. */
export interface ShippingOption {
  id: string;
  name: string;
  /** true si el método necesita dirección (no es retiro en local). */
  requiresAddress: boolean;
  /** Dirección del local (sólo retiro). */
  pickupAddress?: string;
  /** Costo: 0 = gratis, >0 = fijo, null = a coordinar con la tienda. */
  cost: number | null;
  /** Tiempo estimado de entrega (opcional). */
  eta?: string;
  /** Emoji ilustrativo del método. */
  icon: string;
  /** Descripción corta para mostrar bajo el nombre. */
  description: string;
}

function iconFor(isPickup: boolean, type: unknown): string {
  if (isPickup) return '🏪';
  if (type === 'empresa') return '📦';
  return '🚚';
}

function descriptionFor(isPickup: boolean, allowedCities: unknown): string {
  if (isPickup) return 'Retirá sin esperas en nuestro local';
  const cities = Array.isArray(allowedCities) ? allowedCities.filter(Boolean) : [];
  if (cities.length > 0) return cities.join(', ');
  return 'Envío a todo el país';
}

/** Mapea un método crudo (JSONB) a ShippingOption, leyendo costo/tiempo de forma defensiva. */
export function toShippingOption(m: any): ShippingOption {
  const isPickup = m.isPickup === true || m.type === 'retiro';
  const rawCost = m.cost ?? m.price ?? m.shipping_cost;
  const cost = isPickup
    ? typeof rawCost === 'number' ? rawCost : 0
    : typeof rawCost === 'number' ? rawCost : null;
  const rawEta = m.estimatedTime ?? m.eta ?? m.delivery_time ?? m.deliveryTime;
  const eta = typeof rawEta === 'string' && rawEta.trim()
    ? rawEta.trim()
    : isPickup
      ? 'Disponible hoy'
      : undefined;
  return {
    id: String(m.id ?? m.name),
    name: String(m.name ?? 'Envío'),
    requiresAddress: !isPickup,
    pickupAddress: typeof m.pickupAddress === 'string' ? m.pickupAddress : undefined,
    cost,
    eta,
    icon: iconFor(isPickup, m.type),
    description: descriptionFor(isPickup, m.allowedCities),
  };
}

/**
 * Trae los métodos de envío activos del negocio vía la RPC anon-segura
 * `get_catalog_shipping_methods` (lee companies.settings.shippingMethods sanitizado).
 * Lanza si la RPC falla; el caller decide cómo mostrar el error.
 */
export async function fetchShippingOptions(companyId: string): Promise<ShippingOption[]> {
  const { data, error } = await supabase.rpc('get_catalog_shipping_methods', {
    p_company_id: companyId,
  });
  if (error) throw error;
  const raw = Array.isArray(data) ? data : [];
  return raw.filter((m: any) => m && m.isActive !== false).map(toShippingOption);
}

/** Colores del badge de rapidez según el texto del tiempo estimado. */
export function etaBadgeColors(eta: string): { bg: string; color: string } {
  const t = eta.toLowerCase();
  const green = { bg: '#e8f5e9', color: '#2e7d32' };
  const blue = { bg: '#e3f2fd', color: '#1565c0' };
  const gray = { bg: '#f5f5f5', color: '#666' };
  if (t.includes('hoy') || /\b24\s?hs?\b/.test(t) || t.includes('24h')) return green;
  if (t.includes('48') || t.includes('2-3') || t.includes('2 a 3')) return blue;
  return gray;
}
