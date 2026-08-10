import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import type { StorefrontLocation } from '@/lib/types';

const COLS =
  'id, location_type, name, address_line, city, province, lat, lng, coords_source, maps_url, phone, whatsapp, hours, by_appointment, photo_url, notes, position';

/**
 * Ubicaciones físicas activas del tenant (tabla `storefront_locations`),
 * ordenadas por `position`.
 *
 * A diferencia de casi todo lo demás del storefront, NO se filtra por canal:
 * el local es el mismo para la tienda minorista y la mayorista.
 *
 * Tolerante a que la migración 20260771 no esté aplicada: acá las migraciones se
 * corren a mano, y si la tabla no existe devolvemos lista vacía y la sección no
 * se renderiza, en vez de romper la página entera (mismo criterio que useReels).
 */
export function useLocations(): { locations: StorefrontLocation[]; isLoading: boolean } {
  const { companyId } = useStoreStatus();
  const [locations, setLocations] = useState<StorefrontLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLocations([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('storefront_locations')
        .select(COLS)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('position', { ascending: true });
      if (cancelled) return;
      if (error) {
        // 42P01 / PGRST205 = migración sin aplicar. No rompemos la página.
        if (!/storefront_locations/i.test(error.message)) {
          console.warn('[useLocations] no se pudieron cargar las ubicaciones:', error.message);
        }
        setLocations([]);
      } else {
        setLocations((data as StorefrontLocation[]) ?? []);
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { locations, isLoading };
}
