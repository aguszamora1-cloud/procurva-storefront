import { useEffect, useState } from 'react';
import { fetchCorreoAgencies, MiCorreoError, type CorreoAgency } from '@/lib/micorreo';

export type CorreoAgenciesStatus = 'idle' | 'loading' | 'done' | 'error';

export interface CorreoAgenciesValue {
  status: CorreoAgenciesStatus;
  agencies: CorreoAgency[];
  /** Código de error de la función (not_connected, invalid_province…), si falló. */
  errorCode: string | null;
}

/**
 * Sucursales de Correo Argentino para el retiro en sucursal con cotización en
 * vivo. Busca por la provincia del formulario (nombre o letra) y/o el CP; el
 * servidor las devuelve ordenadas por cercanía al CP. `enabled` en false (otra
 * modalidad elegida) no llama a nada. Con debounce: provincia y CP se tipean.
 */
export function useCorreoAgencies(
  companyId: string,
  enabled: boolean,
  province: string | null | undefined,
  postalCode: string | null | undefined,
  debounceMs = 500,
): CorreoAgenciesValue {
  const prov = (province || '').trim();
  const cp = (postalCode || '').trim();
  // Sin provincia sólo tiene sentido buscar con un CPA ("S2000ABC"), que es de
  // donde el servidor sabe deducirla (la letra inicial).
  const canSearch = enabled && Boolean(companyId) && (prov.length >= 2 || /^[A-Za-z]\d{4}/.test(cp));
  const key = canSearch ? `${prov.toLowerCase()}|${cp.toUpperCase()}` : null;

  const [state, setState] = useState<{ key: string; agencies: CorreoAgency[]; errorCode: string | null; ok: boolean } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchCorreoAgencies(companyId, { provinceCode: prov || null, postalCode: cp || null })
        .then((res) => {
          if (!cancelled) setState({ key, agencies: res.agencies, errorCode: null, ok: true });
        })
        .catch((err) => {
          console.warn('[micorreo] no se pudieron traer las sucursales', err);
          const code = err instanceof MiCorreoError ? err.code : null;
          if (!cancelled) setState({ key, agencies: [], errorCode: code, ok: false });
        });
    }, debounceMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, companyId, debounceMs]);

  if (!key) return { status: 'idle', agencies: [], errorCode: null };
  if (!state || state.key !== key) return { status: 'loading', agencies: [], errorCode: null };
  return state.ok
    ? { status: 'done', agencies: state.agencies, errorCode: null }
    : { status: 'error', agencies: [], errorCode: state.errorCode };
}
