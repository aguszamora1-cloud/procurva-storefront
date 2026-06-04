// Serverless (Vercel): sitemap.xml dinámico por tenant. Resuelve el slug desde
// el subdominio, busca la company y lista las URLs de productos y categorías.
//
// Ruta: vercel.json reescribe /sitemap.xml → /api/sitemap (antes del catch-all SPA).
//
// Lee Supabase vía la REST API (PostgREST) con la anon key — sólo datos públicos
// (catalog_enabled = true). Env: SUPABASE_URL / SUPABASE_ANON_KEY (o las VITE_*).

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const BASE_DOMAIN = 'procurva.app';
const RESERVED = new Set(['www', 'app']);

/** Extrae el slug del tenant desde el host. null si es host genérico. */
function slugFromHost(host: string): string | null {
  const h = host.toLowerCase().split(':')[0].trim();
  if (!h.endsWith(`.${BASE_DOMAIN}`)) return null;
  const sub = h.slice(0, h.length - BASE_DOMAIN.length - 1).split('.')[0];
  if (!sub || RESERVED.has(sub)) return null;
  return sub;
}

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
  const slug = slugFromHost(host);
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

  if (slug && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const companies = await rest(
        `companies?catalog_slug=eq.${encodeURIComponent(slug)}&catalog_enabled=eq.true&select=id&limit=1`,
      );
      const company = companies[0];
      if (company?.id) {
        const products = await rest(
          `products?company_id=eq.${company.id}&catalog_visible=eq.true&select=id,categories`,
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
  }

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') +
    '\n</urlset>\n';

  res.status(200).send(xml);
}
