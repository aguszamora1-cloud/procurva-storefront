// Resolución de tenant para las funciones serverless (sitemap.xml, feed de ads).
//
// El archivo empieza con "_" a propósito: Vercel ignora los paths que arrancan
// con guión bajo, así que esto es un módulo compartido y NO una ruta.
//
// Dos caminos, mismo resultado ({companyId, slug, brand}):
//   {slug}.procurva.app  → slug del subdominio.
//   dominio propio       → RPC pública get_storefront_by_custom_domain(host),
//                          la MISMA que usa el storefront en el browser. Sin
//                          esto, todo lo que resuelve por subdominio (feed de
//                          Meta, sitemap) sale VACÍO en el dominio del negocio.
//
// Todo con la anon key: sólo datos públicos, y las RPC ya aplican sus gates
// (dominio verificado, plan, tienda habilitada, cuenta no suspendida).

const BASE_DOMAIN = 'procurva.app';
const RESERVED = new Set(['www', 'app']);

export interface TenantInfo {
  companyId: string;
  /** Slug real de la tienda que se sirve (puede venir del payload de la RPC). */
  slug: string;
  /** Nombre del comercio, para el título del feed. */
  brand: string;
}

/** Host sin puerto, en minúsculas. */
export function normalizeHost(raw: unknown): string {
  return (raw ?? '').toString().toLowerCase().split(':')[0].trim();
}

/** Slug del subdominio. null si el host NO es {slug}.procurva.app. */
export function slugFromHost(host: string): string | null {
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
export async function resolveTenantFromHost(
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
