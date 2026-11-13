/**
 * EDITOR E2.0a · canal de la vista previa entre el diseñador del ERP y la tienda.
 *
 * La tienda REAL se ve dentro de un iframe del diseñador (procurva.app). Este
 * módulo es el lado de la tienda de un canal postMessage MÍNIMO: sólo acredita
 * "esta pestaña es la vista previa del diseñador de ProCurva". No transporta
 * configuraciones ni borradores, no ejecuta acciones y no escribe nada.
 *
 * Qué acredita y qué NO:
 *  - Acredita el CONTEXTO: la tienda está enmarcada por una página del ERP
 *    (origen exacto en PARENT_ORIGINS) que le habló a ESTE documento.
 *  - NO acredita permisos sobre la empresa. La identidad que manda la tienda
 *    (`ready`) es pública (la misma que usa en sus propias consultas) y sólo le
 *    sirve al ERP para descartar un iframe que no es el que espera.
 *  - `?pc_preview=1` NO es autorización: sólo decide si vale la pena escuchar.
 *    Sin un `hello` válido del padre, la tienda se comporta como siempre.
 *
 * Público intacto: si la tienda no está enmarcada o no vino con la marca de vista
 * previa, este módulo no agrega listeners ni manda mensajes (estado 'public').
 *
 * Contrato (v1), todos los mensajes `{ ns: 'procurva.preview', v: 1, type, ... }`:
 *   tienda → ERP  probe  { doc }                          "estoy, ¿quién sos?"
 *   ERP → tienda  hello  { channel, expect }              canal de ESTE iframe
 *   tienda → ERP  ready  { channel, doc, store }          "estoy protegida" + identidad
 *                                                         pública (null hasta resolverla)
 *   ERP → tienda  ack    { channel, doc }                 identidad aceptada
 * `channel`: 32 hex al azar del ERP, nuevo en cada montaje del iframe.
 * `doc`: 32 hex al azar de la tienda, nuevo en cada documento (cada recarga).
 * Hasta 2 KB por mensaje, campos exactos, cualquier otra cosa se descarta.
 */

export const PREVIEW_NS = 'procurva.preview';
export const PREVIEW_VERSION = 1;
export const MAX_MESSAGE_BYTES = 2048;
/** Sin `hello` del diseñador en este tiempo, la pestaña es pública (no se bloquea nada). */
export const HANDSHAKE_TIMEOUT_MS = 2500;

/** Único origen del ERP en producción. `www` redirige al apex (308), no enmarca. */
const PROD_PARENT_ORIGINS: readonly string[] = ['https://procurva.app'];

/**
 * Orígenes del ERP que pueden hablarle a la tienda. En producción, SÓLO el apex:
 * una compilación de producción ignora cualquier variable de entorno (así un
 * `localhost` nunca puede quedar aceptado en las tiendas reales). Fuera de
 * producción (vite dev, `--mode e2e`) se suman los de VITE_PREVIEW_PARENT_ORIGINS.
 */
