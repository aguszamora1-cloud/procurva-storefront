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

// is_featured y display_variants_separately van aparte: si alguna de esas
// migraciones todavía no se aplicó, la query falla y caemos a COLS_BASE (sin
// romper el home; el modo "card por color" simplemente no se activa hasta migrar).
const COLS_BASE = `
  id, company_id, name, description,
  retail_price, retail_price_transfer, retail_price_card, compare_at_price, wholesale_price,
  image_url, images, categories,
  catalog_visible, catalog_badge_text, catalog_badge_color, catalog_badge_visible,
  pack_only_sale, created_at,
  product_variants ( id, product_id, company_id, size, color, stock, price, sku, image_url )
`;
const PRODUCT_COLUMNS = `${COLS_BASE}, is_featured, display_variants_separately`;

/**
 * Productos visibles del tenant con sus variantes. Filtra por company_id y
 * catalog_visible. Los productos sin stock NO se descartan: se muestran con
 * cartel "Sin stock" (no comprables) y se ordenan al final de la lista.
 */
export function useProducts(): ProductsState {
  const { companyId, storeType } = useStoreStatus();
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
      // En mayorista filtramos por wholesale_price>0 (los productos pueden tener
      // retail_price 0/null); en minorista, por retail_price>0 como siempre.
      const priceCol = storeType === 'wholesale' ? 'wholesale_price' : 'retail_price';
      const runQuery = (columns: string) =>
        supabase
          .from('products')
          .select(columns)
          .eq('company_id', companyId)
          .eq('catalog_visible', true)
          .gt(priceCol, 0)
          .order('created_at', { ascending: false });

      let { data, error } = await runQuery(PRODUCT_COLUMNS);
      // Si alguna columna opcional todavía no existe (migración sin aplicar),
      // reintentamos con COLS_BASE para no dejar el home sin productos.
      if (error && /is_featured|display_variants_separately/i.test(error.message)) {
        ({ data, error } = await runQuery(COLS_BASE));
      }

      if (cancelled) return;
      if (error) {
        setProducts([]);
        setError(error.message);
        setIsLoading(false);
        return;
      }
      // No descartamos los sin stock: los ordenamos al final (sort estable, así
      // dentro de cada grupo se respeta el orden por created_at de la query).
      const next = ((data ?? []) as unknown as Product[])
        .slice()
        .sort((a, b) => Number(hasStock(b)) - Number(hasStock(a)));
      setProducts(next);
      setError(null);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, storeType, reloadKey]);

  return { products, isLoading, error, reload };
}
