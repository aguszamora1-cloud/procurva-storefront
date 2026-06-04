import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import type { Product } from '@/lib/types';

interface ProductState {
  product: Product | null;
  isLoading: boolean;
  error: string | null;
}

const PRODUCT_COLUMNS = `
  id, company_id, name, description,
  retail_price, retail_price_transfer, retail_price_card,
  image_url, images, categories,
  catalog_visible, catalog_badge_text, catalog_badge_color, catalog_badge_visible,
  pack_only_sale, created_at,
  product_variants ( id, product_id, company_id, size, color, stock, price, sku, image_url )
`;

/** Un producto por id, scoped al tenant actual. */
export function useProduct(productId: string | undefined): ProductState {
  const { companyId } = useStoreStatus();
  const [state, setState] = useState<ProductState>({
    product: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!companyId || !productId) return;
    let cancelled = false;
    setState({ product: null, isLoading: true, error: null });

    (async () => {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .eq('company_id', companyId)
        .eq('id', productId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setState({ product: null, isLoading: false, error: error.message });
        return;
      }
      setState({ product: (data as unknown as Product) ?? null, isLoading: false, error: null });
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, productId]);

  return state;
}
