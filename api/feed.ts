// Serverless (Vercel): feed de catálogo por tenant para Meta / Google / TikTok.
//
// Rutas (vercel.json, ANTES del catch-all SPA):
//   /feed/meta.xml    -> /api/feed?format=meta     (RSS 2.0 + namespace g:)
//   /feed/google.xml  -> /api/feed?format=google   (mismo formato base, Google Merchant)
//   /feed/tiktok.csv  -> /api/feed?format=tiktok   (CSV)
//
// Lo leen Meta/Google/TikTok desde SUS IPs cada ~4hs, SIN credenciales. Por eso el read
// va con la anon key contra PostgREST y depende de la RLS pública (catalog_enabled=true).
// Verificado con curl anónimo: anon lee products + product_variants embebidas (HTTP 206).
//
// Reglas de negocio (brief Módulo Publicidad, Fase 1):
//   - Una fila POR VARIANTE (talle/color), agrupadas con item_group_id = product_id.
//   - id = UUID de la variante (estable y permanente; sin barcode → sin GTIN).
//   - identifier_exists = no (marca propia).
//   - availability según stock consolidado (product_variants.stock ya es el cache de
//     deposit_stock sumado de todos los depósitos).
//   - Excluir productos sin imagen, sin precio, o no publicados en minorista.
//   - SOLO canal minorista. El mayorista NUNCA va al feed (precios privados).
//   - Precio = jerarquía de PRODUCTO (card→transfer→base + compare_at), igual que la ficha
//     (PriceDisplay/getPriceInfo). NO se usa product_variants.price: el storefront no lo
//     cobra (mainPrice product-level "va al carrito"), así el feed coincide con el landing.
//
// Volumen: con curva surtida el feed explota (6 talles × 4 colores = 24 filas/producto).
// Por eso paginamos los productos (Range) y hacemos STREAMING del XML/CSV con res.write:
// nunca materializamos el documento entero en memoria ni pegamos contra el límite de
// respuesta buffered de Vercel (~4.5MB). Memoria acotada a una página de productos.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const BASE_DOMAIN = 'procurva.app';
const RESERVED = new Set(['www', 'app']);
const PAGE_SIZE = 500; // productos por página REST (las variantes vienen embebidas)
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
interface ProductRow {
  id: string;
  name: string | null;
  description: string | null;
  retail_price: number | null;
  retail_price_transfer: number | null;
  retail_price_card: number | null;
  compare_at_price: number | null;
  image_url: string | null;
  images: (string | { url?: string })[] | null;
  categories: string[] | null;
  product_variants: Variant[] | null;
}

/** Extrae el slug del tenant desde el host. null si es host genérico. */
function slugFromHost(host: string): string | null {
  const h = host.toLowerCase().split(':')[0].trim();
  if (!h.endsWith(`.${BASE_DOMAIN}`)) return null;
  const sub = h.slice(0, h.length - BASE_DOMAIN.length - 1).split('.')[0];
  if (!sub || RESERVED.has(sub)) return null;
  return sub;
}

/** GET a PostgREST con anon key. Devuelve { rows, error }. */
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

// ---- Precio: espejo de getPriceInfo() del storefront (product-level) --------
/** Precio principal (lo que se cobra) y precio de lista anterior (tachado), del producto. */
function priceInfo(p: ProductRow): { main: number; compare: number | null } {
  const base = Number(p.retail_price ?? 0);
  const card = Number(p.retail_price_card ?? 0);
  const transfer = Number(p.retail_price_transfer ?? 0);
  const compareRaw = Number(p.compare_at_price ?? 0);
  const main = card > 0 ? card : transfer > 0 ? transfer : base;
  const compare = compareRaw > 0 && compareRaw > main ? compareRaw : null;
  return { main, compare };
}

