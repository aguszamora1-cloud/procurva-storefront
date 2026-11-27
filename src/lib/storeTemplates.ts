/**
 * Registro de plantillas de tienda online.
 *
 * ESPEJO BYTE-IDÉNTICO entre los dos repos (no hay paquete compartido):
 *   canónico: procurva-storefront/src/lib/storeTemplates.ts
 *   espejo:   procurva2/components/catalog/editor/storeTemplates.ts
 * Lo verifica scripts/check-store-templates-mirror.mjs en el prebuild del
 * storefront. Se edita el canónico y se copia tal cual. Por eso este archivo no
 * importa nada y usa sólo TypeScript borrable (sin enum ni namespace): Node lo
 * importa directo en las pruebas.
 *
 * QUÉ ES UNA PLANTILLA
 *   Una definición en código, identificada por `id` + `version`, con las claves
 *   de diseño que fija (`patch`, con los mismos nombres que `settings` de
 *   storefront_config). A la tienda se le guarda SOLO la referencia
 *   `settings.template = { id, version }`, cuando el comercio la aplica desde el
 *   diseñador (fase posterior). Sin referencia, o con una que no resuelve, la
 *   tienda se ve exactamente como hoy.
 *
 * REGLAS DE VERSIONADO
 *   - `id`: kebab-case estable. Nunca se renombra ni se reutiliza para otra cosa.
 *   - Una versión publicada es INMUTABLE (scripts/store-templates.lock.json
 *     guarda su hash). Para cambiarla se agrega `version + 1` y la anterior se
 *     queda: cada tienda sigue viendo la versión que aplicó hasta que el
 *     comercio elija actualizar.
 *   - Nunca se borra una versión publicada: una tienda podría tenerla guardada.
 *   - Este registro tiene SOLO plantillas publicadas. Los borradores no viven acá
 *     (el bundle del storefront es público): su vista previa queda deshabilitada
 *     hasta que exista una autorización real desde el ERP.
 *
 * COMPOSICIÓN (orden y visibilidad de secciones) — todavía NO
 *   `sections_order` y los `section_*` quedan fuera de TEMPLATE_PATCH_KEYS. Cuando
 *   se sumen, irán en un campo propio de la definición (no en `patch`), que sólo
 *   ordene y prenda/apague claves que ya existen en la tienda: nunca crea ni borra
 *   secciones propias ni toca su contenido, y las `custom:<uuid>` que la
 *   plantilla no nombre conservan su lugar relativo. Para poder revertir, el ERP
 *   guardará en `settings.template.previous` los valores que pisó (claves de
 *   `patch` y de composición) antes de aplicar. parseTemplateRef ya tolera esos
 *   campos extra.
 *
 * ARMADOS (`components`, esquema 2)
 *   Además de `patch`, una plantilla puede fijar el armado del encabezado
 *   (`components.header.layout`: classic | inline | stacked). Se resuelve al
 *   pintar, por id + versión; no es una clave de `settings` y no se guarda en la
 *   tienda. Todo lo que no sea exactamente una definición válida con un armado
 *   admitido pinta Classic (ver resolveTemplateHeader). No hay tonos ni más
 *   variantes: sumar una es un cambio de contrato y de esquema.
 *
 * APLICACIONES (`components.app`, esquema 3)
 *   Una plantilla puede ser una tienda completa con armado propio (encabezado,
 *   portada, listado, ficha, carrito): `components.app.kit` nombra el kit de
 *   código que la pinta (atelier | distrito | momentum). Igual que el encabezado,
 *   se resuelve al pintar por id + versión y no es una clave de `settings`. Que
 *   una referencia resuelva a un kit NO alcanza para montarlo: la tienda además
 *   exige el build con las aplicaciones habilitadas, canal minorista, sin outfits
 *   activos y la validación del servidor (ver lib/templateApp). Todo lo demás
 *   pinta Classic.
 *
 * T6 (23/11/2026): Atelier, Distrito y Momentum v1. Mientras el build no prenda
 * las aplicaciones y el servidor no valide la activación, ninguna tienda cambia.
 */

/**
 * Versión del formato de este archivo (no de una plantilla).
 *   1: id, version, name, patch.
 *   2: + `components.header` (armado del encabezado: classic | inline | stacked).
 *   3: + `components.app` (tienda completa con kit propio: atelier | distrito | momentum).
 */
export const STORE_TEMPLATES_SCHEMA = 3;

