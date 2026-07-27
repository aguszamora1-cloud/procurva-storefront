import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import type { Reel } from '@/lib/types';

const COLS = 'id, url, poster_url, caption, duration_ms, product_id, sort_order';

/**
 * Videos verticales del tenant (tabla catalog_reels), ordenados por sort_order.
 *
 * DOS POOLS QUE NO SE MEZCLAN:
 *  - useReels('home')            -> videos de la tienda (product_id NULL)
 *  - useReels('product', id)     -> videos de ESE producto
 * La separación la garantiza un CHECK en la DB, pero además filtramos explícito
 * acá: `is('product_id', null)` para el home y `eq('product_id', id)` para la
 * ficha. Sin el `is(...)` un video de producto se colaría en el home.
 *
 * Canal: se descartan los videos de otro canal (retail/wholesale); 'both' pasa
 * siempre. Se filtra en cliente porque el canal ya lo resolvió StoreProvider.
 *
 * Tolerante a que la migración 20260740 no esté aplicada: si la tabla no existe,
 * devuelve lista vacía y la sección simplemente no se renderiza. Acá las
 * migraciones se aplican a mano, y una pantalla rota por eso ya pasó antes
 * (ver AUDIT_STOREFRONT.md, riesgo R7).
 */
export function useReels(
  placement: 'home' | 'product',
  productId?: string,
): { reels: Reel[]; isLoading: boolean } {
  const { companyId, storeType } = useStoreStatus();
  const [reels, setReels] = useState<Reel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId || (placement === 'product' && !productId)) {
      setReels([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      let q = supabase
        .from('catalog_reels')
        .select(COLS)
        .eq('company_id', companyId)
        .eq('placement', placement)
        .eq('is_visible', true);
      q = placement === 'product' ? q.eq('product_id', productId as string) : q.is('product_id', null);
      // 'both' o el canal activo. storeType puede no estar resuelto todavía.
      const channel = storeType === 'wholesale' ? 'wholesale' : 'retail';
      q = q.in('catalog_type', ['both', channel]);

      const { data, error } = await q.order('sort_order', { ascending: true });
      if (cancelled) return;
      if (error) {
        // 42P01 / PGRST205 = migración sin aplicar. No rompemos la página.
        if (!/catalog_reels/i.test(error.message)) {
          console.warn('[useReels] no se pudieron cargar los videos:', error.message);
        }
        setReels([]);
      } else {
        setReels((data as Reel[]) ?? []);
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, storeType, placement, productId]);

  return { reels, isLoading };
}
