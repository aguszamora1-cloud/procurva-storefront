import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import { hasStock } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface ProductsState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

// is_featured va aparte: si la migración que agrega la columna todavía no se
// aplicó, la query falla y caemos a COLS_BASE (sin romper el home).
const COLS_BASE = `
  id, company_id, name, description,
  retail_price, retail_price_transfer, retail_price_card, compare_at_price,
  image_url, images, categories,
  catalog_visible, catalog_badge_text, catalog_badge_color, catalog_badge_visible,
  pack_only_sale, created_at,
  product_variants ( id, product_id, company_id, size, color, stock, price, sku, image_url )
`;
const PRODUCT_COLUMNS = `${COLS_BASE}, is_featured`;

/**
 * Productos visibles del tenant con sus variantes. Filtra por company_id,
 * catalog_visible y descarta productos sin stock (igual que PublicCatalog).
 */
export function useProducts(): ProductsState {
  const { companyId } = useStoreStatus();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      const runQuery = (columns: string) =>
        supabase
          .from('products')
          .select(columns)
          .eq('company_id', companyId)
          .eq('catalog_visible', true)
          .gt('retail_price', 0)
          .order('created_at', { ascending: false });

      let { data, error } = await runQuery(PRODUCT_COLUMNS);
      // Si la columna is_featured todavía no existe (migración sin aplicar),
      // reintentamos sin ella para no dejar el home sin productos.
      if (error && /is_featured/i.test(error.message)) {
        ({ data, error } = await runQuery(COLS_BASE));
      }

      if (cancelled) return;
      if (error) {
        setProducts([]);
        setError(error.message);
        setIsLoading(false);
        return;
      }
      const next = ((data ?? []) as unknown as Product[]).filter((p) => hasStock(p));
      setProducts(next);
      setError(null);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, reloadKey]);

  return { products, isLoading, error, reload };
}
