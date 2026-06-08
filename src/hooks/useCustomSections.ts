import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import type { CustomSection } from '@/lib/types';

/**
 * Secciones personalizadas visibles del catálogo activo (retail/wholesale).
 * Query directa como rol anon — la RLS de catalog_custom_sections la acota a
 * secciones visibles de catálogos habilitados (mismo patrón que useProducts /
 * useBanners).
 */
export function useCustomSections(): { sections: CustomSection[]; isLoading: boolean } {
  const { companyId, storeType } = useStoreStatus();
  const [sections, setSections] = useState<CustomSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId || !storeType) return;
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      const { data } = await supabase
        .from('catalog_custom_sections')
        .select('id, company_id, catalog_type, section_type, label, content, is_visible')
        .eq('company_id', companyId)
        .eq('catalog_type', storeType)
        .eq('is_visible', true)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      setSections((data as CustomSection[]) ?? []);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, storeType]);

  return { sections, isLoading };
}
