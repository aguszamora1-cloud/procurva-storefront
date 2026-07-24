import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/context/StoreProvider';
import type { Variant } from '@/lib/types';

/**
 * Variantes COMPLETAS (con id y price) de un conjunto de productos. useProducts()
 * recorta las variantes a (size, color, stock, image_url) para achicar el payload
 * del grid, así que para agregar al carrito desde una card (quick-add) hace falta
 * traer id/price aparte. Query única por los ids pedidos.
 */
export function useProductVariants(productIds: string[]): {
  variantsByProduct: Record<string, Variant[]>;
  isLoading: boolean;
} {
  const companyId = useStore().companyId;
  const [map, setMap] = useState<Record<string, Variant[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  const idsKey = useMemo(() => Array.from(new Set(productIds)).sort().join(','), [productIds]);

  useEffect(() => {
    let cancelled = false;
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) {
      setMap({});
      return;
    }
    setIsLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, product_id, company_id, size, color, stock, price, sku, image_url')
        .in('product_id', ids);
      if (cancelled) return;
      const next: Record<string, Variant[]> = {};
      if (!error) {
        for (const v of (data ?? []) as Variant[]) {
          (next[v.product_id] ??= []).push(v);
        }
      }
      setMap(next);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey, companyId]);

  return { variantsByProduct: map, isLoading };
}
