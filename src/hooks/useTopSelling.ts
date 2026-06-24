import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';

/**
 * Ranking de productos por unidades vendidas (all-time) para la regla
 * automática de "Destacados". Lee la RPC pública get_top_selling_products
 * (SECURITY DEFINER, sin columnas financieras → segura para anon). Devuelve un
 * Map product_id -> rank (0 = el más vendido) para ordenar client-side.
 *
 * `ok=false` si la RPC no está disponible (migración sin aplicar): el Home cae
 * a un orden por recencia para Destacados.
 */
export interface TopSelling {
  rank: Map<string, number>;
  loading: boolean;
  ok: boolean;
}

export function useTopSelling(): TopSelling {
  const { companyId } = useStoreStatus();
  const [state, setState] = useState<TopSelling>({ rank: new Map(), loading: true, ok: false });

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    (async () => {
      const { data, error } = await supabase.rpc('get_top_selling_products', {
        p_company_id: companyId,
        p_limit: 200,
      });
      if (cancelled) return;
      if (error) {
        console.warn('[useTopSelling] no disponible', error.message);
        setState({ rank: new Map(), loading: false, ok: false });
        return;
      }
      const rank = new Map<string, number>();
      (data ?? []).forEach((row: { product_id: string }, i: number) => rank.set(row.product_id, i));
      setState({ rank, loading: false, ok: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return state;
}