/** Lo que se guarda en `settings.template` (puede traer campos extra, que se ignoran). */
export interface StoreTemplateRef {
  id: string;
  version: number;
}

/**
 * Claves de `settings` que una plantilla puede fijar: SÓLO presentación.
 * Afuera a propósito: tipografía v1/v2 y capitalización (no se toca v1 ni
 * Mejorado), composición del home, textos, imágenes, logo, menú, precios,
 * medios de pago, stock y `badges` (mezcla estilo con reglas de stock y
 * descuento). Sumar una clave acá es un cambio de contrato: revisar que el
 * storefront la valide en normalizeStoreConfig.
 */
export const TEMPLATE_PATCH_KEYS = [
  'color_primary',
  'color_secondary',
  'color_accent',
  'color_background',
  'color_text',
  'header_background',
  'font_heading',
  'font_body',
  'font_scale',
  'corners',
  'button_corners',
  'hero_cta_style',
  'hero_fit',
  'section_title_align',
  'categories_display_mode',
  'categories_section',
  'products_display_mode',
  'section_display_modes',
  'show_variant_colors',
] as const;

export type TemplatePatchKey = (typeof TEMPLATE_PATCH_KEYS)[number];
export type TemplatePatch = Partial<Record<TemplatePatchKey, unknown>>;

/**
 * Armados del encabezado (`components.header`, esquema 2). `classic` es el de
 * siempre: el de toda tienda sin plantilla y el respaldo de cualquier valor que
 * no sea exactamente uno de estos. `inline` y `stacked` son los dos armados
 * previstos; mientras el storefront no los implemente, pedirlos también pinta
 * Classic (eso lo decide el storefront al elegir el componente, no este archivo).
 */
export const HEADER_LAYOUTS = ['classic', 'inline', 'stacked'] as const;
export type HeaderLayout = (typeof HEADER_LAYOUTS)[number];
export const DEFAULT_HEADER_LAYOUT: HeaderLayout = 'classic';

/** Armado del encabezado que fija una plantilla. Sólo `layout`; ninguna otra clave. */
export interface TemplateHeader {
  layout: HeaderLayout;
}

/**
 * Kits de tienda completa (`components.app.kit`, esquema 3). Cada uno es código
 * del storefront (src/templates/<kit>). Sumar uno es un cambio de contrato y de
 * esquema, igual que un armado de encabezado.
 */
export const APP_KITS = ['atelier', 'distrito', 'momentum'] as const;
export type AppKit = (typeof APP_KITS)[number];

/** Tienda completa que fija una plantilla. Sólo `kit`; ninguna otra clave. */
export interface TemplateAppComponent {
  kit: AppKit;
}

/**
 * Armados estructurales de una plantilla. Van FUERA de `patch` porque no son
 * claves de `settings`: el comercio no los edita sueltos, vienen con la versión
 * de la plantilla y quedan cubiertos por el lock de versiones publicadas (el
 * JSON canónico incluye `components`).
 */
export interface TemplateComponents {
  header?: TemplateHeader;
  /** Esquema 3. Ausente = la tienda se pinta con Classic (más el encabezado, si hay). */
  app?: TemplateAppComponent;
}

export interface StoreTemplateDefinition {
  id: string;
  version: number;
  /** Nombre que ve el comercio en la galería. */
  name: string;
  patch: TemplatePatch;
  /** Esquemas 2 y 3. Ausente = definición del esquema 1: encabezado Classic. */
  components?: TemplateComponents;
}

/**
 * Plantillas publicadas. Cada versión es inmutable (scripts/store-templates.lock.json).
 * Las tres v1 son tiendas completas: no pisan ninguna clave de `settings`.
 */
export const STORE_TEMPLATES: readonly StoreTemplateDefinition[] = [
  { id: 'atelier', version: 1, name: 'Atelier', patch: {}, components: { app: { kit: 'atelier' } } },
  { id: 'distrito', version: 1, name: 'Distrito', patch: {}, components: { app: { kit: 'distrito' } } },
  { id: 'momentum', version: 1, name: 'Momentum', patch: {}, components: { app: { kit: 'momentum' } } },
];

const ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const MAX_VERSION = 999;

/** kebab-case, 1 a 40 caracteres, sin guion al principio ni al final. */
export function isValidTemplateId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id);
}

function isValidVersion(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_VERSION;
}

