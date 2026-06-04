// SEO dinámico sin dependencias (React 19-safe). Manejamos imperativamente un
// set fijo de tags en <head>: title, description, Open Graph, Twitter Card,
// canonical y robots. Cada página llama applySeo() y siempre escribimos TODO el
// set, así navegar de una página a otra (o de un 404 noindex a Home) resetea
// los valores correctamente (last-write-wins).

export interface SeoInput {
  title: string;
  description?: string;
  image?: string;
  /** Path canónico (ej: "/producto/123"). Default: location.pathname. */
  path?: string;
  type?: 'website' | 'product' | 'article';
  /** Slug del tenant para construir el canonical {slug}.procurva.app. */
  slug?: string;
  siteName?: string;
  /** true → noindex,nofollow (carrito, checkout, 404). */
  noindex?: boolean;
}

const PROD_BASE = 'procurva.app';

/** Construye la URL canónica https://{slug}.procurva.app{path}. */
function canonicalUrl(slug: string | undefined, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (slug) return `https://${slug}.${PROD_BASE}${clean === '/' ? '' : clean}`;
  // Sin slug (dev / host genérico): usar el origin actual.
  if (typeof window !== 'undefined') return `${window.location.origin}${clean}`;
  return clean;
}

function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Aplica todos los meta tags de SEO de la página actual. */
export function applySeo(input: SeoInput): void {
  if (typeof document === 'undefined') return;
  const {
    title,
    description = '',
    image = '',
    path = typeof window !== 'undefined' ? window.location.pathname : '/',
    type = 'website',
    slug,
    siteName = title,
    noindex = false,
  } = input;

  const url = canonicalUrl(slug, path);

  document.title = title;
  if (description) setMeta('name', 'description', description);

  setMeta('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow');

  // Open Graph.
  setMeta('property', 'og:title', title);
  if (description) setMeta('property', 'og:description', description);
  setMeta('property', 'og:type', type);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:site_name', siteName);
  if (image) setMeta('property', 'og:image', image);

  // Twitter Card.
  setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
  setMeta('name', 'twitter:title', title);
  if (description) setMeta('name', 'twitter:description', description);
  if (image) setMeta('name', 'twitter:image', image);

  // Canonical.
  setLink('canonical', url);
}
