// Serverless (Vercel): feed de catálogo por tenant para Meta / Google / TikTok.
//
// Ruta dinámica: api/feed/[format].ts → el segmento [format] llega en req.query.format.
// vercel.json reescribe (ANTES del catch-all SPA, que excluye /api) a un PATH plano:
//   /feed/meta.xml    -> /api/feed/meta     (RSS 2.0 + namespace g:)
//   /feed/google.xml  -> /api/feed/google   (mismo formato base, Google Merchant)
//   /feed/tiktok.csv  -> /api/feed/tiktok   (CSV)
// (Ver [[reference_vercel_spa_api_routing]] por las 2 trampas: nada de query string en el
//  destination de un rewrite; el catch-all del SPA debe excluir /api.)
//
// Lo leen Meta/Google/TikTok desde SUS IPs cada ~4hs, SIN credenciales → read con anon key.
//
// FUENTE DE VERDAD ÚNICA de qué productos entran: la RPC public.marketing_feed_products
// (migración 20260713_marketing_feed_rules.sql). Este archivo YA NO calcula la regla de
// inclusión ni el precio ni la imagen: todo eso lo decide la RPC, que TAMBIÉN alimenta el
// contador de salud del admin. Acá solo se RENDERIZA lo que la RPC marca included=true. Si
// cambian las reglas, se cambian en la RPC y feed + admin quedan sincronizados por diseño.
//
// Reglas de render (fijas): una fila POR VARIANTE, item_group_id = product_id, id = UUID de
// variante, identifier_exists=no (marca propia, sin GTIN), availability por stock consolidado.
// Volumen: paginado por Range + streaming con res.write (catálogos grandes / curva surtida).


const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const PAGE_SIZE = 500; // productos por página (las variantes vienen embebidas en la RPC)
const MAX_ADDITIONAL_IMAGES = 10; // límite de Meta para additional_image_link

type Format = 'meta' | 'google' | 'tiktok';

interface Variant {
  id: string;
  size: string | null;
  color: string | null;
  stock: number | null;
  sku: string | null;
  image_url: string | null;
}
// Fila que devuelve public.marketing_feed_products (precio/imagen/inclusión ya resueltos).
interface FeedProduct {
  product_id: string;
  name: string | null;
  description: string | null;
  price: number | null;
  compare_at: number | null;
  image_link: string | null;
  images: string[] | null;
  categories: string[] | null;
  variants: Variant[] | null;
  included: boolean;
  exclude_reason: string | null;
}

/** GET a PostgREST con anon key. rangeFrom/rangeTo → paginado por Range. */
async function rest(path: string, rangeFrom?: number, rangeTo?: number): Promise<{ rows: any[]; error: boolean }> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (rangeFrom != null && rangeTo != null) {
    headers.Range = `${rangeFrom}-${rangeTo}`;
    headers['Range-Unit'] = 'items';
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) {
    console.error('[feed] REST error', res.status, await res.text().catch(() => ''));
    return { rows: [], error: true };
  }
  const rows = (await res.json().catch(() => [])) as any[];
  return { rows: Array.isArray(rows) ? rows : [], error: false };
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function csvField(s: string): string {
  return `"${String(s).replace(/"/g, '""')}"`;
}
function money(n: number): string {
  return `${n.toFixed(2)} ARS`;
}

interface Ctx {
  origin: string;
  brand: string;
}

/** Precio de lista y de oferta a partir de price/compare_at que da la RPC. */
function priceOf(p: FeedProduct): { regular: number; sale: number | null } {
  const price = Number(p.price || 0);
  const compare = p.compare_at != null && Number(p.compare_at) > price ? Number(p.compare_at) : null;
  return compare ? { regular: compare, sale: price } : { regular: price, sale: null };
}

/** Un <item> del feed XML (Meta/Google) para una variante, o '' si la variante se excluye. */
function xmlItem(p: FeedProduct, v: Variant, ctx: Ctx): string {
  const image = v.image_url || p.image_link;
  if (!image) return '';
  const title = (p.name || '').trim();
  const desc = stripHtml(p.description || p.name || '');
  const link = `${ctx.origin}/producto/${p.product_id}`;
  const availability = (v.stock ?? 0) > 0 ? 'in stock' : 'out of stock';
  const { regular, sale } = priceOf(p);

  const extra = (p.images || []).filter((u) => u && u !== image).slice(0, MAX_ADDITIONAL_IMAGES);
  const productType = (p.categories || []).filter(Boolean).join(' > ');

  const lines = [
    `    <item>`,
    `      <g:id>${xmlEscape(v.id)}</g:id>`,
    `      <g:item_group_id>${xmlEscape(p.product_id)}</g:item_group_id>`,
    `      <g:title>${xmlEscape(title)}</g:title>`,
    `      <g:description>${xmlEscape(desc)}</g:description>`,
    `      <g:link>${xmlEscape(link)}</g:link>`,
    `      <g:image_link>${xmlEscape(image)}</g:image_link>`,
    ...extra.map((u) => `      <g:additional_image_link>${xmlEscape(u)}</g:additional_image_link>`),
    `      <g:availability>${availability}</g:availability>`,
    `      <g:condition>new</g:condition>`,
    `      <g:price>${money(regular)}</g:price>`,
    ...(sale != null ? [`      <g:sale_price>${money(sale)}</g:sale_price>`] : []),
    `      <g:brand>${xmlEscape(ctx.brand)}</g:brand>`,
    `      <g:identifier_exists>no</g:identifier_exists>`,
    ...(v.size ? [`      <g:size>${xmlEscape(v.size)}</g:size>`] : []),
    ...(v.color ? [`      <g:color>${xmlEscape(v.color)}</g:color>`] : []),
    ...(productType ? [`      <g:product_type>${xmlEscape(productType)}</g:product_type>`] : []),
    `      <g:inventory>${Math.max(0, v.stock ?? 0)}</g:inventory>`,
    `    </item>`,
  ];
  return lines.join('\n') + '\n';
}

