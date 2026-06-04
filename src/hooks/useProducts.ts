import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import { hasStock } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface ProductsState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
}

const PRODUCT_COLUMNS = `
  id, company_id, name, description,
  retail_price, retail_price_transfer, retail_price_card, compare_at_price,
  image_url, images, categories,
  catalog_visible, catalog_badge_text, catalog_badge_color, catalog_badge_visible,
  pack_only_sale, created_at,
  product_variants ( id, product_id, company_id, size, color, stock, price, sku, image_url )
`;

/**
 * Productos visibles del tenant con sus variantes. Filtra por company_id,
 * catalog_visible y descarta productos sin stock (igual que PublicCatalog).
 */
export function useProducts(): ProductsState {
  const { companyId } = useStoreStatus();
  const [state, setState] = useState<ProductsState>({
    products: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, error: null }));

    (async () => {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .eq('company_id', companyId)
        .eq('catalog_visible', true)
        .gt('retail_price', 0)
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (error) {
        setState({ products: [], isLoading: false, error: error.message });
        return;
      }
      const products = ((data ?? []) as unknown as Product[]).filter((p) => hasStock(p));
      setState({ products, isLoading: false, error: null });
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return state;
}
