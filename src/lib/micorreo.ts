import { supabase } from './supabase';
import { normalizePostalCode, type ShippingOption } from './shipping';

/**
 * Cliente de la Edge Function `micorreo` (API MiCorreo de Correo Argentino) para
 * la tienda pública. La función corre con las credenciales MiCorreo del comercio
 * del lado del servidor; acá sólo mandamos empresa + CP + carrito y recibimos
 * tarifas y sucursales. El peso y las medidas los calcula el servidor desde los
 * productos, así que el cliente no puede abaratarse el envío mandando otro peso.
 */

/** Una tarifa cotizada. D = a domicilio, S = retiro en sucursal. CP = clásico, EP = expreso. */
export interface CorreoRate {
  deliveredType: 'D' | 'S';
  productType: 'CP' | 'EP' | string;
  productName: string;
  price: number;
  deliveryTimeMin: string | null;
  deliveryTimeMax: string | null;
}

export interface CorreoRatesResponse {
  rates: CorreoRate[];
  validTo?: string | null;
  missingData?: unknown;
  origin?: unknown;
  destination?: unknown;
}

export interface CorreoAgencyAddress {
  streetName: string | null;
  streetNumber: string | null;
  locality: string | null;
  city: string | null;
  province: string | null;
  provinceCode: string | null;
  postalCode: string | null;
}

/** Sucursal de Correo Argentino habilitada para retiro. */
export interface CorreoAgency {
  code: string;
  name: string;
  address: CorreoAgencyAddress | null;
  hours: unknown;
  phone: string | null;
}

export interface CorreoAgenciesResponse {
  provinceCode: string | null;
  agencies: CorreoAgency[];
}

/** Línea del carrito tal como la pide la función: producto + unidades. */
export interface CorreoItem {
  product_id: string;
  quantity: number;
}

/** Error de la Edge Function, con el `code` que devuelve (not_connected, invalid_postal_code…). */
export class MiCorreoError extends Error {
  code: string | null;
  status: number | null;
  constructor(message: string, code: string | null, status: number | null) {
    super(message);
    this.name = 'MiCorreoError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Invoca la función y normaliza el error. Ante un status no-2xx el SDK devuelve
 * `error` (FunctionsHttpError) SIN leer el body: el `{ error, code }` real queda
 * en `error.context`, que es la Response cruda.
 */
async function invokeMiCorreo<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('micorreo', { body });
  if (error) {
    let message = error.message || 'Error consultando MiCorreo';
    let code: string | null = null;
    let status: number | null = null;
    const ctx = (error as { context?: unknown }).context;
    if (ctx && typeof (ctx as Response).json === 'function') {
      status = typeof (ctx as Response).status === 'number' ? (ctx as Response).status : null;
      try {
        const payload = await (ctx as Response).json();
        if (payload?.error) message = String(payload.error);
        if (payload?.code) code = String(payload.code);
      } catch {
        /* body sin JSON (o ya leído): nos quedamos con el mensaje del SDK */
      }
    }
    throw new MiCorreoError(message, code, status);
  }
  // Por las dudas: un 200 con { error } también es un error.
  if (data && typeof data === 'object' && (data as { error?: unknown }).error) {
    const d = data as { error: unknown; code?: unknown };
    throw new MiCorreoError(String(d.error), d.code ? String(d.code) : null, 200);
  }
  return data as T;
}

/** Agrupa por producto y ordena: la misma compra da la misma clave de caché. */
function normalizeItems(items: CorreoItem[]): CorreoItem[] {
  const byProduct = new Map<string, number>();
  for (const it of items) {
    if (!it?.product_id) continue;
    const qty = Math.max(0, Math.round(Number(it.quantity) || 0));
    if (qty <= 0) continue;
    byProduct.set(it.product_id, (byProduct.get(it.product_id) ?? 0) + qty);
  }
  return Array.from(byProduct, ([product_id, quantity]) => ({ product_id, quantity })).sort((a, b) =>
    a.product_id.localeCompare(b.product_id),
  );
}

/** CP que mandamos a cotizar: los 4 dígitos de zona (acepta CPA "S2000ABC"). null si no es válido. */
export function correoPostalCode(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const n = normalizePostalCode(raw);
  // Los CP argentinos son de 4 dígitos (1000–9431). Con 3 dígitos es alguien a
  // mitad de tipear: no gastamos una cotización en eso.
  if (n == null || n < 1000 || n > 9999) return null;
  return String(n);
}

/** Clave de caché/cotización para empresa + CP + carrito. null = no hay nada que cotizar. */
export function correoRatesKey(companyId: string, postalCode: string | null, items: CorreoItem[]): string | null {
  const cp = correoPostalCode(postalCode);
  const norm = normalizeItems(items);
  if (!companyId || !cp || norm.length === 0) return null;
  return `${companyId}|${cp}|${norm.map((i) => `${i.product_id}x${i.quantity}`).join(',')}`;
}

// Caché en memoria (vive lo que vive la pestaña). Guardamos la PROMESA para que
// la ficha y el checkout pidiendo lo mismo al mismo tiempo compartan una sola
// llamada. Si falla se borra, así el próximo intento vuelve a probar.
const CACHE_TTL_MS = 10 * 60 * 1000;
const ratesCache = new Map<string, { at: number; promise: Promise<CorreoRatesResponse> }>();
const agenciesCache = new Map<string, { at: number; promise: Promise<CorreoAgenciesResponse> }>();

function cached<T>(
  cache: Map<string, { at: number; promise: Promise<T> }>,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = load();
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
  });
  return promise;
}

