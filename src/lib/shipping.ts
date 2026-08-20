import { supabase } from './supabase';

/** Identificador del ícono (lucide-react) con que se ilustra el método. */
export type ShippingIconName = 'truck' | 'store' | 'bike' | 'package';

/**
 * Naturaleza del método, para agrupar y rotular en el checkout sin adivinar por el id:
 * - 'local-pickup': retiro en el local del negocio (gratis, presencial, sin CP).
 * - 'home': envío a domicilio (el paquete viaja hasta el cliente).
 * - 'branch': retiro en sucursal de la transportadora (el paquete viaja hasta una sucursal).
 */
export type ShippingKind = 'local-pickup' | 'home' | 'branch';

/** Canal de la tienda donde se ofrece un método (espejo de `StoreChannel` en procurva2). */
export type StoreChannel = 'minorista' | 'mayorista';

/**
 * Canales en los que se ofrece el método. `undefined` = ambos (comportamiento
 * histórico: los métodos cargados antes de existir este campo no cambian).
 */
export function parseChannels(raw: unknown): StoreChannel[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const valid = raw.filter((c): c is StoreChannel => c === 'minorista' || c === 'mayorista');
  // Vacío o los dos = sin restricción, mismo criterio con el que lo guarda el panel.
  return valid.length === 0 || valid.length === 2 ? undefined : valid;
}

/** ¿El método se ofrece en el canal dado? Sin `channels` definido → sí (ambos). */
export function methodAvailableForChannel(m: ShippingOption, channel: StoreChannel): boolean {
  if (!m.channels) return true;
  return m.channels.includes(channel);
}

/** Método de envío normalizado, derivado de companies.settings.shippingMethods. */
export interface ShippingOption {
  id: string;
  name: string;
  /** Canales donde se ofrece. undefined = ambos. */
  channels?: StoreChannel[];
  /** Naturaleza del método (agrupación y copy en el checkout). */
  kind: ShippingKind;
  /** true si el método necesita dirección (no es retiro en local). */
  requiresAddress: boolean;
  /** Dirección del local (sólo retiro en local). */
  pickupAddress?: string;
  /** Horarios de atención del local (sólo retiro en local; opcional). */
  openingHours?: string;
  /** "Listo para retirar" del local (sólo retiro en local; opcional). */
  readyTime?: string;
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
  /**
   * ¿Se puede pagar EN EFECTIVO con esta entrega? El efectivo se cobra en mano,
   * así que sólo tiene sentido cuando la entrega es presencial del negocio
   * (retiro en el local, reparto propio). Si el paquete lo despacha una
   * transportadora nadie está ahí para cobrarlo. Lo configura el panel del ERP
   * por método (`allowsCash`); ver `parseAllowsCash` para el default.
   */
  allowsCash: boolean;
  /**
   * ¿Queda AFUERA de la promo "envío gratis a partir de $X"? Lo decide el panel
   * por método (Configuración → Envíos): un cadete de zona se regala sin drama,
   * pero un despacho nacional de $18.000 se come la ganancia del pedido entero.
   * Ausente (todos los métodos cargados antes de la feature) = participa: como
   * el umbral arranca apagado, prenderlo tiene que alcanzar a los envíos que el
   * comercio ya tenía cargados sin obligarlo a reeditarlos uno por uno.
   */
  excludeFromFreeShipping: boolean;
}

/**
 * Lee el flag `allowsCash` del método crudo. Si el negocio nunca lo tocó (todos
 * los métodos cargados antes de la feature) lo DERIVAMOS en vez de asumir que sí:
 * el retiro en local y la logística propia cobran en mano, las transportadoras y
 * cualquier método de cobertura nacional no. Así una tienda de Rosario deja de
 * ofrecerle "Efectivo" a un pedido que sale por Correo a Entre Ríos sin tener que
 * configurar nada, y el que quiera lo destilda igual desde el panel.
 */
