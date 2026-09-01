// Serverless (Vercel): sitemap.xml dinámico por tenant. Resuelve la tienda desde
// el Host (subdominio {slug}.procurva.app o dominio propio) y lista las URLs de
// productos y categorías.
//
// Ruta: vercel.json reescribe /sitemap.xml → /api/sitemap (antes del catch-all SPA).
//
// Lee Supabase vía la REST API (PostgREST) con la anon key — sólo datos públicos.
// Env: SUPABASE_URL / SUPABASE_ANON_KEY (o las VITE_*).


const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

async function rest(path: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return [];
  return (await res.json().catch(() => [])) as any[];
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req: any, res: any) {
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();
  // El origin es SIEMPRE el host del request: en dominio propio el sitemap tiene
  // que listar las URLs de ese dominio, no las del subdominio.
  const origin = `https://${host}`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');

  const urls: string[] = [];
  const push = (loc: string, priority = '0.7') =>
    urls.push(`  <url><loc>${xmlEscape(loc)}</loc><priority>${priority}</priority></url>`);

  // Páginas estáticas (siempre presentes).
  push(`${origin}/`, '1.0');
  push(`${origin}/productos`, '0.9');
  push(`${origin}/categorias`, '0.8');

  try {
    const tenant = await resolveTenantFromHost(host, SUPABASE_URL, SUPABASE_ANON_KEY);
    if (tenant) {
      // El filtro de catálogo de ESTA tienda: con dos marcas sobre un mismo
      // stock, sin esto la marca B le declara a Google los productos de la A.
      const products = await rest(
        `products?company_id=eq.${tenant.companyId}&catalog_visible=eq.true&select=id,categories` +
          productFilterQuery(tenant.productFilter),
      );
      const categories = new Set<string>();
      for (const p of products) {
        push(`${origin}/producto/${p.id}`, '0.8');
        if (Array.isArray(p.categories)) {
          for (const c of p.categories) if (c) categories.add(String(c));
        }
      }
      for (const c of categories) {
        push(`${origin}/categoria/${encodeURIComponent(c)}`, '0.7');
      }
    }
  } catch (e) {
    // Ante cualquier fallo devolvemos al menos las páginas estáticas.
    console.error('[sitemap] error', e);
  }

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') +
    '\n</urlset>\n';

  res.status(200).send(xml);
}

// --- Resolución de tenant (subdominio o dominio propio) ---------------------
// Duplicado a propósito en sitemap.ts y feed/[format].ts: estas funciones corren
// como ESM en Vercel y un import relativo a un módulo compartido revienta en
// runtime. Si tocás una, tocá la otra.
const BASE_DOMAIN = 'procurva.app';
const RESERVED = new Set(['www', 'app']);

// Filtro de catálogo de la tienda. Espeja src/lib/productFilter.ts; duplicado en
// feed/[format].ts por la misma razón que resolveTenantFromHost.
interface ProductFilter {
  mode: 'all' | 'brand' | 'category' | 'segment';
  values: string[];
}
const ALL_PRODUCTS: ProductFilter = { mode: 'all', values: [] };

function filterFromPayload(payload: any): ProductFilter {
  const raw = payload?.product_filter;
  if (!raw || typeof raw !== 'object') return ALL_PRODUCTS;
  const mode = raw.mode;
  if (mode !== 'brand' && mode !== 'category' && mode !== 'segment') return ALL_PRODUCTS;
  const values = Array.isArray(raw.values)
    ? raw.values.filter((v: unknown): v is string => typeof v === 'string' && v.trim() !== '')
    : [];
  return { mode, values };
}

/** Fragmento de query-string de PostgREST. '' si el filtro no recorta nada. */
function productFilterQuery(filter: ProductFilter): string {
  if (filter.mode === 'all' || filter.values.length === 0) return '';
  // Comillas dobles: una marca puede traer comas o paréntesis, que en PostgREST
  // separan los elementos de la lista.
  const list = filter.values.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(',');
  // categories es text[]: overlaps = comparte al menos una.
  const column = filter.mode === 'category' ? 'categories' : filter.mode;
  const op = filter.mode === 'category' ? `ov.{${list}}` : `in.(${list})`;
  return `&${column}=${encodeURIComponent(op)}`;
}

interface TenantInfo {
  companyId: string;
  /** Slug real de la tienda que se sirve (puede venir del payload de la RPC). */
  slug: string;
  /** Nombre del comercio, para el título del feed. */
  brand: string;
  /** Qué productos muestra ESTA tienda (multi-tienda por marca). */
  productFilter: ProductFilter;
}

/** Host sin puerto, en minúsculas. */
function normalizeHost(raw: unknown): string {
  return (raw ?? '').toString().toLowerCase().split(':')[0].trim();
}

/** Slug del subdominio. null si el host NO es {slug}.procurva.app. */
function slugFromHost(host: string): string | null {
  if (!host.endsWith(`.${BASE_DOMAIN}`)) return null;
  const sub = host.slice(0, host.length - BASE_DOMAIN.length - 1).split('.')[0];
  if (!sub || RESERVED.has(sub)) return null;
  return sub;
}

async function restRows(base: string, key: string, path: string): Promise<any[]> {
  try {
    const res = await fetch(`${base}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return [];
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function rpc(base: string, key: string, fn: string, body: unknown): Promise<any | null> {
  try {
    const res = await fetch(`${base}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

/** Payload de get_storefront_by_{slug,custom_domain} → TenantInfo. */
function fromPayload(payload: any, fallbackSlug: string | null): TenantInfo | null {
  if (!payload || !payload.company_id) return null;
  // Tienda en construcción / cuenta suspendida: no exponemos su catálogo.
  if (payload.active === false) return null;
  const slug = (payload.slug || fallbackSlug || '').toString();
  return {
    companyId: payload.company_id as string,
    slug,
    brand: (payload.name || slug || 'ProCurva').toString().trim(),
    productFilter: filterFromPayload(payload),
  };
}

/**
 * Resuelve el tenant del request. Devuelve null si el host no es una tienda
 * (apex de procurva.app, preview de Vercel, dominio sin verificar).
 */
async function resolveTenantFromHost(
  rawHost: unknown,
  supabaseUrl: string,
  anonKey: string,
): Promise<TenantInfo | null> {
  const host = normalizeHost(rawHost);
  if (!host || !supabaseUrl || !anonKey) return null;

  const slug = slugFromHost(host);
  if (slug) {
    // Camino histórico: columnas legacy del catálogo, una sola query.
    const rows = await restRows(
      supabaseUrl,
      anonKey,
      `companies?catalog_slug=eq.${encodeURIComponent(slug)}&catalog_enabled=eq.true&select=id,name&limit=1`,
    );
    if (rows[0]?.id) {
      return {
        companyId: rows[0].id,
        slug,
        brand: (rows[0].name || slug).toString().trim(),
        productFilter: ALL_PRODUCTS,
      };
    }
    // Una tienda puede vivir SÓLO en storefront_config (sin catalog_slug): ahí el
    // que sabe es el resolver público.
    return fromPayload(await rpc(supabaseUrl, anonKey, 'get_storefront_by_slug', { p_slug: slug }), slug);
  }

  // Cualquier otro host: candidato a dominio propio.
  return fromPayload(
    await rpc(supabaseUrl, anonKey, 'get_storefront_by_custom_domain', { p_domain: host }),
    null,
  );
}
