// Serverless (Vercel): identidad de la tienda ANTES de que corra el JS.
//
// El index.html es el mismo archivo estático para todas las tiendas: trae la "P"
// de ProCurva como ícono y "Tienda online" como título. La SPA los pisa al cargar
// (src/lib/theme.ts → applyDocumentMeta), pero quien NO ejecuta JS —Google
// buscando el favicon, la vista previa de un link en WhatsApp/Facebook, un
// favorito guardado— se quedaba con la "P". Esta función resuelve la tienda por
// el Host y devuelve:
//
//   /favicon.ico -> /api/site/favicon  302 al favicon de la tienda (o al logo si
//                                      es un PNG cuadrado; si no, la "P").
//   bots         -> /api/site/html     el index.html estático con título,
//                                      descripción, og:image e ícono de la tienda.
//
// El rewrite de /api/site/html en vercel.json va SOLO para user-agents de bots
// (`has` por header): los visitantes siguen recibiendo el index.html estático
// directo del CDN, sin pasar por una función.
//
// Ruta dinámica como feed/[format].ts: el segmento llega en req.query.kind (nada
// de query string en el destination del rewrite, ver reference_vercel_spa_api_routing).

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const DEFAULT_ICON = '/favicon.svg';
const CACHE = 'public, max-age=600, s-maxage=600, stale-while-revalidate=86400';

export default async function handler(req: any, res: any) {
  const kind = String(req.query?.kind || '');
  const host = normalizeHost(req.headers['x-forwarded-host'] || req.headers.host);

  let store: StoreMeta | null = null;
  try {
    store = await resolveStore(host);
  } catch (e) {
    console.error('[site] error resolviendo tienda', host, e);
  }

  if (kind === 'favicon') {
    const icon = store ? await pickIcon(store) : '';
    res.setHeader('Cache-Control', CACHE);
    res.setHeader('Location', icon || DEFAULT_ICON);
    res.status(302).end();
    return;
  }

  if (kind === 'html') {
    const html = await fetchIndexHtml(host);
    if (!html) {
      res.status(502).send('');
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', CACHE);
    const icon = store ? await pickIcon(store) : '';
    res.status(200).send(store ? injectMeta(html, store, host, icon) : html);
    return;
  }

  res.status(404).send('');
}

// --- Datos de la tienda -------------------------------------------------------

interface StoreMeta {
  name: string;
  title: string;
  description: string;
  image: string;
  favicon: string;
  logo: string;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Mismo criterio que normalizeStoreConfig (src/lib/storeConfig.ts). */
function toStoreMeta(payload: any): StoreMeta | null {
  if (!payload || !payload.company_id) return null;
  const s = payload.settings && typeof payload.settings === 'object' ? payload.settings : {};
  const name = str(payload.name) || 'Tienda';
  return {
    name,
    title: str(s.meta_title) || name,
    description: str(s.meta_description),
    image: str(s.og_image_url) || str(s.banner_url),
    favicon: str(s.favicon_url),
    logo: str(s.logo_url) || str(payload.logo_url),
  };
}

// Duplicado a propósito de sitemap.ts / feed/[format].ts: un import relativo a un
// módulo compartido revienta en runtime en Vercel (ESM).
const BASE_DOMAIN = 'procurva.app';
const RESERVED = new Set(['www', 'app']);

function normalizeHost(raw: unknown): string {
  return (raw ?? '').toString().toLowerCase().split(':')[0].trim();
}

function slugFromHost(host: string): string | null {
  if (!host.endsWith(`.${BASE_DOMAIN}`)) return null;
  const sub = host.slice(0, host.length - BASE_DOMAIN.length - 1).split('.')[0];
  if (!sub || RESERVED.has(sub)) return null;
  return sub;
}

async function rpc(fn: string, body: unknown): Promise<any | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return Array.isArray(data) ? data[0] ?? null : data;
  } catch {
    return null;
  }
}

/** Las mismas RPCs públicas que usa la SPA (StoreProvider), así ven lo mismo. */
async function resolveStore(host: string): Promise<StoreMeta | null> {
  if (!host || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const slug = slugFromHost(host);
  const payload = slug
    ? await rpc('get_storefront_by_slug', { p_slug: slug })
    : await rpc('get_storefront_by_custom_domain', { p_domain: host });
  return toStoreMeta(payload);
}

// --- Ícono --------------------------------------------------------------------

/**
 * Favicon cargado; si no hay, el logo cuando es un PNG más o menos cuadrado
 * (mismo criterio que applyDocumentMeta en el cliente: un logo horizontal a
 * 16px no se lee). Del PNG alcanza con el encabezado IHDR para saber el tamaño.
 */
async function pickIcon(store: StoreMeta): Promise<string> {
  if (store.favicon) return store.favicon;
  if (!store.logo) return '';
  try {
    const res = await fetch(store.logo, { headers: { Range: 'bytes=0-31' } });
    if (!res.ok) return '';
    const buf = new Uint8Array(await res.arrayBuffer());
    const isPng = buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    if (!isPng) return '';
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const w = view.getUint32(16);
    const h = view.getUint32(20);
    if (!w || !h) return '';
    const ratio = w / h;
    return ratio >= 0.8 && ratio <= 1.25 ? store.logo : '';
  } catch {
    return '';
  }
}

// --- HTML para bots -----------------------------------------------------------

/**
 * El HTML real del deploy, dist/app.html (ver scripts/spa-shell.mjs), con los
 * assets hasheados: así Google renderiza la SPA igual que siempre. Es un archivo
 * estático y Vercel lo sirve del filesystem antes de los rewrites, no hay loop.
 */
async function fetchIndexHtml(host: string): Promise<string> {
  const origin = host ? `https://${host}` : '';
  if (!origin) return '';
  try {
    const res = await fetch(`${origin}/app.html`, { headers: { 'User-Agent': 'procurva-site-meta' } });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

function attr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function injectMeta(html: string, store: StoreMeta, host: string, icon: string): string {
  const title = attr(store.title);
  const description = attr(store.description || `Comprá online en ${store.name}.`);
  // Sin imagen SEO ni banner, la vista previa del link muestra al menos la marca
  // (ícono o logo) en vez de salir sin imagen.
  const image = store.image || icon || store.logo;

  // Sacamos lo genérico del index.html y ponemos lo de la tienda.
  const out = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '')
    .replace(/<meta\s+property="og:title"[^>]*>/i, '')
    .replace(/<link\s+rel="icon"[^>]*>/i, icon ? `<link rel="icon" href="${attr(icon)}" id="favicon" />` : '$&');

  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:site_name" content="${attr(store.name)}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    host ? `<meta property="og:url" content="https://${attr(host)}/" />` : '',
    image ? `<meta property="og:image" content="${attr(image)}" />` : '',
    `<meta name="twitter:card" content="${store.image ? 'summary_large_image' : 'summary'}" />`,
    icon ? `<link rel="apple-touch-icon" href="${attr(icon)}" />` : '',
  ]
    .filter(Boolean)
    .join('\n    ');

  return out.replace(/<\/head>/i, `    ${tags}\n  </head>`);
}
