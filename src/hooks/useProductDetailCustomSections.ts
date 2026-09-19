import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import type { CustomSection } from '@/lib/types';

const COLUMNS = 'id, company_id, catalog_type, section_type, label, content, is_visible, page_context, position';

/**
 * Secciones custom visibles del DETALLE de producto del catálogo activo: las
 * generales (product_id NULL, se ven en todas las fichas) más las propias de
 * ESTE producto (product_id = productId, migración 20260919; las crea Claude
 * por MCP). Query directa anon, ordenadas por position; cada una se ubica en
 * su slot (content.slot).
 *
 * Sin la migración aplicada la columna product_id no existe y el filtro
 * revienta: se reintenta sin él (todas son generales, como antes).
 */
export function useProductDetailCustomSections(productId?: string): { sections: CustomSection[]; isLoading: boolean } {
  const { companyId, storeType } = useStoreStatus();
  const [sections, setSections] = useState<CustomSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId || !storeType) return;
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      const base = () =>
        supabase
          .from('catalog_custom_sections')
          .select(COLUMNS)
          .eq('company_id', companyId)
          .eq('catalog_type', storeType)
          .eq('page_context', 'product_detail')
          .eq('is_visible', true);

      // El id viene de la URL: solo un uuid entra al filtro .or() (que es texto).
      const pid = productId && /^[0-9a-f-]{36}$/i.test(productId) ? productId : null;
      let { data, error } = await (pid
        ? base().or(`product_id.is.null,product_id.eq.${pid}`)
        : base().is('product_id', null)
      ).order('position', { ascending: true });

      if (error && /product_id/i.test(error.message)) {
        ({ data, error } = await base().order('position', { ascending: true }));
      }
      if (cancelled) return;
      setSections((data as CustomSection[]) ?? []);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, storeType, productId]);

  return { sections, isLoading };
}
