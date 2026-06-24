import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';

/**
 * Lee storefront_featured_products (fuente de verdad de Destacados / Nuevos /
 * Ofertas), filtrando por company_id + canal actual y ordenando por position.
 * Reemplaza al viejo criterio basado en products.is_featured / is_new_arrival.
 *
 * Devuelve los product_id ORDENADOS de cada sección. La membresía de
 * 'featured' y 'new_arrivals' sale de esta tabla; la de 'offers' se deriva de
 * las promociones activas (ver Home), acá solo aporta el ORDEN.
 *
 * `ok` indica si la query funcionó: si la tabla todavía no existe o anon no
 * tiene permiso de lectura, cae en false y el Home usa el fallback por flags.
 */
export interface FeaturedSections {
  featured: string[];
  newArrivals: string[];
  offersOrder: string[];
  loading: boolean;
  ok: boolean;
}

const EMPTY: FeaturedSections = {
  featured: [],
  newArrivals: [],
  offersOrder: [],
  loading: true,
  ok: false,
};

export function useFeaturedSections(): FeaturedSections {
  const { companyId, storeType } = useStoreStatus();
  const [state, setState] = useState<FeaturedSections>(EMPTY);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const channel = storeType === 'wholesale' ? 'wholesale' : 'retail';
    setState((s) => ({ ...s, loading: true }));

    (async () => {
      // RPC pública (SECURITY DEFINER) que lee los pins de storefront_featured_products
      // sin exponer la tabla a anon. Devuelve filas {section, product_id, pin_position},
      // ya ordenadas por posición (acá solo agrupamos por sección).
      const { data, error } = await supabase.rpc('get_home_section_pins', {
        p_company_id: companyId,
        p_channel: channel,
      });

      if (cancelled) return;

      if (error) {
        // RPC inexistente (migración sin aplicar) o sin permiso: el Home cae al
        // fallback por flags para no quedar sin secciones.
        console.warn('[useFeaturedSections] no disponible, usando fallback', error.message);
        setState({ ...EMPTY, loading: false, ok: false });
        return;
      }

      const featured: string[] = [];
      const newArrivals: string[] = [];
      const offersOrder: string[] = [];
      for (const row of data ?? []) {
        if (row.section === 'featured') featured.push(row.product_id);
        else if (row.section === 'new_arrivals') newArrivals.push(row.product_id);
        else if (row.section === 'offers') offersOrder.push(row.product_id);
      }
      setState({ featured, newArrivals, offersOrder, loading: false, ok: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, storeType]);

  return state;
}
