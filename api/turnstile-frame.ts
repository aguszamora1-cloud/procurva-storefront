// Serverless (Vercel): iframe de Cloudflare Turnstile del probador virtual (F0.5).
//
// Turnstile (plan gratis) sólo acepta 10 dominios por widget y no admite
// comodines, pero "procurva.app" cubre TODOS sus subdominios. Por eso el desafío
// corre siempre acá, en https://{slug}.procurva.app/api/turnstile-frame, y la
// tienda (en su subdominio o en su dominio propio) lo embebe y recibe el token
// por postMessage. El servidor de fashn-tryon exige hostname = {slug}.procurva.app
// (token atado a la tienda), cdata = producto y action = "tryon".
//
// Quién puede embeberlo lo decide ESTE servidor, nunca la URL:
//   · el slug sale del Host (no de un parámetro);
//   · ?parent=<origen> se acepta sólo si es la misma tienda o un dominio propio
//     verificado que resuelve (get_storefront_by_custom_domain) a ESE mismo slug;
//   · con eso se arma Content-Security-Policy: frame-ancestors. Cualquier otro
//     sitio que lo embeba queda bloqueado por el navegador.
// Adentro, el script acepta mensajes sólo de window.parent con ese origen y le
// responde sólo a ese origen (nunca a "*").
//
// Requiere TURNSTILE_SITE_KEY (pública) en las variables de entorno de Vercel.

import { randomBytes } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SITE_KEY = (process.env.TURNSTILE_SITE_KEY || '').trim();

const BASE_DOMAIN = 'procurva.app';
const RESERVED = new Set(['www', 'app']);
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

function normalizeHost(raw: unknown): string {
  return (raw ?? '').toString().toLowerCase().split(':')[0].trim();
}

/** Sólo {slug}.procurva.app exacto (sin sub-subdominios). */
function slugFromHost(host: string): string | null {
  if (!host.endsWith(`.${BASE_DOMAIN}`)) return null;
  const sub = host.slice(0, host.length - BASE_DOMAIN.length - 1);
  if (!SLUG_RE.test(sub) || RESERVED.has(sub)) return null;
  return sub;
}

/** Origen https exacto (sin ruta, usuario ni puerto raro) o null. */
function parseOrigin(raw: unknown): string | null {
  const s = (raw ?? '').toString().trim();
  if (!s || s.length > 300) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.origin !== s) return null;
    return u.origin;
  } catch {
    return null;
  }
}

async function slugOfCustomDomain(host: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_storefront_by_custom_domain`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_domain: host }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const payload = Array.isArray(data) ? data[0] ?? null : data;
    const slug = typeof payload?.slug === 'string' ? payload.slug.toLowerCase() : '';
    return slug || null;
  } catch {
    return null;
  }
}

function deny(res: any, status: number) {
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send('');
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return deny(res, 405);
  const host = normalizeHost(req.headers['x-forwarded-host'] || req.headers.host);
  const slug = slugFromHost(host);
  if (!slug || !SITE_KEY) return deny(res, 404);

  const self = `https://${host}`;
  const parent = parseOrigin(req.query?.parent) ?? self;
  if (parent !== self) {
    const parentSlug = await slugOfCustomDomain(new URL(parent).hostname);
    if (parentSlug !== slug) return deny(res, 403);
  }

  const nonce = randomBytes(16).toString('base64');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'none'",
      `script-src 'nonce-${nonce}' ${TURNSTILE_ORIGIN}`,
      `frame-src ${TURNSTILE_ORIGIN}`,
      `connect-src ${TURNSTILE_ORIGIN}`,
      "style-src 'unsafe-inline'",
      "base-uri 'none'",
      "form-action 'none'",
      `frame-ancestors ${parent === self ? "'self'" : `'self' ${parent}`}`,
    ].join('; '),
  );
  res.status(200).send(framePage({ nonce, parent, siteKey: SITE_KEY }));
}

function framePage({ nonce, parent, siteKey }: { nonce: string; parent: string; siteKey: string }): string {
  // JSON.stringify + reemplazo de "<" para que nada del valor cierre el <script>.
  const js = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}#w{display:flex;justify-content:center}</style>
</head><body><div id="w"></div>
<script nonce="${nonce}" src="${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit" async defer></script>
<script nonce="${nonce}">
(function () {
  var PARENT = ${js(parent)};
  var SITE_KEY = ${js(siteKey)};
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  var busy = false;
  function send(msg) { window.parent.postMessage(msg, PARENT); }
  function whenReady(fn, tries) {
    if (window.turnstile) return fn();
    if ((tries || 0) > 100) { busy = false; return send({ type: 'tryon:token-error', code: 'script', nonce: null }); }
    setTimeout(function () { whenReady(fn, (tries || 0) + 1); }, 100);
  }
  window.addEventListener('message', function (ev) {
    if (window.parent === window || ev.source !== window.parent || ev.origin !== PARENT) return;
    var m = ev.data || {};
    if (m.type !== 'tryon:token-request' || typeof m.productId !== 'string' || !UUID.test(m.productId)) return;
    if (typeof m.nonce !== 'string' || m.nonce.length > 64 || busy) return;
    busy = true;
    whenReady(function () {
      var el = document.createElement('div');
      document.getElementById('w').replaceChildren(el);
      var id = window.turnstile.render(el, {
        sitekey: SITE_KEY, action: 'tryon', cData: m.productId,
        execution: 'execute', appearance: 'interaction-only', 'refresh-expired': 'never',
        'before-interactive-callback': function () { send({ type: 'tryon:interactive', visible: true }); },
        'after-interactive-callback': function () { send({ type: 'tryon:interactive', visible: false }); },
        callback: function (token) {
          busy = false;
          send({ type: 'tryon:token', token: token, nonce: m.nonce });
          window.turnstile.remove(id);
        },
        'error-callback': function (code) {
          busy = false;
          send({ type: 'tryon:token-error', code: String(code), nonce: m.nonce });
          try { window.turnstile.remove(id); } catch (e) {}
          return true;
        },
        'timeout-callback': function () {
          busy = false;
          send({ type: 'tryon:token-error', code: 'timeout', nonce: m.nonce });
        }
      });
      window.turnstile.execute(id);
    });
  });
  send({ type: 'tryon:frame-ready' });
})();
</script></body></html>`;
}