/** Primera imagen válida del producto (image_url o images[0]). */
function primaryImage(p: ProductRow): string | null {
  if (p.image_url) return p.image_url;
  const first = (p.images || []).map(imgUrl).find(Boolean);
  return first || null;
}
function imgUrl(i: string | { url?: string }): string {
  return typeof i === 'string' ? i : i?.url || '';
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

// ---- Render por variante ----------------------------------------------------
interface Ctx {
  origin: string;
  brand: string;
}

/** Un <item> del feed XML (Meta/Google) para una variante, o '' si la variante se excluye. */
function xmlItem(p: ProductRow, v: Variant, price: number, compare: number | null, ctx: Ctx): string {
  const image = v.image_url || primaryImage(p);
  if (!image) return '';
  const title = (p.name || '').trim();
  const desc = stripHtml(p.description || p.name || '');
  const link = `${ctx.origin}/producto/${p.id}`;
  const availability = (v.stock ?? 0) > 0 ? 'in stock' : 'out of stock';
  // Precio de lista vs oferta: si hay compare_at (>principal), price=compare y sale_price=principal.
  const regular = compare ?? price;
  const sale = compare ? price : null;

  const extra = (p.images || [])
    .map(imgUrl)
    .filter((u) => u && u !== image)
    .slice(0, MAX_ADDITIONAL_IMAGES);
  const productType = Array.isArray(p.categories) ? p.categories.filter(Boolean).join(' > ') : '';

  const lines = [
    `    <item>`,
    `      <g:id>${xmlEscape(v.id)}</g:id>`,
    `      <g:item_group_id>${xmlEscape(p.id)}</g:item_group_id>`,
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
function csvRow(p: ProductRow, v: Variant, price: number, compare: number | null, ctx: Ctx): string {
  const image = v.image_url || primaryImage(p);
  if (!image) return '';
  const availability = (v.stock ?? 0) > 0 ? 'in stock' : 'out of stock';
  const regular = compare ?? price;
  const sale = compare ? price : regular;
  const productType = Array.isArray(p.categories) ? p.categories.filter(Boolean).join(' > ') : '';
  return (
    [
      csvField(v.id),
      csvField(p.id),
      csvField((p.name || '').trim()),
      csvField(stripHtml(p.description || p.name || '')),
      csvField(availability),
      csvField('new'),
      csvField(money(regular)),
      csvField(money(sale)),
      csvField(`${ctx.origin}/producto/${p.id}`),
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
  const slug = slugFromHost(host);
  const origin = `https://${host}`;

  const fmtRaw = (req.query?.format || '').toString().toLowerCase();
  const format: Format = fmtRaw === 'tiktok' ? 'tiktok' : fmtRaw === 'google' ? 'google' : 'meta';
  const isCsv = format === 'tiktok';

  res.statusCode = 200; // fijar ANTES del primer write: al streamear, la cabecera se
  //                       envía con el primer chunk y ya no se puede cambiar el status.
  res.setHeader('Content-Type', isCsv ? 'text/csv; charset=utf-8' : 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600');

  // Cabecera del documento (siempre, aunque el tenant no exista → feed vacío pero válido).
  if (isCsv) {
    res.write(CSV_HEADER);
  } else {
    res.write('<?xml version="1.0" encoding="UTF-8"?>\n');
    res.write('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n');
    res.write('  <channel>\n');
    res.write(`    <title>${xmlEscape(slug || 'ProCurva')}</title>\n`);
    res.write(`    <link>${xmlEscape(origin)}</link>\n`);
    res.write('    <description>Catálogo de productos</description>\n');
  }

  try {
    if (slug && SUPABASE_URL && SUPABASE_ANON_KEY) {
      const { rows: companies } = await rest(
        `companies?catalog_slug=eq.${encodeURIComponent(slug)}&catalog_enabled=eq.true&select=id,name&limit=1`,
      );
      const company = companies[0];
      if (company?.id) {
        const brand = (company.name || slug || 'ProCurva').toString().trim();
        const ctx: Ctx = { origin, brand };
        const select =
          'id,name,description,retail_price,retail_price_transfer,retail_price_card,compare_at_price,' +
          'image_url,images,categories,product_variants(id,size,color,stock,sku,image_url)';

        // Paginado por Range hasta agotar. Cada página se renderiza y se streamea.
        let from = 0;
        for (;;) {
          const to = from + PAGE_SIZE - 1;
          const { rows, error } = await rest(
            `products?company_id=eq.${company.id}&catalog_visible=eq.true&order=created_at.desc&select=${select}`,
            from,
            to,
          );
          if (error) break;
          for (const p of rows as ProductRow[]) {
            const { main, compare } = priceInfo(p);
            if (main <= 0) continue; // sin precio → excluido
            if (!primaryImage(p)) continue; // sin imagen → excluido
            const variants = p.product_variants && p.product_variants.length ? p.product_variants : null;
            // Producto sin variantes: no puede ir al feed (una fila = una variante).
            if (!variants) continue;
            for (const v of variants) {
              const chunk = isCsv ? csvRow(p, v, main, compare, ctx) : xmlItem(p, v, main, compare, ctx);
              if (chunk) res.write(chunk);
            }
          }
          if (rows.length < PAGE_SIZE) break; // última página
          from += PAGE_SIZE;
        }
      }
    }
  } catch (e) {
    console.error('[feed] error', e);
    // Cerramos el documento igual: un feed parcial válido es mejor que un 500.
  }

  if (!isCsv) {
    res.write('  </channel>\n');
    res.write('</rss>\n');
  }
  res.end();
}
