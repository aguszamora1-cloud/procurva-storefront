// Resolución de tenant a partir del hostname.
//
// Producción: cada tienda vive en {slug}.procurva.app
// Desarrollo:  localhost → VITE_DEV_SLUG
// Host genérico (apex / dominio de Vercel sin subdominio) → null → 404 branded.

export type TenantResolution =
  | { kind: 'slug'; slug: string }
  | { kind: 'generic' }; // mostrar "Tienda no encontrada" genérica

// Hosts que NO representan una tienda (apex / preview de Vercel).
const GENERIC_HOSTS = new Set([
  'procurva-storefront.vercel.app',
  'procurva.app',
  'www.procurva.app',
]);

// Dominios base bajo los que un subdominio = slug de tienda.
const BASE_DOMAINS = ['procurva.app'];

export function resolveTenant(hostname: string = window.location.hostname): TenantResolution {
  const host = hostname.toLowerCase().trim();

  // Desarrollo local.
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    const devSlug = (import.meta.env.VITE_DEV_SLUG || '').trim();
    if (devSlug) return { kind: 'slug', slug: devSlug };
    return { kind: 'generic' };
  }

  // Hosts genéricos explícitos.
  if (GENERIC_HOSTS.has(host)) return { kind: 'generic' };

  // Subdominio bajo un dominio base: {slug}.procurva.app
  for (const base of BASE_DOMAINS) {
    if (host.endsWith(`.${base}`)) {
      const sub = host.slice(0, host.length - base.length - 1);
      // Subdominios reservados que no son tiendas.
      if (!sub || sub === 'www' || sub === 'app') return { kind: 'generic' };
      // Tomar sólo el primer label (por si hubiera niveles extra).
      const slug = sub.split('.')[0];
      return { kind: 'slug', slug };
    }
  }

  // Dominio custom de Vercel (preview con hash) u otro: genérico.
  return { kind: 'generic' };
}
