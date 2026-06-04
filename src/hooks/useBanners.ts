import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import type { Banner } from '@/lib/types';

/** Banners activos del tenant, ordenados por sort_order. */
export function useBanners(): { banners: Banner[]; isLoading: boolean } {
  const { companyId } = useStoreStatus();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('catalog_banners')
        .select('id, company_id, image_url, image_url_mobile, link_url, sort_order, active')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      setBanners((data as Banner[]) ?? []);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { banners, isLoading };
}