export function parseAllowsCash(m: any, isPickup: boolean): boolean {
  if (typeof m.allowsCash === 'boolean') return m.allowsCash;
  if (isPickup) return true;
  return !(m.type === 'empresa' || m.coversAllPostalCodes === true);
}

/**
 * Estado de la promo "envío gratis a partir de $X" para un carrito dado.
 * Se calcula una sola vez y lo consumen el carrito, el checkout y la ficha de
 * producto: el número que promete la tienda y el que termina cobrando el
 * checkout salen del mismo lugar.
 */
export interface FreeShippingStatus {
  /** El comercio configuró un umbral (> 0). En false, el resto no aplica. */
  active: boolean;
  /** Monto a partir del cual el envío es gratis (0 = apagado). */
  threshold: number;
  /** El subtotal de mercadería ya llegó al umbral. */
  reached: boolean;
  /** Cuánto falta para llegar. 0 si ya llegó o si está apagada. */
  missing: number;
}

/**
 * Evalúa la promo contra el SUBTOTAL DE MERCADERÍA: el mismo número que la
 * tienda muestra como "Subtotal" (con promos por cantidad ya aplicadas, sin
 * envío, sin packaging y SIN restarle el cupón).
 *
 * Que el cupón no cuente es deliberado: el carrito no calcula el descuento (se
 * resuelve recién en el checkout y depende del medio de pago), así que medir el
 * umbral post-cupón haría que el carrito prometa envío gratis y el checkout se
 * lo cobre. La promesa se hace sobre el número que el cliente tiene a la vista.
 */
export function evalFreeShipping(threshold: number, goodsSubtotal: number): FreeShippingStatus {
  const min = Math.max(0, Math.round(threshold || 0));
  if (min <= 0) return { active: false, threshold: 0, reached: false, missing: 0 };
  const reached = goodsSubtotal >= min;
  return { active: true, threshold: min, reached, missing: reached ? 0 : min - goodsSubtotal };
}

/**
 * Costo final del método para este cliente: el que configuró el comercio, o 0
 * si la promo ya está alcanzada y el método participa.
 *
 * Bonificamos SÓLO envíos con precio conocido y mayor a cero: el retiro en el
 * local ya es gratis, y "a coordinar" (null) tiene que seguir siendo null —
 * poner 0 ahí sería prometer gratis un envío cuyo costo todavía no conoce ni el
 * comercio. Todo lo que muestra o cobra un envío pasa por acá.
 */
export function effectiveShippingCost(o: ShippingOption, promo: FreeShippingStatus): number | null {
  if (!promo.active || !promo.reached) return o.cost;
  if (o.excludeFromFreeShipping) return o.cost;
  // La promo es sobre el ENVÍO. Un punto de retiro con costo (raro, pero
  // existe) no es un envío y no se bonifica.
  if (!o.requiresAddress) return o.cost;
  if (typeof o.cost !== 'number' || o.cost <= 0) return o.cost;
  return 0;
}

/** ¿El método está bonificado por la promo (para tachar el precio de lista)? */
export function isFreeByPromo(o: ShippingOption, promo: FreeShippingStatus): boolean {
  return effectiveShippingCost(o, promo) === 0 && typeof o.cost === 'number' && o.cost > 0;
}

/**
 * Parsea el texto de cobertura CP cargado por el negocio ("1000-1499, 1601, 1700-1900")
 * a rangos numéricos. Acepta CPs de 3-4 dígitos. Tokens inválidos se ignoran.
 * El campo del panel es un textarea, así que separamos por comas, saltos de línea
 * y punto y coma indistintamente (muchos negocios cargan un CP por línea).
 */
export function parsePostalCodeRanges(raw: unknown): [number, number][] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(/[\n\r;,]+/)
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

/**
 * ¿El CP cae dentro de una zona de REPARTO PROPIO? = existe un método a domicilio
 * con cobertura restringida (no nacional, no retiro) cuyos rangos incluyen el CP.
 * Ej.: "Cadete / Logística Propia" cubriendo los CP de Rosario.
 */
