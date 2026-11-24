import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { OUTFITS_PROBE_TIMEOUT_MS, type OutfitsProbe } from '@/lib/templateApp';

/** Estados de los que todavía se puede salir; el resto (error o filas) es definitivo. */
const pendiente = (p: OutfitsProbe) => p === 'sin-leer' || p === 'leyendo';

/**
 * T6 · lectura de outfits activos que decide si una plantilla se puede montar
 * (lib/templateApp, condición 3). Sólo corre con `needed` (la tienda ya pasó
 * todas las demás condiciones y tiene una superficie de outfits prendida): una
 * tienda sin plantilla no hace esta lectura.
 *
 * Es la misma lectura pública que usa Classic (useOutfits: catalog_outfits con
 * active = true), reducida a una fila. La respuesta no se guarda en ningún lado:
 * cada carga vuelve a leer. Error, empresa desconocida o más de
 * OUTFITS_PROBE_TIMEOUT_MS = 'error' (la tienda pinta Classic).
 *
 * El primer resultado es DEFINITIVO en la vida de la página: una respuesta que
 * llega tarde (después del tope) o la de una lectura repetida (StrictMode, un
 * remontaje) no lo cambia, así nada salta de Classic a la plantilla ni al revés.
 */
export function useTemplateOutfitsProbe(companyId: string | null, needed: boolean): OutfitsProbe {
  const [probe, setProbe] = useState<OutfitsProbe>('sin-leer');

  useEffect(() => {
    if (!needed) return;
    const settle = (next: OutfitsProbe) => setProbe((prev) => (pendiente(prev) ? next : prev));
    if (!companyId) {
      settle('error');
      return;
    }
    let cancelled = false;
    setProbe((prev) => (prev === 'sin-leer' ? 'leyendo' : prev));
    const timer = setTimeout(() => {
      if (!cancelled) settle('error');
    }, OUTFITS_PROBE_TIMEOUT_MS);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('catalog_outfits')
          .select('id, active')
          .eq('company_id', companyId)
          .eq('active', true)
          .limit(1);
        if (cancelled) return;
        // La lectura ya filtra activos; las prendas no cuentan (mismo criterio que el servidor).
        settle(error || !Array.isArray(data) ? 'error' : data.map(() => ({ active: true })));
      } catch {
        if (!cancelled) settle('error');
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [needed, companyId]);

  return probe;
}
