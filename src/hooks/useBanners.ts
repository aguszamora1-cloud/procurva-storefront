import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import { isMissingColumn, storeScopeValues } from '@/lib/storeScope';
import type { Banner } from '@/lib/types';

/** Banners activos del tenant, ordenados por sort_order. */
export function useBanners(): { banners: Banner[]; isLoading: boolean } {
  const { companyId, storeKey } = useStoreStatus();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      const COLS = 'id, company_id, image_url, image_url_mobile, link_url, sort_order, active';
      const base = () =>
        supabase
          .from('catalog_banners')
          .select(COLS)
          .eq('company_id', companyId)
          .eq('active', true);
      // Banners de ESTA tienda (más los de alcance compartido, si es una de las
      // dos históricas). Con dos marcas, los banners son identidad de marca.
      let { data, error } = await base()
        .in('store_key', storeScopeValues(storeKey, ''))
        .order('sort_order', { ascending: true });
      // 20260903 sin aplicar: la columna no existe todavía. Sin el reintento, el
      // home se quedaría sin banners hasta migrar.
      if (isMissingColumn(error)) {
        ({ data, error } = await base().order('sort_order', { ascending: true }));
      }
      if (cancelled) return;
      setBanners((data as Banner[]) ?? []);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, storeKey]);

  return { banners, isLoading };
}
