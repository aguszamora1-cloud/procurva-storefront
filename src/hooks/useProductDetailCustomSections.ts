import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import type { CustomSection } from '@/lib/types';

/**
 * Secciones custom visibles del DETALLE de producto (globales a todos los
 * productos del catálogo activo). Query directa anon, ordenadas por position;
 * cada una se ubica en su slot (content.slot).
 */
export function useProductDetailCustomSections(): { sections: CustomSection[]; isLoading: boolean } {
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
        .select('id, company_id, catalog_type, section_type, label, content, is_visible, page_context, position')
        .eq('company_id', companyId)
        .eq('catalog_type', storeType)
        .eq('page_context', 'product_detail')
        .eq('is_visible', true)
        .order('position', { ascending: true });
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
