import { supabase } from './supabase';

/** Identificador del ícono (lucide-react) con que se ilustra el método. */
export type ShippingIconName = 'truck' | 'store' | 'bike' | 'package';

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
  /** Ícono ilustrativo del método (clave de lucide-react). */
  icon: ShippingIconName;
  /** Descripción corta para mostrar bajo el nombre. */
  description: string;
  /** Cubre todo el país: disponible para cualquier CP (transportadoras nacionales). */
  coversAllPostalCodes: boolean;
  /** Rangos de CP cubiertos [desde, hasta]. Vacío = sin restricción (disponible para cualquier CP). */
  postalCodeRanges: [number, number][];
}

/**
 * Parsea el texto de cobertura CP cargado por el negocio ("1000-1499, 1601, 1700-1900")
 * a rangos numéricos. Acepta CPs de 3-4 dígitos. Tokens inválidos se ignoran.
 */
export function parsePostalCodeRanges(raw: unknown): [number, number][] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((tok) => tok.trim())
    .filter(Boolean)
    .flatMap((tok): [number, number][] => {
      const range = tok.match(/(\d{3,4})\s*-\s*(\d{3,4})/);
      if (range) {
        const a = Number(range[1]);
        const b = Number(range[2]);
        return [[Math.min(a, b), Math.max(a, b)]];
      }
      const single = tok.match(/\d{3,4}/);
      if (single) {
        const n = Number(single[0]);
        return [[n, n]];
      }
      return [];
    });
}

/** Extrae el CP numérico de lo ingresado por el cliente (acepta CPA tipo "A4400XYZ" → 4400). */
export function normalizePostalCode(raw: string): number | null {
  const digits = (raw.match(/\d+/g) || []).join('');
  if (!digits) return null;
  const n = Number(digits.slice(0, 4)); // CPA: la zona son los primeros 4 dígitos
  return isNaN(n) ? null : n;
}

/**
 * ¿El método está disponible para el CP dado?
 * Retiro en local y métodos sin restricción → siempre disponibles (compat. hacia atrás).
 */
export function methodCoversPostalCode(m: ShippingOption, cp: number | null): boolean {
  if (!m.requiresAddress) return true; // retiro en local: siempre
  if (m.coversAllPostalCodes) return true; // cubre todo el país
  if (m.postalCodeRanges.length === 0) return true; // sin restricción configurada
  if (cp == null) return false;
  return m.postalCodeRanges.some(([a, b]) => cp >= a && cp <= b);
}

function iconFor(isPickup: boolean, type: unknown): ShippingIconName {
  if (isPickup) return 'store'; // retiro en local
  if (type === 'cadete') return 'bike'; // logística propia
  return 'package';
}

function descriptionFor(isPickup: boolean, allowedCities: unknown): string {
  if (isPickup) return 'Retirá sin esperas en nuestro local';
  const cities = Array.isArray(allowedCities) ? allowedCities.filter(Boolean) : [];
  if (cities.length > 0) return cities.join(', ');
  return 'Envío a todo el país';
}

/** Tiempo estimado declarado por el negocio; para retiro cae a "Disponible hoy". */
function etaFor(m: any, isPickup: boolean): string | undefined {
  const rawEta = m.estimatedTime ?? m.eta ?? m.delivery_time ?? m.deliveryTime;
  if (typeof rawEta === 'string' && rawEta.trim()) return rawEta.trim();
  return isPickup ? 'Disponible hoy' : undefined;
}

/** Lee un costo de variante; si no está definido hereda del costo base. Devuelve null = a coordinar. */
function variantCost(variant: unknown, fallback: unknown): number | null {
  const v = variant !== undefined ? variant : fallback;
  return typeof v === 'number' ? v : null;
}

/** Mapea un método crudo (JSONB) a ShippingOption, leyendo costo/tiempo de forma defensiva. */
export function toShippingOption(m: any): ShippingOption {
  const isPickup = m.isPickup === true || m.type === 'retiro';
  const rawCost = m.cost ?? m.price ?? m.shipping_cost;
  const cost = isPickup
    ? typeof rawCost === 'number' ? rawCost : 0
    : typeof rawCost === 'number' ? rawCost : null;
  return {
    id: String(m.id ?? m.name),
    name: String(m.name ?? 'Envío'),
    requiresAddress: !isPickup,
    pickupAddress: typeof m.pickupAddress === 'string' ? m.pickupAddress : undefined,
    cost,
    eta: etaFor(m, isPickup),
    icon: iconFor(isPickup, m.type),
    description: descriptionFor(isPickup, m.allowedCities),
    coversAllPostalCodes: m.coversAllPostalCodes === true,
    postalCodeRanges: parsePostalCodeRanges(m.postalCodes),
  };
}

/**
 * Expande un método crudo a una o dos ShippingOption.
 * Empresa de transporte (Correo Argentino, Andreani, Vía Cargo, OCA…) → dos
 * modalidades seleccionables con precio independiente: envío a domicilio y retiro
 * en sucursal. El resto de los métodos devuelve una sola opción.
 */
export function expandMethod(m: any): ShippingOption[] {
  const isPickup = m.isPickup === true || m.type === 'retiro';
  if (!isPickup && m.type === 'empresa') {
    const baseId = String(m.id ?? m.name);
    const baseName = String(m.name ?? 'Envío');
    const eta = etaFor(m, false);
    const coversAllPostalCodes = m.coversAllPostalCodes === true;
    const postalCodeRanges = parsePostalCodeRanges(m.postalCodes);
    return [
      {
        id: `${baseId}:domicilio`,
        name: `${baseName} (Envío a domicilio)`,
        requiresAddress: true,
        cost: variantCost(m.homeDeliveryCost, m.cost),
        eta,
        icon: 'truck',
        description: '',
        coversAllPostalCodes,
        postalCodeRanges,
      },
      {
        id: `${baseId}:sucursal`,
        name: `${baseName} (Retiro en sucursal)`,
        requiresAddress: true,
        cost: variantCost(m.branchCost, m.cost),
        eta,
        icon: 'store',
        description: '',
        coversAllPostalCodes,
        postalCodeRanges,
      },
    ];
  }
  return [toShippingOption(m)];
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
  return raw.filter((m: any) => m && m.isActive !== false).flatMap(expandMethod);
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