export function parentOrigins(): string[] {
  const extra =
    import.meta.env.MODE === 'production'
      ? []
      : String(import.meta.env.VITE_PREVIEW_PARENT_ORIGINS ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter((s) => /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(s));
  return [...PROD_PARENT_ORIGINS, ...extra];
}

const HEX32 = /^[0-9a-f]{32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[A-Za-z0-9_-]{1,64}$/;
const SLUG = /^[a-z0-9_-]{0,64}$/i;

export interface StoreIdentity {
  companyId: string;
  storeKey: string;
  slug: string;
}

export type InboundMessage =
  | { type: 'hello'; channel: string; expect: StoreIdentity }
  | { type: 'ack'; channel: string; doc: string }
  | { type: 'inspect'; channel: string; doc: string; on: boolean }
  | { type: 'reveal'; channel: string; doc: string; section: string | null; req: number | null };

/**
 * EDITOR E3.0 · selección visual. Tipos NUEVOS sobre el mismo contrato v1 (los
 * existentes no cambian): un ERP o una tienda que no los conocen los descartan.
 *   ERP → tienda  inspect { channel, doc, on }        activa/desactiva la selección
 *   ERP → tienda  reveal  { channel, doc, section }   resalta y lleva a una sección (null = limpiar)
 *   tienda → ERP  select  { channel, doc, page, section }  el comercio hizo clic en una sección
 * Sólo viajan CLAVES de sección: nada de configuración, borradores ni datos.
 *
 * EDITOR E3.2 · B2 · confirmación del reveal (aditivo, mismo v1):
 *   ERP → tienda  reveal   { channel, doc, section, req }        `req` OPCIONAL: pide confirmación
 *   tienda → ERP  revealed { channel, doc, section, req, found } una sola vez por pedido con `req`
 * `req` (entero 1…2³¹−1, lo numera el ERP) distingue dos pedidos de la MISMA sección
 * en el mismo canal y documento (A, B, A: una confirmación tardía del primer A no se
 * confunde con la del segundo). Sin `req` (ERP anterior, o `section: null`) la tienda
 * se comporta como antes y no confirma nada. Un pedido cancelado (otro pedido, el
 * comercio scrolleó o tocó, se apagó la selección) no se confirma.
 */
export const MAX_REVEAL_REQ = 2147483647;
export const isRevealReq = (n: unknown): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 1 && n <= MAX_REVEAL_REQ;
const SECTION_KEY = /^[a-z][a-z_]{0,31}$/;
const CUSTOM_SECTION_KEY = /^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export type PreviewPage = 'home' | 'producto' | 'checkout' | 'other';
const PAGES: readonly PreviewPage[] = ['home', 'producto', 'checkout', 'other'];

/** ¿Es una clave de sección con forma válida? (no dice si existe ni si es seleccionable) */
export function isSectionKey(k: unknown): k is string {
  return typeof k === 'string' && (SECTION_KEY.test(k) || CUSTOM_SECTION_KEY.test(k));
}

export function isPreviewPage(p: unknown): p is PreviewPage {
  return typeof p === 'string' && (PAGES as readonly string[]).includes(p);
}

function exactKeys(o: Record<string, unknown>, keys: string[]): boolean {
  const k = Object.keys(o);
  return k.length === keys.length && keys.every((x) => Object.prototype.hasOwnProperty.call(o, x));
}

function isPlain(o: unknown): o is Record<string, unknown> {
  return !!o && typeof o === 'object' && !Array.isArray(o) && Object.getPrototypeOf(o) === Object.prototype;
}

function sizeOk(data: unknown): boolean {
  try {
    return JSON.stringify(data).length <= MAX_MESSAGE_BYTES;
  } catch {
    return false;
  }
}

export function isIdentity(o: unknown): o is StoreIdentity {
  return (
    isPlain(o) &&
    exactKeys(o, ['companyId', 'storeKey', 'slug']) &&
    typeof o.companyId === 'string' && UUID.test(o.companyId) &&
    typeof o.storeKey === 'string' && KEY.test(o.storeKey) &&
    typeof o.slug === 'string' && SLUG.test(o.slug)
  );
}

/** Valida un mensaje que llega del ERP. null = se descarta. */
export function parseInbound(data: unknown): InboundMessage | null {
  if (!isPlain(data) || !sizeOk(data)) return null;
  if (data.ns !== PREVIEW_NS || data.v !== PREVIEW_VERSION) return null;
  if (data.type === 'hello') {
    if (!exactKeys(data, ['ns', 'v', 'type', 'channel', 'expect'])) return null;
    if (typeof data.channel !== 'string' || !HEX32.test(data.channel)) return null;
    if (!isIdentity(data.expect)) return null;
    return { type: 'hello', channel: data.channel, expect: data.expect };
  }
  if (data.type === 'ack') {
    if (!exactKeys(data, ['ns', 'v', 'type', 'channel', 'doc'])) return null;
    if (typeof data.channel !== 'string' || !HEX32.test(data.channel)) return null;
    if (typeof data.doc !== 'string' || !HEX32.test(data.doc)) return null;
    return { type: 'ack', channel: data.channel, doc: data.doc };
  }
  if (data.type === 'inspect') {
    if (!exactKeys(data, ['ns', 'v', 'type', 'channel', 'doc', 'on'])) return null;
    if (typeof data.channel !== 'string' || !HEX32.test(data.channel)) return null;
    if (typeof data.doc !== 'string' || !HEX32.test(data.doc)) return null;
    if (typeof data.on !== 'boolean') return null;
    return { type: 'inspect', channel: data.channel, doc: data.doc, on: data.on };
  }
  if (data.type === 'reveal') {
    // E3.2 B2: con o sin `req` (exactamente una de las dos formas). `req` sólo con una
    // sección: limpiar (`section: null`) no se confirma.
    const conReq = exactKeys(data, ['ns', 'v', 'type', 'channel', 'doc', 'section', 'req']);
    if (!conReq && !exactKeys(data, ['ns', 'v', 'type', 'channel', 'doc', 'section'])) return null;
    if (typeof data.channel !== 'string' || !HEX32.test(data.channel)) return null;
    if (typeof data.doc !== 'string' || !HEX32.test(data.doc)) return null;
    if (data.section !== null && !isSectionKey(data.section)) return null;
    if (conReq && (data.section === null || !isRevealReq(data.req))) return null;
    return {
      type: 'reveal',
      channel: data.channel,
      doc: data.doc,
      section: data.section as string | null,
      req: conReq ? (data.req as number) : null,
    };
  }
  return null;
}

/** Evento de selección para la capa de inspección (lib/previewInspect). */
export type InspectEvent =
  | { type: 'inspect'; on: boolean }
  /** `ticket` (E3.2 B2): sólo si el ERP pidió confirmación; se devuelve tal cual en `revealed`. */
  | { type: 'reveal'; section: string | null; ticket: RevealTicket | null };
/** Pedido de reveal con confirmación: canal en el que llegó y su número. */
export type RevealTicket = { channel: string; req: number };
type InspectListener = (e: InspectEvent) => void;

export function randomHex32(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Estado de ESTA pestaña:
 *  - 'public'  : visita normal. Nunca se bloquea nada.
 *  - 'pending' : enmarcada y con marca de vista previa, esperando al diseñador.
 *  - 'preview' : el diseñador de ProCurva (origen exacto) le habló a este documento.
 */
export type PreviewState = 'public' | 'pending' | 'preview';

type Listener = (s: PreviewState) => void;

interface ChannelDeps {
  win: Window;
  /** ¿Vino con la marca de vista previa? (lib/previewMode). Condición, no autorización. */
  marked: boolean;
  origins: string[];
  timeoutMs: number;
}

/** El canal en sí, inyectable para probarlo sin navegador real. */
export function createPreviewChannel(deps: ChannelDeps) {
  const { win, marked, origins, timeoutMs } = deps;
  const framed = (() => {
    try {
      return win.parent !== win;
    } catch {
      return true;
    }
  })();

  let state: PreviewState = framed && marked ? 'pending' : 'public';
  const doc = randomHex32();
  let channel: string | null = null;
  let parentOrigin: string | null = null;
  let identity: StoreIdentity | null = null;
  let acked = false;
  let lastReadyFor: string | null = null;
  const listeners = new Set<Listener>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  // E3.0: selección visual. Sólo en memoria de ESTE documento (nunca en storage):
  // un documento nuevo arranca siempre apagado.
  let inspecting = false;
  const inspectListeners = new Set<InspectListener>();
  const emitInspect = (e: InspectEvent) => inspectListeners.forEach((l) => l(e));
  const stopInspecting = () => {
    if (!inspecting) return;
    inspecting = false;
    emitInspect({ type: 'inspect', on: false });
  };

  const set = (s: PreviewState) => {
    if (state === s) return;
    state = s;
    listeners.forEach((l) => l(s));
  };

  const post = (msg: Record<string, unknown>, origin: string) => {
    // Siempre a un origen exacto: si el padre no es ese origen, el navegador lo descarta.
    win.parent.postMessage({ ns: PREVIEW_NS, v: PREVIEW_VERSION, ...msg }, origin);
  };

  // E2.0c: el ready sale apenas llega el hello (la tienda ya bloqueó sus
  // operaciones), con la identidad en null si todavía no la resolvió (mayorista
  // con contraseña, en construcción, cargando); se repite cuando la resuelve.
  const sendReady = () => {
    if (!channel || !parentOrigin) return;
    const key = identity
      ? `${channel}|${identity.companyId}|${identity.storeKey}|${identity.slug}`
      : `${channel}|null`;
    if (key === lastReadyFor) return; // duplicado: lo mismo ya anunciado en este canal
    lastReadyFor = key;
    post({ type: 'ready', channel, doc, store: identity ? { ...identity } : null }, parentOrigin);
  };

  const onMessage = (ev: MessageEvent) => {
    // Sólo el padre directo, sólo desde un origen exacto del ERP.
    if (ev.source !== win.parent) return;
    if (!origins.includes(ev.origin)) return;
    const msg = parseInbound(ev.data);
    if (!msg) return;
    if (msg.type === 'hello') {
      if (msg.channel !== channel) {
        // Canal nuevo (el ERP reinició el handshake): la selección del canal anterior
        // se apaga en el acto y no vuelve sin un ack y un inspect del canal nuevo.
        stopInspecting();
        channel = msg.channel;
        acked = false;
        lastReadyFor = null;
      }
      parentOrigin = ev.origin;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      // Un hello tardío (después del plazo) también cuenta: desde acá es vista previa.
      set('preview');
      sendReady();
      return;
    }
    if (msg.type === 'ack') {
      // ack: sólo el del canal vigente y para ESTE documento.
      if (msg.channel === channel && msg.doc === doc && ev.origin === parentOrigin) acked = true;
      return;
    }
    // E3.0 inspect / reveal: sólo con el handshake COMPLETO de este documento
    // (ack recibido), del canal vigente, para ESTE documento y desde el mismo
    // origen que dio el hello. Un ERP viejo nunca los manda: la selección no se activa.
    if (!acked || msg.channel !== channel || msg.doc !== doc || ev.origin !== parentOrigin) return;
    if (msg.type === 'inspect') {
      if (msg.on === inspecting) return; // repetido
      if (msg.on) {
        inspecting = true;
        emitInspect({ type: 'inspect', on: true });
      } else {
        stopInspecting();
      }
      return;
    }
    // reveal: sólo con la selección activa.
    if (inspecting) {
      emitInspect({
        type: 'reveal',
        section: msg.section,
        ticket: msg.req !== null ? { channel: msg.channel, req: msg.req } : null,
      });
    }
  };

  const start = () => {
    if (state !== 'pending') return; // pestaña pública: ni listener ni mensajes
    win.addEventListener('message', onMessage);
    for (const o of origins) post({ type: 'probe', doc }, o);
    timer = setTimeout(() => {
      timer = null;
      if (state === 'pending') set('public');
    }, timeoutMs);
  };

  return {
    start,
    get state() {
      return state;
    },
    get acked() {
      return acked;
    },
    /** E3.0: ¿el diseñador activó la selección visual para este documento y canal? */
    get inspecting() {
      return inspecting;
    },
    /** E3.0: avisa cuando la selección se activa/desactiva o el ERP pide resaltar una sección. */
    onInspect(l: InspectListener) {
      inspectListeners.add(l);
      return () => inspectListeners.delete(l);
    },
    /**
     * E3.0: el comercio hizo clic en una sección. Sólo con la selección activa (y por
     * lo tanto con el handshake completo), sólo al origen exacto que dio el hello y
     * sólo con una clave de sección. Devuelve si se mandó.
     */
    select(section: string, page: PreviewPage): boolean {
      if (!inspecting || !acked || !channel || !parentOrigin) return false;
      if (!isSectionKey(section) || !isPreviewPage(page)) return false;
      post({ type: 'select', channel, doc, page, section }, parentOrigin);
      return true;
    },
    /**
     * E3.2 B2: resultado de un reveal con `req`. Mismas condiciones que `select` y,
     * además, el canal del pedido tiene que seguir siendo el vigente: una confirmación
     * de un canal anterior nunca sale. Devuelve si se mandó.
     */
    revealed(ticket: RevealTicket, section: string, found: boolean): boolean {
      if (!inspecting || !acked || !channel || !parentOrigin) return false;
      if (ticket.channel !== channel || !isRevealReq(ticket.req)) return false;
      if (!isSectionKey(section) || typeof found !== 'boolean') return false;
      post({ type: 'revealed', channel, doc, section, req: ticket.req, found }, parentOrigin);
      return true;
    },
    doc,
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    /** La tienda resolvió (o cambió) qué tienda es. Datos públicos de la propia tienda. */
    setIdentity(id: StoreIdentity | null) {
      identity = id && isIdentity(id) ? id : null;
      sendReady();
    },
    /**
     * Espera a que se resuelva un 'pending' (llega el hello o vence el plazo).
     * Devuelve el estado final. Público → resuelve en el acto.
     */
    settled(): Promise<PreviewState> {
      if (state !== 'pending') return Promise.resolve(state);
      return new Promise((resolve) => {
        const off = this.subscribe((s) => {
          if (s !== 'pending') {
            off();
            resolve(s);
          }
        });
      });
    },
    stop() {
      stopInspecting();
      win.removeEventListener('message', onMessage);
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

export type PreviewChannel = ReturnType<typeof createPreviewChannel>;

let singleton: PreviewChannel | null = null;

/** Canal de esta pestaña. Se crea una vez (main.tsx) antes de pintar la tienda. */
export function initPreviewChannel(marked: boolean): PreviewChannel {
  if (singleton) return singleton;
  singleton = createPreviewChannel({
    win: window,
    marked,
    origins: parentOrigins(),
    timeoutMs: HANDSHAKE_TIMEOUT_MS,
  });
  singleton.start();
  // Marca visible del estado (para estilos y pruebas). Una visita pública no la lleva.
  if (singleton.state !== 'public') {
    const mark = (s: PreviewState) => {
      document.documentElement.dataset.pcPreview = s;
    };
    mark(singleton.state);
    singleton.subscribe(mark);
  }
  return singleton;
}

export function getPreviewChannel(): PreviewChannel | null {
  return singleton;
}