const CSV_HEADER =
  'sku_id,item_group_id,title,description,availability,condition,price,sale_price,link,image_link,brand,product_type,size,color\n';

/** Una fila CSV (TikTok) para una variante, o '' si se excluye. */
function csvRow(p: FeedProduct, v: Variant, ctx: Ctx): string {
  const image = v.image_url || p.image_link;
  if (!image) return '';
  const availability = (v.stock ?? 0) > 0 ? 'in stock' : 'out of stock';
  const { regular, sale } = priceOf(p);
  const productType = (p.categories || []).filter(Boolean).join(' > ');
  return (
    [
      csvField(v.id),
      csvField(p.product_id),
      csvField((p.name || '').trim()),
      csvField(stripHtml(p.description || p.name || '')),
      csvField(availability),
      csvField('new'),
      csvField(money(regular)),
      csvField(money(sale ?? regular)),
      csvField(`${ctx.origin}/producto/${p.product_id}`),
      csvField(image),
      csvField(ctx.brand),
      csvField(productType),
      csvField(v.size || ''),
      csvField(v.color || ''),
    ].join(',') + '\n'
  );
}

export default async function handler(req: any, res: any) {
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();
  // El origin es SIEMPRE el host del request: los links de los productos tienen
  // que apuntar al dominio por el que entró el crawler (propio o subdominio).
  const origin = `https://${host}`;

  const fmtRaw = (req.query?.format || '').toString().toLowerCase();
  const format: Format = fmtRaw === 'tiktok' ? 'tiktok' : fmtRaw === 'google' ? 'google' : 'meta';
  const isCsv = format === 'tiktok';

  // Resolvemos el tenant ANTES de escribir nada: el título del feed sale del
  // nombre del comercio y, por dominio propio, el tenant no se deduce del Host.
  let tenant: Awaited<ReturnType<typeof resolveTenantFromHost>> = null;
  try {
    tenant = await resolveTenantFromHost(host, SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.error('[feed] tenant', e);
  }

  res.statusCode = 200; // fijar ANTES del primer write (al streamear la cabecera se va con el 1er chunk).
  res.setHeader('Content-Type', isCsv ? 'text/csv; charset=utf-8' : 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600');

  if (isCsv) {
    res.write(CSV_HEADER);
  } else {
    res.write('<?xml version="1.0" encoding="UTF-8"?>\n');
    res.write('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n');
    res.write('  <channel>\n');
    res.write(`    <title>${xmlEscape(tenant?.brand || 'ProCurva')}</title>\n`);
    res.write(`    <link>${xmlEscape(origin)}</link>\n`);
    res.write('    <description>Catálogo de productos</description>\n');
  }

  try {
    if (tenant) {
      const ctx: Ctx = { origin, brand: tenant.brand };

      // Fuente de verdad: RPC marketing_feed_products (GET, STABLE). Paginado por Range.
      let from = 0;
      for (;;) {
        const to = from + PAGE_SIZE - 1;
        const { rows, error } = await rest(
          `rpc/marketing_feed_products?p_company_id=${encodeURIComponent(tenant.companyId)}`,
          from,
          to,
        );
        if (error) break;
        for (const p of rows as FeedProduct[]) {
          if (!p.included) continue; // la RPC ya decidió; acá solo renderizamos
          for (const v of p.variants || []) {
            const chunk = isCsv ? csvRow(p, v, ctx) : xmlItem(p, v, ctx);
            if (chunk) res.write(chunk);
          }
        }
        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
    }
  } catch (e) {
    console.error('[feed] error', e);
  }

  if (!isCsv) {
    res.write('  </channel>\n');
    res.write('</rss>\n');
  }
  res.end();
}

// --- Resolución de tenant (subdominio o dominio propio) ---------------------
// Duplicado a propósito en sitemap.ts y feed/[format].ts: estas funciones corren
// como ESM en Vercel y un import relativo a un módulo compartido revienta en
// runtime. Si tocás una, tocá la otra.
const BASE_DOMAIN = 'procurva.app';
const RESERVED = new Set(['www', 'app']);

interface TenantInfo {
  companyId: string;
  /** Slug real de la tienda que se sirve (puede venir del payload de la RPC). */
  slug: string;
  /** Nombre del comercio, para el título del feed. */
  brand: string;
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
      return { companyId: rows[0].id, slug, brand: (rows[0].name || slug).toString().trim() };
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