/** Forma válida de una referencia guardada, o null. No mira si existe. */
export function parseTemplateRef(raw: unknown): StoreTemplateRef | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { id, version } = raw as { id?: unknown; version?: unknown };
  return isValidTemplateId(id) && isValidVersion(version) ? { id, version } : null;
}

/** Pedido de plantilla: id con versión exacta, o `version: null` = la más alta publicada. */
export interface TemplateRequest {
  id: string;
  version: number | null;
}

/** Busca una definición SOLO en el registro. */
export function findTemplate(
  req: TemplateRequest | null,
  registry: readonly StoreTemplateDefinition[] = STORE_TEMPLATES,
): StoreTemplateDefinition | null {
  if (!req) return null;
  let best: StoreTemplateDefinition | null = null;
  for (const def of registry) {
    if (def.id !== req.id) continue;
    if (req.version !== null) {
      if (def.version === req.version) return def;
    } else if (!best || def.version > best.version) {
      best = def;
    }
  }
  return best;
}

/** Referencia guardada → referencia que existe en el registro, o null (= aspecto de hoy). */
export function resolveTemplateRef(
  raw: unknown,
  registry: readonly StoreTemplateDefinition[] = STORE_TEMPLATES,
): StoreTemplateRef | null {
  const def = findTemplate(parseTemplateRef(raw), registry);
  return def ? { id: def.id, version: def.version } : null;
}

// ── Encabezado: validación, normalización y resolución ─────────────────────

