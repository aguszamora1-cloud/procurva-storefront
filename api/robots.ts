// Serverless (Vercel): robots.txt por tenant. Permite indexación del catálogo
// y bloquea páginas transaccionales. La directiva Sitemap apunta al host actual
// ({slug}.procurva.app) para que cada tienda exponga su propio sitemap.
//
// Ruta: vercel.json reescribe /robots.txt → /api/robots (antes del catch-all SPA).

export default function handler(req: any, res: any) {
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();
  const sitemap = host ? `https://${host}/sitemap.xml` : '';

  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /carrito',
    'Disallow: /checkout',
    sitemap ? `Sitemap: ${sitemap}` : '',
  ].filter(Boolean);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.status(200).send(lines.join('\n') + '\n');
}