/** Cotiza el envío del carrito al CP dado. Lanza MiCorreoError si la función falla. */
export function fetchCorreoRates(
  companyId: string,
  postalCode: string,
  items: CorreoItem[],
): Promise<CorreoRatesResponse> {
  const key = correoRatesKey(companyId, postalCode, items);
  if (!key) return Promise.reject(new MiCorreoError('Faltan CP o productos para cotizar', 'invalid_request', null));
  const cp = correoPostalCode(postalCode) as string;
  const norm = normalizeItems(items);
  return cached(ratesCache, key, async () => {
    const res = await invokeMiCorreo<CorreoRatesResponse>({
      action: 'rates',
      company_id: companyId,
      postal_code: cp,
      items: norm,
    });
    return { ...res, rates: Array.isArray(res?.rates) ? res.rates : [] };
  });
}

/**
 * Sucursales de Correo Argentino, ya ordenadas por cercanía al CP. `provinceCode`
 * acepta el nombre de la provincia o su letra; sin provincia, el servidor la
 * deduce de un CPA tipo "S2000ABC".
 */
export function fetchCorreoAgencies(
  companyId: string,
  opts: { provinceCode?: string | null; postalCode?: string | null },
): Promise<CorreoAgenciesResponse> {
  const province = opts.provinceCode?.trim() || '';
  const postal = opts.postalCode?.trim() || '';
  const key = `${companyId}|${province.toLowerCase()}|${postal.toUpperCase()}`;
  return cached(agenciesCache, key, async () => {
    const res = await invokeMiCorreo<CorreoAgenciesResponse>({
      action: 'agencies',
      company_id: companyId,
      ...(province ? { province_code: province } : {}),
      ...(postal ? { postal_code: postal } : {}),
    });
    return {
      provinceCode: res?.provinceCode ?? null,
      agencies: Array.isArray(res?.agencies) ? res.agencies.filter((a) => a && a.code) : [],
    };
  });
}

/**
 * Tarifa que corresponde a una modalidad: la más barata del tipo de entrega
 * (D domicilio / S sucursal), prefiriendo el servicio clásico (CP) sobre el
 * expreso. Si no hay clásico, la más barata de esa entrega. null si no hay.
 */
export function pickCorreoRate(rates: CorreoRate[], kind: ShippingOption['kind']): CorreoRate | null {
  const delivered = kind === 'home' ? 'D' : kind === 'branch' ? 'S' : null;
  if (!delivered) return null;
  const pool = rates.filter(
    (r) => r && r.deliveredType === delivered && typeof r.price === 'number' && Number.isFinite(r.price) && r.price >= 0,
  );
  const classic = pool.filter((r) => r.productType === 'CP');
  const source = classic.length > 0 ? classic : pool;
  return source.reduce<CorreoRate | null>((best, r) => (!best || r.price < best.price ? r : best), null);
}

/** "3 a 5 días hábiles" / "2 días hábiles" / "1 día hábil". undefined si el correo no informó plazo. */
export function formatCorreoEta(min: string | null, max: string | null): string | undefined {
  const toDays = (v: string | null) => {
    const m = String(v ?? '').match(/\d+/);
    return m ? Number(m[0]) : null;
  };
  let a = toDays(min);
  let b = toDays(max);
  if (a == null && b == null) return undefined;
  if (a == null) a = b;
  if (b == null) b = a;
  const lo = Math.min(a as number, b as number);
  const hi = Math.max(a as number, b as number);
  const unit = (n: number) => (n === 1 ? 'día hábil' : 'días hábiles');
  return lo === hi ? `${lo} ${unit(lo)}` : `${lo} a ${hi} ${unit(hi)}`;
}

/**
 * Aplica la cotización a las opciones (pura). Sólo toca las que tienen
 * `liveCarrier`: su `cost` pasa a ser el precio real (entero) y su `eta` el plazo
 * informado. Si no hay cotización (`rates` null) o no trae esa modalidad, la
 * opción queda con el costo que configuró el comercio — fallback silencioso.
 *
 * Devuelve el MISMO array si no cambió nada, para no disparar efectos de más.
 */