export function hasOwnZoneCoverage(options: ShippingOption[], cp: number | null): boolean {
  if (cp == null) return false;
  return options.some(
    (o) =>
      o.requiresAddress &&
      !o.coversAllPostalCodes &&
      o.postalCodeRanges.length > 0 &&
      o.postalCodeRanges.some(([a, b]) => cp >= a && cp <= b),
  );
}

/**
 * ¿Mostrar este método para el CP dado? Igual que methodCoversPostalCode, pero si
 * el CP está en una zona de reparto propio (`ownZone`) OCULTA las transportadoras
 * nacionales (las que cubren todo el país): si el negocio llega con su propio cadete
 * a esa zona, no ofrece Correo Argentino / Vía Cargo ahí. El retiro en local y el
 * propio cadete no se tocan.
 */
export function methodAvailableForPostalCode(
  m: ShippingOption,
  cp: number | null,
  ownZone: boolean,
): boolean {
  if (!methodCoversPostalCode(m, cp)) return false;
  // En zona propia ocultamos cualquier envío de cobertura NO zonal (nacional): el
  // que cubre todo el país o el que no tiene rangos configurados. El cadete (con
  // rangos que incluyen el CP) y el retiro en local no se tocan.
  const coversEverywhere = m.coversAllPostalCodes || m.postalCodeRanges.length === 0;
  if (ownZone && m.requiresAddress && coversEverywhere) return false;
  return true;
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

/** Clave "espejo" del precio mayorista para cada costo del método. */
const WHOLESALE_KEY = {
  cost: 'wholesaleCost',
  branchCost: 'wholesaleBranchCost',
  homeDeliveryCost: 'wholesaleHomeDeliveryCost',
} as const;

/**
 * Costo del método para el canal en el que está parado el cliente. En la tienda
 * mayorista, si el negocio cargó un precio propio manda ése; si no, hereda el
 * minorista — que es lo que hacían TODOS los métodos antes de que el panel
 * pudiera diferenciarlos, así que ninguna tienda cambia de precio sola.
 *
 * Se resuelve acá, al parsear, y no en cada lugar que muestra un precio: el
 * `cost` que sale de este módulo ya es el que va a pagar este cliente. Un
 * override que hubiera que acordarse de aplicar en el calculador, en el listado
 * del checkout Y en el total es la receta del flete que se cobra distinto del
 * que se mostró.
 */
function costFor(m: any, key: keyof typeof WHOLESALE_KEY, channel: StoreChannel | undefined): unknown {
  if (channel === 'mayorista') {
    const ws = m[WHOLESALE_KEY[key]];
    if (typeof ws === 'number') return ws;
  }
  return m[key];
}

/** Mapea un método crudo (JSONB) a ShippingOption, leyendo costo/tiempo de forma defensiva. */
export function toShippingOption(m: any, channel?: StoreChannel): ShippingOption {
  const isPickup = m.isPickup === true || m.type === 'retiro';
  const rawCost = costFor(m, 'cost', channel) ?? m.price ?? m.shipping_cost;
  const cost = isPickup
    ? typeof rawCost === 'number' ? rawCost : 0
    : typeof rawCost === 'number' ? rawCost : null;
  // Para retiro en local: "listo para retirar" (readyTime) con fallback a estimatedTime
  // por compatibilidad con métodos cargados antes de existir el campo.
  const readyTime = isPickup
    ? (typeof m.readyTime === 'string' && m.readyTime.trim() ? m.readyTime.trim() : etaFor(m, true))
    : undefined;
  return {
    id: String(m.id ?? m.name),
    name: String(m.name ?? 'Envío'),
    channels: parseChannels(m.channels),
    kind: isPickup ? 'local-pickup' : 'home',
    requiresAddress: !isPickup,
    pickupAddress: typeof m.pickupAddress === 'string' && m.pickupAddress.trim() ? m.pickupAddress.trim() : undefined,
    openingHours: isPickup && typeof m.openingHours === 'string' && m.openingHours.trim() ? m.openingHours.trim() : undefined,
    readyTime,
    cost,
    eta: etaFor(m, isPickup),
    icon: iconFor(isPickup, m.type),
    description: descriptionFor(isPickup, m.allowedCities),
    coversAllPostalCodes: m.coversAllPostalCodes === true,
    postalCodeRanges: parsePostalCodeRanges(m.postalCodes),
    allowsCash: parseAllowsCash(m, isPickup),
    excludeFromFreeShipping: m.excludeFromFreeShipping === true,
  };
}

/**
 * Expande un método crudo a una o dos ShippingOption.
 * Empresa de transporte (Correo Argentino, Andreani, Vía Cargo, OCA…) → dos
 * modalidades seleccionables con precio independiente: envío a domicilio y retiro
 * en sucursal. El resto de los métodos devuelve una sola opción.
 */
export function expandMethod(m: any, channel?: StoreChannel): ShippingOption[] {
  const isPickup = m.isPickup === true || m.type === 'retiro';
  if (!isPickup && m.type === 'empresa') {
    const baseId = String(m.id ?? m.name);
    const baseName = String(m.name ?? 'Envío');
    const eta = etaFor(m, false);
    const coversAllPostalCodes = m.coversAllPostalCodes === true;
    const postalCodeRanges = parsePostalCodeRanges(m.postalCodes);
    const channels = parseChannels(m.channels);
    // Las dos modalidades (domicilio / sucursal) heredan el mismo criterio de
    // efectivo: es el mismo despacho, sólo cambia dónde termina el paquete.
    const allowsCash = parseAllowsCash(m, false);
    // Domicilio y sucursal son el mismo despacho: si el comercio dejó a la
    // transportadora afuera del envío gratis, las dos modalidades quedan afuera.
    const excludeFromFreeShipping = m.excludeFromFreeShipping === true;
    return [
      {
        id: `${baseId}:domicilio`,
        name: `${baseName} (Envío a domicilio)`,
        channels,
        kind: 'home',
        requiresAddress: true,
        cost: variantCost(costFor(m, 'homeDeliveryCost', channel), costFor(m, 'cost', channel)),
        eta,
        icon: 'truck',
        description: '',
        coversAllPostalCodes,
        postalCodeRanges,
        allowsCash,
        excludeFromFreeShipping,
      },
      {
        id: `${baseId}:sucursal`,
        name: `${baseName} (Retiro en sucursal)`,
        channels,
        kind: 'branch',
        requiresAddress: true,
        cost: variantCost(costFor(m, 'branchCost', channel), costFor(m, 'cost', channel)),
        eta,
        icon: 'store',
        description: '',
        coversAllPostalCodes,
        postalCodeRanges,
        allowsCash,
        excludeFromFreeShipping,
      },
    ];
  }
  return [toShippingOption(m, channel)];
}

/**
 * Trae los métodos de envío activos del negocio vía la RPC anon-segura
 * `get_catalog_shipping_methods` (lee companies.settings.shippingMethods sanitizado).
 * Lanza si la RPC falla; el caller decide cómo mostrar el error.
 */
export async function fetchShippingOptions(
  companyId: string,
  channel?: StoreChannel,
): Promise<ShippingOption[]> {
  const { data, error } = await supabase.rpc('get_catalog_shipping_methods', {
    p_company_id: companyId,
  });
  if (error) throw error;
  const raw = Array.isArray(data) ? data : [];
  // La lista es única para las dos tiendas, así que la acotamos al canal: sin
  // esto el calculador puede prometer un método que después el checkout esconde.
  return raw
    .filter((m: any) => m && m.isActive !== false)
    .flatMap((m: any) => expandMethod(m, channel))
    .filter((o) => (channel ? methodAvailableForChannel(o, channel) : true));
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
