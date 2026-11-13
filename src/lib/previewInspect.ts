/**
 * EDITOR E3.0 · selección visual de secciones dentro del diseñador del ERP.
 *
 * Qué hace: con la selección ACTIVA (mensaje `inspect` del ERP por el canal E2.0,
 * con el handshake completo de este documento), marca con un contorno discreto la
 * sección bajo el puntero y, al hacer clic, avisa al ERP qué sección eligió el
 * comercio (`select`). El ERP puede pedir resaltar y llevar a una sección (`reveal`).
 *
 * Qué NO hace:
 *  - Nada en una visita pública ni con un ERP que no manda `inspect`: no hay
 *    listeners, capa ni marcas (las marcas del DOM sólo existen en el diseñador,
 *    ver components/PreviewSection).
 *  - No transmite configuración ni contenido: sólo la clave de la sección.
 *  - Mientras está activa, NINGÚN clic, toque, puntero ni Enter/Espacio llega a
 *    los componentes de la tienda: no navega, no agrega al carrito, no envía
 *    formularios, no compra. El scroll (rueda y táctil), Tab, Escape y las flechas
 *    siguen como siempre. Con la selección apagada la tienda se comporta como hoy
 *    (y las operaciones reales siguen bloqueadas por E2.0).
 *
 * La capa se dibuja en un nodo propio colgado de <html>, fuera del árbol de React,
 * con `pointer-events: none`: no cambia el layout ni intercepta nada por sí misma.
 */
import type { PreviewChannel, PreviewPage, RevealTicket } from './previewChannel';

/** Secciones que E3.0 deja seleccionar (Inicio). Misma clave que el ERP. */
export const SELECTABLE_SECTIONS: readonly string[] = ['hero', 'categories', 'featured', 'new_arrivals', 'offers', 'trust_badges'];

/** Nombre visible en la etiqueta de la selección (mismos textos que el panel del ERP). */
export const SECTION_LABELS: Record<string, string> = {
  hero: 'Banner principal',
  categories: 'Categorías',
  featured: 'Productos destacados',
  new_arrivals: 'Nuevos ingresos',
  offers: 'Ofertas',
  trust_badges: 'Distintivos de confianza',
};

export const isSelectableSection = (k: string | null | undefined): k is string =>
  !!k && SELECTABLE_SECTIONS.includes(k);

/**
 * EDITOR E3.1.1 · secciones con etiqueta PERMANENTE mientras la selección está activa:
 * sólo las que el diseñador del ERP abre con un clic (E3.1). Distintivos de confianza
 * sigue marcándose al pasar el puntero, pero no lleva etiqueta: todavía no se edita
 * con un clic y la etiqueta lo sugeriría.
 */
export const LABELED_SECTIONS: readonly string[] = ['hero', 'categories', 'featured', 'new_arrivals', 'offers'];

/** Qué página del diseñador es esta ruta (el ERP la usa para validar la sección). */
export function pageOf(pathname: string): PreviewPage {
  if (pathname === '/' || pathname === '') return 'home';
  if (/^\/producto\/[^/]+\/?$/.test(pathname)) return 'producto';
  if (/^\/checkout\/?$/.test(pathname)) return 'checkout';
  return 'other';
}

export const SECTION_ATTR = 'data-pc-section';
const ACCENT = '#2563eb';

/** La sección seleccionable más interna que contiene a `node` (o null). */
export function sectionElementOf(node: unknown): Element | null {
  let el: Element | null =
    node && typeof (node as Element).closest === 'function'
      ? (node as Element)
      : node && (node as Node).parentElement
        ? (node as Node).parentElement
        : null;
  while (el) {
    const hit = el.closest(`[${SECTION_ATTR}]`);
    if (!hit) return null;
    if (isSelectableSection(hit.getAttribute(SECTION_ATTR))) return hit;
    el = hit.parentElement;
  }
  return null;
}

