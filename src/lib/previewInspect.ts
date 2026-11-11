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
 *  - Mientras está activa, NINGÚN clic llega a la tienda: no navega, no agrega al
 *    carrito, no compra. Con la selección apagada la tienda se comporta como hoy
 *    (y las operaciones reales siguen bloqueadas por E2.0).
 *
 * La capa se dibuja en un nodo propio colgado de <html>, fuera del árbol de React,
 * con `pointer-events: none`: no cambia el layout ni intercepta nada por sí misma.
 */
import type { PreviewChannel, PreviewPage } from './previewChannel';

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
}

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
  doc.documentElement.appendChild(root);
  return { root, hover, selected, label };
}

function place(div: HTMLDivElement, el: Element | null) {
  const b = el ? boxOf(el) : null;
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
 * Eventos que en modo selección no deben llegar a la tienda (navegar, comprar,
 * enviar, arrastrar carruseles). `touchstart` NO: bloquearlo impediría hacer
 * scroll táctil dentro de la vista previa; el `click` que sigue al toque sí se corta.
 */
const BLOCKED_EVENTS = ['click', 'auxclick', 'dblclick', 'submit', 'mousedown', 'pointerdown'] as const;

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

  const elementOf = (key: string | null) => (key ? doc.querySelector(`[${SECTION_ATTR}="${key}"]`) : null);
  const keyOf = (el: Element | null) => (el ? el.getAttribute(SECTION_ATTR) : null);

  const paint = () => {
    raf = 0;
    if (!overlay) return;
    place(overlay.hover, hoverKey && hoverKey !== selectedKey ? elementOf(hoverKey) : null);
    place(overlay.selected, elementOf(selectedKey));
    overlay.label.textContent = selectedKey ? SECTION_LABELS[selectedKey] || '' : '';
  };
  const schedule = () => {
    if (!raf) raf = win.requestAnimationFrame(paint);
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
    selectedKey = key;
    schedule();
    channel.select(key, pageOf(win.location.pathname));
  };

  const reveal = (section: string | null) => {
    selectedKey = section && isSelectableSection(section) ? section : null;
    schedule();
    const el = elementOf(selectedKey);
    const b = el ? boxOf(el) : null;
    if (!b) return; // no está en esta página o no se pinta (apagada, sin datos)
    const headerH = parseFloat(getComputedStyle(doc.documentElement).getPropertyValue('--header-h')) || 0;
    const reduce = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    win.scrollTo({ top: Math.max(0, b.top + win.scrollY - headerH - 8), behavior: reduce ? 'auto' : 'smooth' });
  };

  const install = () => {
    if (overlay) return;
    overlay = makeOverlay(doc);
    doc.documentElement.dataset.pcInspect = 'on';
    for (const t of BLOCKED_EVENTS) win.addEventListener(t, onBlocked, { capture: true, passive: false });
    win.addEventListener('mouseover', onMove, true);
    doc.addEventListener('mouseout', onLeave, true);
    win.addEventListener('scroll', schedule, true);
    win.addEventListener('resize', schedule);
    win.addEventListener('pagehide', uninstall);
    // El contenido cambia de alto sin scroll (imágenes que terminan de cargar): se redibuja.
    if (typeof ResizeObserver !== 'undefined' && doc.body) {
      ro = new ResizeObserver(schedule);
      ro.observe(doc.body);
    }
  };

  function uninstall() {
    if (!overlay) return;
    for (const t of BLOCKED_EVENTS) win.removeEventListener(t, onBlocked, { capture: true });
    win.removeEventListener('mouseover', onMove, true);
    doc.removeEventListener('mouseout', onLeave, true);
    win.removeEventListener('scroll', schedule, true);
    win.removeEventListener('resize', schedule);
    win.removeEventListener('pagehide', uninstall);
    ro?.disconnect();
    ro = null;
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
    if (overlay) reveal(e.section);
  });
}
