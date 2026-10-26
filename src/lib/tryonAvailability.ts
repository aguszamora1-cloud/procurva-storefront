// ¿Mostrar el botón del probador virtual en esta tienda? (F0.5)
//
// Consulta la RPC pública tryon_available(empresa), que devuelve SOLO true/false
// (probador prendido + autorización vigente + cuenta activa). Es únicamente para
// no mostrar un botón que no va a funcionar: NO es un control de seguridad, el
// servidor (fashn-tryon + ai_reserve) vuelve a verificar todo en cada prueba.
//
// Carga mínima sobre la base:
//   · una sola consulta por empresa y por pestaña (los pedidos simultáneos comparten la misma);
//   · la respuesta se reusa OK_TTL_MS;
//   · si falla (red, base), se toma como "no disponible" y NO se reintenta hasta
//     FAIL_TTL_MS: una caída no genera una catarata de consultas.

export const OK_TTL_MS = 5 * 60_000;
export const FAIL_TTL_MS = 60_000;

type Rpc = (companyId: string) => Promise<boolean>;
type Entry = { value: boolean; at: number; ttl: number } | { pending: Promise<boolean> };

const cache = new Map<string, Entry>();

export function tryonAvailable(companyId: string, rpc: Rpc, now: () => number = Date.now): Promise<boolean> {
  if (!companyId) return Promise.resolve(false);
  const hit = cache.get(companyId);
  if (hit && 'pending' in hit) return hit.pending;
  if (hit && now() - hit.at < hit.ttl) return Promise.resolve(hit.value);
  const pending = rpc(companyId)
    .then((v) => {
      const value = v === true;
      cache.set(companyId, { value, at: now(), ttl: OK_TTL_MS });
      return value;
    })
    .catch(() => {
      cache.set(companyId, { value: false, at: now(), ttl: FAIL_TTL_MS });
      return false;
    });
  cache.set(companyId, { pending });
  return pending;
}

/** Sólo para tests. */
export function resetTryonAvailabilityCache(): void {
  cache.clear();
}
