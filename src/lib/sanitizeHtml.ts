// Sanitizador mínimo de HTML para el cuerpo de las secciones custom de tipo
// "texto". El contenido lo escribe el dueño de la tienda en el admin, pero igual
// lo saneamos por higiene: permitimos sólo formato básico y descartamos scripts,
// estilos, iframes, atributos on* y URLs no http/mailto.

const ALLOWED_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'A', 'UL', 'OL', 'LI', 'SPAN', 'H3', 'H4']);
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'FORM', 'INPUT']);
const ALLOWED_ATTR: Record<string, Set<string>> = { A: new Set(['href', 'target', 'rel']) };
const EMPTY = new Set<string>();

function sanitizeEl(el: Element): void {
  Array.from(el.childNodes).forEach((child) => {
    if (child.nodeType === 1) sanitizeEl(child as Element);
  });

  Array.from(el.childNodes).forEach((child) => {
    if (child.nodeType === 8) {
      child.parentNode?.removeChild(child);
      return;
    }
    if (child.nodeType !== 1) return;
    const c = child as Element;
    const tag = c.tagName.toUpperCase();

    if (DROP_TAGS.has(tag)) {
      c.parentNode?.removeChild(c);
      return;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      const parent = c.parentNode;
      if (parent) {
        while (c.firstChild) parent.insertBefore(c.firstChild, c);
        parent.removeChild(c);
      }
      return;
    }

    const allowed = ALLOWED_ATTR[tag] || EMPTY;
    Array.from(c.attributes).forEach((a) => {
      const name = a.name.toLowerCase();
      if (name.startsWith('on') || !allowed.has(name)) c.removeAttribute(a.name);
    });

    if (tag === 'A') {
      const href = c.getAttribute('href') || '';
      if (!/^(https?:|mailto:)/i.test(href)) c.removeAttribute('href');
      c.setAttribute('target', '_blank');
      c.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });
}

/** Devuelve `html` saneado a un subconjunto seguro de etiquetas de formato. */
export function sanitizeBasicHtml(html: string): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]*>/g, '');
  }
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';
  sanitizeEl(root);
  return root.innerHTML;
}
