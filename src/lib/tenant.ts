// Resolución de tenant a partir del hostname.
//
// Producción: cada tienda vive en {slug}.procurva.app
// Dominio propio: un Host que NO es procurva.app ni un host genérico se trata
//   como dominio propio (plan Profesional) → se resuelve por la RPC
//   get_storefront_by_custom_domain.
// Desarrollo:  localhost → VITE_DEV_SLUG (o VITE_DEV_DOMAIN para probar dominio propio)
// Host genérico (apex de procurva.app / preview de Vercel) → 404 branded.

export type TenantResolution =
  | { kind: 'slug'; slug: string }
  | { kind: 'custom'; domain: string } // dominio propio → resolver por Host
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

  // Desarrollo local. VITE_DEV_DOMAIN permite probar el camino de dominio propio;
  // si no, VITE_DEV_SLUG resuelve por slug como en producción.
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    const devDomain = (import.meta.env.VITE_DEV_DOMAIN || '').trim().toLowerCase();
    if (devDomain) return { kind: 'custom', domain: devDomain };
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

  // Cualquier otro Host es un candidato a dominio propio: se resuelve por la RPC
  // get_storefront_by_custom_domain (que sólo devuelve algo si el dominio está
  // verificado y la empresa sigue en plan Profesional). Los previews de Vercel
  // sin tienda caen acá y la RPC devuelve null → 404 branded, igual que antes.
  return { kind: 'custom', domain: host };
}
