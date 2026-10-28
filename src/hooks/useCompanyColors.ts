import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { getCustomColorsVersion, setCustomColors, subscribeCustomColors } from '@/lib/colorHelper';

/**
 * Colores propios del comercio (los carga en el ERP: Ajustes → Empresa →
 * Colores). Se leen por la RPC pública get_company_colors (solo nombre + hex) y
 * se registran en colorHelper, así resolveColorHex()/colorToHex() los usan.
 *
 * Si la RPC no existe todavía o falla, queda el mapa fijo de siempre: un
 * circulito de menos no justifica romper la tienda.
 */
export function useLoadCompanyColors(companyId: string | null): void {
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    supabase
      .rpc('get_company_colors', { p_company_id: companyId })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[company_colors] no se pudieron cargar los colores propios', error);
          return;
        }
        setCustomColors((data ?? []) as { name: string; hex: string }[]);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);
}

/** Repinta el componente cuando llegan los colores propios. */
export function useCustomColorsVersion(): number {
  return useSyncExternalStore(subscribeCustomColors, getCustomColorsVersion);
}