export function isHeaderLayout(v: unknown): v is HeaderLayout {
  return typeof v === 'string' && (HEADER_LAYOUTS as readonly string[]).includes(v);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function isAppKit(v: unknown): v is AppKit {
  return typeof v === 'string' && (APP_KITS as readonly string[]).includes(v);
}

const COMPONENT_KEYS: readonly string[] = ['header', 'app'];
const HEADER_KEYS: readonly string[] = ['layout'];
const APP_KEYS: readonly string[] = ['kit'];
/** Sólo propiedades PROPIAS: nada heredado por prototipo cuenta como parte del contrato. */
const own = (o: Record<string, unknown>, k: string): unknown =>
  Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined;

/**
 * ¿`components` tiene exactamente la forma de los esquemas 2 y 3? Estricto a propósito:
 * las definiciones son código nuestro, así que una clave de más (un tono, un
 * armado futuro) es un error de contrato, no una opción que se tolera.
 * `undefined` (definición del esquema 1) es válido.
 */
export function isValidTemplateComponents(raw: unknown): raw is TemplateComponents | undefined {
  if (raw === undefined) return true;
  if (!isPlainObject(raw)) return false;
  for (const k of Object.keys(raw)) if (!COMPONENT_KEYS.includes(k)) return false;
  const h = own(raw, 'header');
  if (h !== undefined) {
    if (!isPlainObject(h)) return false;
    for (const k of Object.keys(h)) if (!HEADER_KEYS.includes(k)) return false;
    if (!isHeaderLayout(own(h, 'layout'))) return false;
  }
  const a = own(raw, 'app');
  if (a !== undefined) {
    if (!isPlainObject(a)) return false;
    for (const k of Object.keys(a)) if (!APP_KEYS.includes(k)) return false;
    if (!isAppKit(own(a, 'kit'))) return false;
  }
  return true;
}

/**
 * ¿`def` es una definición completa y bien formada (esquemas 1, 2 y 3)? Id y
 * versión válidos, nombre, `patch` con sólo claves permitidas y `components`
 * ausente o válido. No mira si está publicada: eso es findTemplate.
 */
export function isValidTemplateDefinition(def: unknown): def is StoreTemplateDefinition {
  if (!isPlainObject(def)) return false;
  const { id, version, name, patch, components } = def;
  if (!isValidTemplateId(id) || !isValidVersion(version)) return false;
  if (typeof name !== 'string' || !name.trim()) return false;
  if (!isPlainObject(patch)) return false;
  const allowed = TEMPLATE_PATCH_KEYS as readonly string[];
  for (const k of Object.keys(patch)) if (!allowed.includes(k)) return false;
  return isValidTemplateComponents(components);
}

/**
 * `components` limpio y copiado: sólo lo que el esquema 2 define. Lo que no
 * valida, o no trae encabezado, da `{}` (= Classic). No muta la entrada.
 */
export function normalizeTemplateComponents(raw: unknown): TemplateComponents {
  if (raw === undefined || !isValidTemplateComponents(raw)) return {};
  const h = own(raw as Record<string, unknown>, 'header') as TemplateHeader | undefined;
  const a = own(raw as Record<string, unknown>, 'app') as TemplateAppComponent | undefined;
  const out: TemplateComponents = {};
  if (h) out.header = { layout: h.layout };
  if (a) out.app = { kit: a.kit };
  return out;
}

/** Kit de tienda completa de una definición válida, o null (= Classic). */
export function templateAppKit(def: StoreTemplateDefinition | null | undefined): AppKit | null {
  if (!isValidTemplateDefinition(def)) return null;
  return normalizeTemplateComponents(def.components).app?.kit ?? null;
}

/**
 * Kit que corresponde a una referencia guardada (`settings.template` o la ya
 * resuelta de la config). Necesita versión exacta y una definición válida del
 * registro; cualquier otra cosa da null (= Classic). Pura. Que dé un kit NO
 * autoriza a montarlo: eso lo decide el storefront (lib/templateApp).
 */
export function resolveTemplateApp(
  raw: unknown,
  registry: readonly StoreTemplateDefinition[] = STORE_TEMPLATES,
): AppKit | null {
  return templateAppKit(findTemplate(parseTemplateRef(raw), registry));
}

/** Encabezado de una definición: el que pide si la definición es válida; si no, Classic. */
export function templateHeaderLayout(def: StoreTemplateDefinition | null | undefined): HeaderLayout {
  if (!isValidTemplateDefinition(def)) return DEFAULT_HEADER_LAYOUT;
  return normalizeTemplateComponents(def.components).header?.layout ?? DEFAULT_HEADER_LAYOUT;
}

/**
 * Encabezado que corresponde a una referencia guardada (`settings.template`, o
 * la referencia ya resuelta de la config de la tienda). Todo camino que no
 * termine en una definición válida del registro da Classic: sin referencia,
 * referencia mal formada, id o versión desconocidos, definición inválida o
 * encabezado no admitido. Pura: no lee ni escribe nada fuera de sus argumentos.
 */
export function resolveTemplateHeader(
  raw: unknown,
  registry: readonly StoreTemplateDefinition[] = STORE_TEMPLATES,
): HeaderLayout {
  return templateHeaderLayout(findTemplate(parseTemplateRef(raw), registry));
}

/**
 * Pedido de vista previa del query string: `?pc_template=<id>` o `<id>@<versión>`.
 * Sólo se lee con `pc_preview=1` (la marca de la vista previa del diseñador, que
 * además deja la visita fuera de las métricas); el `?preview=1` del onboarding no
 * cuenta. Es un PEDIDO, no una autorización: el storefront lo aplica únicamente
 * con el handshake completo del canal del diseñador (lib/templatePreview). El
 * valor sólo puede ELEGIR una definición del registro: por URL no entra ningún
 * color, texto ni clave. El resultado vive en memoria y nunca se guarda.
 */
export function parseTemplatePreview(search: string): TemplateRequest | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  if (params.get('pc_preview') !== '1') return null;
  const value = params.get('pc_template');
  if (!value) return null;
  const m = /^([^@]+)(?:@(\d{1,3}))?$/.exec(value);
  if (!m || !isValidTemplateId(m[1])) return null;
  if (m[2] === undefined) return { id: m[1], version: null };
  const version = Number(m[2]);
  return isValidVersion(version) ? { id: m[1], version } : null;
}

/** El patch de una definición, filtrado a las claves permitidas y copiado. */
export function templatePatch(def: StoreTemplateDefinition): Record<string, unknown> {
  const allowed = TEMPLATE_PATCH_KEYS as readonly string[];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(def.patch)) {
    if (allowed.includes(k) && v !== undefined) out[k] = JSON.parse(JSON.stringify(v));
  }
  return out;
}

/**
 * Settings con la plantilla aplicada: las claves del patch encima de las
 * existentes y la referencia en `template`. No muta la entrada. Todo lo que no
 * está en TEMPLATE_PATCH_KEYS queda tal cual.
 */
export function applyTemplate(
  settings: Record<string, unknown> | null | undefined,
  def: StoreTemplateDefinition,
): Record<string, unknown> {
  return { ...(settings ?? {}), ...templatePatch(def), template: { id: def.id, version: def.version } };
}

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = canonical((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}

/** JSON con las claves ordenadas: su hash es la huella de una versión publicada. */
export function canonicalTemplateJson(def: StoreTemplateDefinition): string {
  return JSON.stringify(canonical(def));
}