export function applyCorreoRates(options: ShippingOption[], rates: CorreoRate[] | null): ShippingOption[] {
  if (!rates) return options;
  let changed = false;
  const next = options.map((o) => {
    if (o.liveCarrier !== 'correo-argentino') return o;
    const rate = pickCorreoRate(rates, o.kind);
    if (!rate) {
      console.warn(`[micorreo] la cotización no trae la modalidad de "${o.name}"; queda el costo configurado`);
      return o;
    }
    changed = true;
    return {
      ...o,
      cost: Math.round(rate.price),
      eta: formatCorreoEta(rate.deliveryTimeMin, rate.deliveryTimeMax) ?? o.eta,
    };
  });
  return changed ? next : options;
}

/**
 * Texto del transporte para el pedido cuando el cliente eligió sucursal:
 * "Correo Argentino (Retiro en sucursal) · Sucursal Monte Grande (B0107)".
 * El ERP extrae el código con /\(([A-Z]\d{4})\)/, así que el formato es contrato.
 */
export function carrierWithAgency(methodName: string, agency: Pick<CorreoAgency, 'code' | 'name'>): string {
  // Algunas sucursales ya vienen nombradas "Sucursal X": no duplicamos la palabra.
  // Sacamos paréntesis del nombre para que el único "(XNNNN)" sea el código.
  const name = String(agency.name || '')
    .replace(/^\s*sucursal\s+/i, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${methodName} · Sucursal ${name || agency.code} (${agency.code.trim().toUpperCase()})`;
}

/** Dirección legible de una sucursal en una línea. */
export function agencyAddressLine(a: CorreoAgency): string {
  const addr = a.address;
  if (!addr) return '';
  const street = [addr.streetName, addr.streetNumber].filter(Boolean).join(' ');
  const place = addr.locality || addr.city;
  return [street, place].filter(Boolean).join(', ');
}

/** Horarios de la sucursal en texto (la API los manda en formatos distintos). */
export function agencyHoursText(hours: unknown): string {
  if (!hours) return '';
  if (typeof hours === 'string') return hours.trim();
  if (Array.isArray(hours)) {
    return hours
      .map((h) => (typeof h === 'string' ? h : h && typeof h === 'object' ? Object.values(h).filter((v) => typeof v === 'string' || typeof v === 'number').join(' ') : ''))
      .filter(Boolean)
      .join(' · ');
  }
  if (typeof hours === 'object') {
    // Formato MiCorreo: { monday: { start: "0800", end: "1800" }, sunday: null, holidays: … }.
    // Agrupamos días seguidos con el mismo horario: "Lun a Vie 08:00 a 18:00 · Sáb 09:00 a 13:00".
    const h = hours as Record<string, unknown>;
    const range = (v: unknown): string => {
      if (v == null || v === '') return '';
      if (typeof v === 'string' || typeof v === 'number') return String(v);
      if (typeof v !== 'object') return '';
      const o = v as Record<string, unknown>;
      const from = o.start ?? o.from ?? o.desde;
      const to = o.end ?? o.to ?? o.hasta;
      return from && to ? `${hhmm(from)} a ${hhmm(to)}` : '';
    };
    const groups: { from: string; to: string; range: string }[] = [];
    WEEK_DAYS.forEach(([key, label], i) => {
      const r = range(h[key]);
      if (!r) return;
      const last = groups[groups.length - 1];
      // Sólo se agrupa con el día INMEDIATO anterior (un domingo cerrado corta el grupo).
      if (last && last.range === r && i > 0 && last.to === WEEK_DAYS[i - 1][1]) last.to = label;
      else groups.push({ from: label, to: label, range: r });
    });
    if (groups.length > 0) {
      return groups.map((g) => `${g.from === g.to ? g.from : `${g.from} a ${g.to}`} ${g.range}`).join(' · ');
    }
    // Formato desconocido: día → texto, tal cual venga.
    return Object.entries(h)
      .map(([day, v]) => (range(v) ? `${day}: ${range(v)}` : ''))
      .filter(Boolean)
      .join(' · ');
  }
  return '';
}

const WEEK_DAYS: [string, string][] = [
  ['monday', 'Lun'],
  ['tuesday', 'Mar'],
  ['wednesday', 'Mié'],
  ['thursday', 'Jue'],
  ['friday', 'Vie'],
  ['saturday', 'Sáb'],
  ['sunday', 'Dom'],
];

/** "0800" → "08:00"; lo que ya viene con ":" (o no es hora) queda igual. */
function hhmm(v: unknown): string {
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})(\d{2})$/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s;
}