/** Caja visible de una sección. El envoltorio es `display: contents` (sin caja propia): se mide su contenido. */
function boxOf(el: Element): DOMRect | null {
  const r = el.ownerDocument.createRange();
  r.selectNodeContents(el);
  const b = r.getBoundingClientRect();
  r.detach?.();
  return b.width > 0 && b.height > 0 ? b : null;
}

interface Overlay {
  root: HTMLDivElement;
  hover: HTMLDivElement;
  selected: HTMLDivElement;
  label: HTMLDivElement;
  /** E3.1.1: una etiqueta permanente por sección de LABELED_SECTIONS (creadas una sola vez). */
  tags: Map<string, HTMLDivElement>;
}

/** E3.1.1: separación de la etiqueta respecto de la esquina visible de su sección. */
const TAG_INSET = 8;
/** Alto de la etiqueta (fijo por su line-height): se usa sin medir el DOM. */
const TAG_H = 18;
/** Parte visible mínima de la sección para mostrar su etiqueta (si no, taparía casi todo). */
const TAG_MIN_VISIBLE_H = TAG_H + TAG_INSET * 2;
const TAG_MIN_VISIBLE_W = 64;

function makeOverlay(doc: Document): Overlay {
  const root = doc.createElement('div');
  root.setAttribute('data-pc-inspect-overlay', '');
  root.setAttribute('aria-hidden', 'true');
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '2147483646',
    contain: 'strict',
  } satisfies Partial<CSSStyleDeclaration>);
  const box = (border: string) => {
    const d = doc.createElement('div');
    Object.assign(d.style, {
      position: 'absolute',
      display: 'none',
      boxSizing: 'border-box',
      border,
      pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    root.appendChild(d);
    return d;
  };
  const hover = box(`1px solid ${ACCENT}99`);
  hover.setAttribute('data-pc-inspect', 'hover');
  const selected = box(`2px solid ${ACCENT}`);
  selected.setAttribute('data-pc-inspect', 'selected');
  const label = doc.createElement('div');
  label.setAttribute('data-pc-inspect', 'label');
  Object.assign(label.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    padding: '2px 8px',
    background: ACCENT,
    color: '#fff',
    font: '600 11px/16px system-ui, -apple-system, "Segoe UI", sans-serif',
    letterSpacing: '0.01em',
    borderBottomRightRadius: '4px',
    whiteSpace: 'nowrap',
  } satisfies Partial<CSSStyleDeclaration>);
  selected.appendChild(label);
  // E3.1.1: etiquetas permanentes, discretas (fondo claro, texto del acento), sin borde
  // alrededor de la sección. Fuera del flujo y sin eventos, como el resto de la capa.
  const tags = new Map<string, HTMLDivElement>();
  for (const key of LABELED_SECTIONS) {
    const t = doc.createElement('div');
    t.setAttribute('data-pc-inspect', 'tag');
    t.setAttribute('data-pc-tag', key);
    t.textContent = SECTION_LABELS[key] || '';
    Object.assign(t.style, {
      position: 'absolute',
      display: 'none',
      top: '0',
      left: '0',
      height: `${TAG_H}px`,
      padding: '0 7px',
      boxSizing: 'border-box',
      background: 'rgba(255, 255, 255, 0.94)',
      color: ACCENT,
      border: `1px solid ${ACCENT}38`,
      borderRadius: '4px',
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.12)',
      font: '600 11px/16px system-ui, -apple-system, "Segoe UI", sans-serif',
      letterSpacing: '0.01em',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    root.insertBefore(t, hover); // debajo de los contornos y de la etiqueta de la selección
    tags.set(key, t);
  }
  doc.documentElement.appendChild(root);
  return { root, hover, selected, label, tags };
}

/** Escribe una caja medida antes (o la oculta). Separado de la medición: no fuerza layout. */
function applyBox(div: HTMLDivElement, b: DOMRect | null): void {
  if (!b) {
    div.style.display = 'none';
    return;
  }
  Object.assign(div.style, {
    display: 'block',
    left: `${b.left}px`,
    top: `${b.top}px`,
    width: `${b.width}px`,
    height: `${b.height}px`,
  });
}

/**
 * E3.1.1: dónde va la etiqueta permanente de una sección: en la esquina superior
 * izquierda de su parte VISIBLE (debajo del encabezado fijo y dentro de la ventana; un
 * carrusel tiene diapositivas fuera de pantalla). null si casi no se ve.
 */
export function tagPosition(
  b: { left: number; top: number; right: number; bottom: number } | null,
  clipTop: number,
  viewW: number,
  viewH: number,
): { x: number; y: number } | null {
  if (!b) return null;
  const top = Math.max(b.top, clipTop);
  const left = Math.max(b.left, 0);
  const bottom = Math.min(b.bottom, viewH);
  const right = Math.min(b.right, viewW);
  if (bottom - top < TAG_MIN_VISIBLE_H || right - left < TAG_MIN_VISIBLE_W) return null;
  return { x: left + TAG_INSET, y: top + TAG_INSET };
}

/* ───────────────────── EDITOR E3.2 · B1 · desplazamiento preciso de reveal ─────────────────────
 * Sólo cambia CÓMO la tienda lleva a la sección que pide el ERP (mismo mensaje
 * `reveal`, mismas validaciones): no desplaza si ya está en su lugar, espera de forma
 * acotada una sección que todavía no se pintó, corrige una sola vez al terminar y
 * cualquier selección nueva o intervención del comercio cancela lo pendiente.
 */

/** Distancia entre el encabezado fijo y el borde superior de la sección revelada (px). */
export const REVEAL_INSET = 8;
/** Tope de espera de una sección que todavía no se pintó (productos que llegan, etc.). */
export const REVEAL_WAIT_MS = 2500;
/** Sin eventos de scroll durante este tiempo, el desplazamiento terminó. */
export const REVEAL_SETTLE_MS = 180;
/** Diferencia tolerada antes de corregir (px). */
export const REVEAL_TOLERANCE = 2;

/** scrollY que deja la sección `REVEAL_INSET` px debajo del encabezado (dentro de lo que la página permite). */
export function revealTarget(docTop: number, clipTop: number, maxScroll: number): number {
  return Math.round(Math.min(Math.max(docTop - clipTop - REVEAL_INSET, 0), Math.max(maxScroll, 0)));
}

/**
 * ¿Hay que desplazar? null = no: ya está en su lugar (o la página no permite
 * acercarla más), o su borde superior ya se ve en la franja de arriba (debajo del
 * encabezado, dentro del 35 % superior del área útil, mínimo 48 px). Si no, el
 * scrollY destino.
 */
export function revealPlan(p: { docTop: number; scrollY: number; clipTop: number; viewH: number; maxScroll: number }): number | null {
  const target = revealTarget(p.docTop, p.clipTop, p.maxScroll);
  if (Math.abs(target - p.scrollY) <= REVEAL_TOLERANCE) return null;
  const viewTop = p.docTop - p.scrollY;
  const band = Math.max(48, (p.viewH - p.clipTop) * 0.35);
  if (viewTop >= p.clipTop && viewTop <= p.clipTop + band) return null;
  return target;
}

/** Teclas con las que el comercio desplaza la página: cancelan un reveal en curso. */
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar']);

/**
 * Posición de una sección en el DOCUMENTO sin transformaciones: la entrada animada
 * (Reveal: translate-y + fade) se mide donde va a quedar, no a mitad de camino. Se
 * toma el primer hijo con caja (el envoltorio es `display: contents`) y se suman los
 * offsetTop de su cadena, que ignoran `transform`.
 */
function docTopOf(el: Element): number | null {
  for (const c of Array.from(el.children)) {
    if (!(c instanceof HTMLElement) || !c.getClientRects().length) continue;
    let y = 0;
    let n: HTMLElement | null = c;
    while (n) {
      y += n.offsetTop;
      n = n.offsetParent as HTMLElement | null;
    }
    return y;
  }
  return null;
}

/**
 * Borde inferior del encabezado fijo, en px del viewport. Es el contenedor sticky
 * de Layout, que mide su alto real (offsetHeight, con ResizeObserver) y lo publica
 * como `--header-h`; como está pegado a `top: 0`, su borde inferior es ese alto.
 * Sin la variable (otra página, encabezado no montado) no se recorta nada.
 */
function headerBottomOf(win: Window): number {
  const h = parseFloat(win.getComputedStyle(win.document.documentElement).getPropertyValue('--header-h'));
  return Number.isFinite(h) && h > 0 ? Math.min(h, win.innerHeight) : 0;
}

/**
 * Eventos que en modo selección no deben llegar a la tienda (navegar, comprar,
 * enviar, menú contextual con "abrir en pestaña nueva"): se cancelan
 * (preventDefault) y no se propagan. `pointerup`/`mouseup` no tienen acción por
 * defecto, pero un componente podría actuar en ellos; cancelarlos no impide el
 * `click` que selecciona.
 */
const BLOCKED_EVENTS = ['click', 'auxclick', 'dblclick', 'submit', 'mousedown', 'pointerdown', 'pointerup', 'mouseup', 'contextmenu'] as const;

/**
 * Toques: sólo se corta la PROPAGACIÓN (ningún componente los recibe), sin
 * preventDefault y en modo pasivo. Así el scroll táctil sigue siendo el del
 * navegador y el `click` que el navegador genera al final del toque llega a la
 * captura de arriba, que selecciona la sección y lo cancela.
 */
const TOUCH_EVENTS = ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const;

/**
 * Teclado: Enter y Espacio no llegan a los componentes (atajos tipo "Enter aplica
 * el cupón"). Tampoco acá se cancela la acción por defecto: activar un enlace o
 * botón con el teclado produce un `click` (y un formulario, un `submit`), que la
 * captura de arriba bloquea, y escribir un espacio en un campo sigue funcionando.
 * Tab, Escape, flechas y el resto de las teclas pasan sin tocar.
 */
const KEY_EVENTS = ['keydown', 'keyup', 'keypress'] as const;
const isActivationKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar';

/**
 * Conecta la capa con el canal de esta pestaña. Se llama una vez (main.tsx). No
 * instala nada hasta que el ERP activa la selección, y desinstala todo al apagarse.
 */
export function initPreviewInspect(channel: PreviewChannel | null, w?: Window): void {
  if (!channel || channel.state === 'public') return; // visita pública: nada
  const win = w ?? window;
  const doc = win.document;
  let overlay: Overlay | null = null;
  // Se guarda la CLAVE, no el elemento: mientras el inicio se pinta (productos que
  // llegan, secciones que aparecen) React puede remontar el envoltorio, y un
  // elemento guardado quedaría desconectado. Se resuelve en cada redibujado.
  let hoverKey: string | null = null;
  let selectedKey: string | null = null;
  let raf = 0;
  let ro: ResizeObserver | null = null;
  // E3.1.1: las etiquetas permanentes dependen de qué secciones hay pintadas. Una sección
  // puede aparecer o cambiar sin que cambie el alto del body (lo único que ve `ro`):
  // nodos agregados o quitados y imágenes que terminan de cargar también redibujan.
  // Todo pasa por `schedule`: a lo sumo un redibujado por cuadro.
  let mo: MutationObserver | null = null;

  const elementOf = (key: string | null) => (key ? doc.querySelector(`[${SECTION_ATTR}="${key}"]`) : null);
  const keyOf = (el: Element | null) => (el ? el.getAttribute(SECTION_ATTR) : null);

  const paint = () => {
    raf = 0;
    if (!overlay) return;
    // 1) Medir todo (sin escribir nada en el medio: un solo cálculo de layout por cuadro).
    // Nada de la capa se dibuja encima del encabezado fijo: se recorta en su borde
    // inferior real, que se vuelve a medir en cada redibujado (scroll, resize, cambios de alto).
    const clipTop = headerBottomOf(win);
    const viewW = win.innerWidth;
    const viewH = win.innerHeight;
    const boxOfKey = (key: string | null) => {
      const el = elementOf(key);
      return el ? boxOf(el) : null;
    };
    const hoverBox = hoverKey && hoverKey !== selectedKey ? boxOfKey(hoverKey) : null;
    const selBox = boxOfKey(selectedKey);
    const labelH = selBox ? overlay.label.offsetHeight : 0;
    const tagSpots = LABELED_SECTIONS.map((key) => [
      key,
      // La seleccionada ya muestra su etiqueta sólida: la permanente se oculta.
      key === selectedKey ? null : tagPosition(boxOfKey(key), clipTop, viewW, viewH),
    ] as const);

    // 2) Escribir.
    overlay.root.style.clipPath = clipTop > 0 ? `inset(${clipTop}px 0 0 0)` : '';
    applyBox(overlay.hover, hoverBox);
    applyBox(overlay.selected, selBox);
    overlay.label.textContent = selectedKey ? SECTION_LABELS[selectedKey] || '' : '';
    // Sección con el borde superior detrás del encabezado: la etiqueta baja hasta
    // la parte visible (sin salirse de la caja; si la sección quedó toda debajo
    // del encabezado, el recorte la oculta junto con el contorno).
    const shift = selBox ? Math.max(0, Math.min(clipTop - selBox.top, selBox.height - labelH)) : 0;
    overlay.label.style.top = `${shift}px`;
    for (const [key, spot] of tagSpots) {
      const t = overlay.tags.get(key)!;
      if (!spot) {
        t.style.display = 'none';
        continue;
      }
      t.style.display = 'block';
      t.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px)`;
    }
    // E3.2 B1: una sección pedida que todavía no estaba pintada se busca de nuevo en el
    // mismo redibujado (lo disparan los observadores de E3.1.1: nodos nuevos, cargas,
    // cambios de alto). Sólo mientras hay un reveal esperando.
    if (pend?.phase === 'wait') tryReveal();
  };
  const schedule = () => {
    if (!raf) raf = win.requestAnimationFrame(paint);
  };

  // E3.2 B1 · reveal en curso. 'wait': la sección todavía no se pintó (tope
  // REVEAL_WAIT_MS); 'scroll': se la está llevando a su lugar y, al terminar el
  // desplazamiento, se corrige una sola vez. Un reveal nuevo, un clic que selecciona,
  // la rueda, un toque, las teclas de desplazamiento o apagar la selección lo cancelan.
  // `force`: el pedido interrumpió un desplazamiento en curso. Ese scroll suave sigue
  // hacia la sección ANTERIOR si no se lo reemplaza, y a mitad de camino la nueva puede
  // pasar por la franja de arriba: en ese caso se desplaza igual, al destino exacto.
  // `ticket` (E3.2 B2): el ERP pidió confirmación. Se confirma UNA vez, sólo si el pedido
  // termina (ubicada: found true; venció la espera: found false); cancelado, nunca.
  type Pending = { key: string; phase: 'wait' | 'scroll'; target: number; settle: number; force: boolean; ticket: RevealTicket | null };
  let pend: Pending | null = null;
  let waitTimer = 0;
  const maxScrollOf = () => doc.documentElement.scrollHeight - win.innerHeight;
  const onUserScroll = () => cancelReveal();
  /** E3.2 B2: termina el pedido vigente confirmando el resultado (si lo pidieron). */
  const finishReveal = (found: boolean) => {
    const p = pend;
    cancelReveal();
    if (p?.ticket) channel.revealed(p.ticket, p.key, found);
  };
  function cancelReveal() {
    if (!pend) return;
    win.clearTimeout(waitTimer);
    win.clearTimeout(pend.settle);
    win.removeEventListener('wheel', onUserScroll, { capture: true });
    pend = null;
  }
  const armSettle = () => {
    if (!pend) return;
    win.clearTimeout(pend.settle);
    pend.settle = win.setTimeout(settled, REVEAL_SETTLE_MS);
  };
  /** Terminó el desplazamiento: se vuelve a medir y, si algo se movió (imágenes de arriba
   * que cargaron, secciones que crecieron), se corrige UNA vez, sin animación. Si el scroll
   * no quedó donde se lo mandó, lo movió el comercio (barra de desplazamiento): no se corrige. */
  function settled() {
    const p = pend;
    if (!p) return;
    const el = elementOf(p.key);
    const docTop = el ? docTopOf(el) : null;
    if (Math.abs(win.scrollY - p.target) > REVEAL_TOLERANCE) {
      cancelReveal(); // lo movió el comercio: ni corrección ni confirmación (E3.2 B2)
      return;
    }
    if (docTop === null) {
      cancelReveal(); // la sección se fue a mitad de camino (se remontó o se ocultó)
      return;
    }
    const target = revealTarget(docTop, headerBottomOf(win), maxScrollOf());
    if (Math.abs(target - win.scrollY) > REVEAL_TOLERANCE) win.scrollTo({ top: target, behavior: 'auto' });
    finishReveal(true);
  }
  /** Lleva a la sección pendiente si ya está pintada; si no, sigue esperando. */
  function tryReveal() {
    const p = pend;
    if (!p || p.phase !== 'wait') return;
    const el = elementOf(p.key);
    const docTop = el && boxOf(el) ? docTopOf(el) : null;
    if (docTop === null) return; // todavía no se pintó (o está vacía): sigue esperando hasta el tope
    const clipTop = headerBottomOf(win);
    let target = revealPlan({ docTop, scrollY: win.scrollY, clipTop, viewH: win.innerHeight, maxScroll: maxScrollOf() });
    if (target === null && p.force) target = revealTarget(docTop, clipTop, maxScrollOf());
    if (target === null) {
      finishReveal(true); // ya está en su lugar: sólo se marca
      return;
    }
    win.clearTimeout(waitTimer);
    p.phase = 'scroll';
    p.target = target;
    const reduce = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    win.scrollTo({ top: target, behavior: reduce ? 'auto' : 'smooth' });
    armSettle(); // por si no hay ningún evento de scroll (destino igual al actual)
  }
  const onScroll = () => {
    schedule();
    if (pend?.phase === 'scroll') armSettle();
  };

  const onMove = (e: Event) => {
    const next = keyOf(sectionElementOf(e.target));
    if (next !== hoverKey) {
      hoverKey = next;
      schedule();
    }
  };
  const onLeave = (e: MouseEvent) => {
    if (!e.relatedTarget) {
      hoverKey = null;
      schedule();
    }
  };
  const onBlocked = (e: Event) => {
    // Nada de la tienda reacciona: ni enlaces, ni botones, ni formularios.
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (e.type !== 'click') return;
    const key = keyOf(sectionElementOf(e.target));
    if (!key) return;
    cancelReveal(); // E3.2 B1: el comercio eligió otra cosa
    selectedKey = key;
    schedule();
    channel.select(key, pageOf(win.location.pathname));
  };
  const onTouch = (e: Event) => {
    if (pend) cancelReveal(); // E3.2 B1: el comercio toca o desliza la vista previa
    e.stopPropagation();
    e.stopImmediatePropagation();
  };
  const onKey = (e: KeyboardEvent) => {
    if (pend && e.type === 'keydown' && SCROLL_KEYS.has(e.key)) cancelReveal(); // E3.2 B1
    if (!isActivationKey(e)) return;
    e.stopPropagation();
    e.stopImmediatePropagation();
  };
  // iOS: mantener apretado un enlace abre el menú del sistema ("Abrir en pestaña
  // nueva") sin disparar `contextmenu`. Se apaga sólo mientras se selecciona (los
  // motores que no conocen la propiedad la ignoran) y se restaura tal cual estaba.
  const CALLOUT = '-webkit-touch-callout';
  let prevCallout: [string, string] = ['', ''];

  const reveal = (section: string | null, ticket: RevealTicket | null = null) => {
    const force = pend?.phase === 'scroll';
    cancelReveal(); // gana el último pedido
    selectedKey = section && isSelectableSection(section) ? section : null;
    schedule();
    if (!selectedKey) {
      // E3.2 B2: una clave que esta tienda no marca nunca va a aparecer: no hay espera.
      if (ticket && section) channel.revealed(ticket, section, false);
      return;
    }
    // E3.2 B1: si la sección no está pintada todavía, se espera (acotado) a que aparezca;
    // si no aparece en el plazo (oculta, sin datos, otra página) no se desplaza nada.
    pend = { key: selectedKey, phase: 'wait', target: 0, settle: 0, force, ticket };
    // Venció la espera sin que la sección aparezca: no se desplaza y, si lo pidieron, se
    // confirma que no se encontró (oculta, vacía, sin datos u otra página).
    waitTimer = win.setTimeout(() => finishReveal(false), REVEAL_WAIT_MS);
    win.addEventListener('wheel', onUserScroll, { capture: true, passive: true });
    tryReveal();
  };

  const install = () => {
    if (overlay) return;
    overlay = makeOverlay(doc);
    doc.documentElement.dataset.pcInspect = 'on';
    for (const t of BLOCKED_EVENTS) win.addEventListener(t, onBlocked, { capture: true, passive: false });
    for (const t of TOUCH_EVENTS) win.addEventListener(t, onTouch, { capture: true, passive: true });
    for (const t of KEY_EVENTS) win.addEventListener(t, onKey as EventListener, true);
    const rs = doc.documentElement.style;
    prevCallout = [rs.getPropertyValue(CALLOUT), rs.getPropertyPriority(CALLOUT)];
    rs.setProperty(CALLOUT, 'none');
    win.addEventListener('mouseover', onMove, true);
    doc.addEventListener('mouseout', onLeave, true);
    win.addEventListener('scroll', onScroll, true);
    win.addEventListener('resize', schedule);
    win.addEventListener('pagehide', uninstall);
    // El contenido cambia de alto sin scroll (imágenes que terminan de cargar): se redibuja.
    if (typeof ResizeObserver !== 'undefined' && doc.body) {
      ro = new ResizeObserver(schedule);
      ro.observe(doc.body);
    }
    if (typeof MutationObserver !== 'undefined' && doc.body) {
      mo = new MutationObserver(schedule);
      mo.observe(doc.body, { childList: true, subtree: true });
    }
    win.addEventListener('load', schedule, true); // imágenes (load no burbujea: captura)
    // Animaciones de entrada (fade/slide al aparecer): mueven la sección sin cambiar el
    // DOM ni su tamaño; al terminar se redibuja para que la etiqueta quede en su lugar.
    win.addEventListener('animationend', schedule, true);
    win.addEventListener('transitionend', schedule, true);
    schedule(); // primer dibujado: las etiquetas aparecen sin esperar un movimiento
  };

  function uninstall() {
    if (!overlay) return;
    cancelReveal();
    for (const t of BLOCKED_EVENTS) win.removeEventListener(t, onBlocked, { capture: true });
    for (const t of TOUCH_EVENTS) win.removeEventListener(t, onTouch, { capture: true });
    for (const t of KEY_EVENTS) win.removeEventListener(t, onKey as EventListener, true);
    if (prevCallout[0]) doc.documentElement.style.setProperty(CALLOUT, prevCallout[0], prevCallout[1]);
    else doc.documentElement.style.removeProperty(CALLOUT);
    win.removeEventListener('mouseover', onMove, true);
    doc.removeEventListener('mouseout', onLeave, true);
    win.removeEventListener('scroll', onScroll, true);
    win.removeEventListener('resize', schedule);
    win.removeEventListener('pagehide', uninstall);
    ro?.disconnect();
    ro = null;
    mo?.disconnect();
    mo = null;
    win.removeEventListener('load', schedule, true);
    win.removeEventListener('animationend', schedule, true);
    win.removeEventListener('transitionend', schedule, true);
    if (raf) win.cancelAnimationFrame(raf);
    raf = 0;
    overlay.root.remove();
    overlay = null;
    hoverKey = null;
    selectedKey = null;
    delete doc.documentElement.dataset.pcInspect;
  }

  channel.onInspect((e) => {
    if (e.type === 'inspect') {
      if (e.on) install();
      else uninstall();
      return;
    }
    if (overlay) reveal(e.section, e.ticket);
  });
}
