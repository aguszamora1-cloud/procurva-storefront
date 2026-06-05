import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import type { Outfit } from '@/lib/types';

/** Outfits activos del tenant con sus items (product_ids), ordenados por `order`. */
export function useOutfits(): { outfits: Outfit[]; isLoading: boolean } {
  const { companyId } = useStoreStatus();
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('catalog_outfits')
        .select('id, company_id, name, description, image_url, order, active, items:catalog_outfit_items(product_id, order)')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('order', { ascending: true });
      if (cancelled) return;
      const normalized = ((data as Outfit[]) ?? []).map((o) => ({
        ...o,
        items: [...(o.items ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      }));
      setOutfits(normalized);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { outfits, isLoading };
}
