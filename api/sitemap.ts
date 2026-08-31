// Serverless (Vercel): sitemap.xml dinámico por tenant. Resuelve la tienda desde
// el Host (subdominio {slug}.procurva.app o dominio propio) y lista las URLs de
// productos y categorías.
//
// Ruta: vercel.json reescribe /sitemap.xml → /api/sitemap (antes del catch-all SPA).
//
// Lee Supabase vía la REST API (PostgREST) con la anon key — sólo datos públicos.
// Env: SUPABASE_URL / SUPABASE_ANON_KEY (o las VITE_*).

import { resolveTenantFromHost } from './_tenant';

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
      const products = await rest(
        `products?company_id=eq.${tenant.companyId}&catalog_visible=eq.true&select=id,categories`,
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
