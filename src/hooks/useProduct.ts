import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import type { Product } from '@/lib/types';

interface ProductState {
  product: Product | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

const PRODUCT_COLUMNS = `
  id, company_id, name, description,
  retail_price, retail_price_transfer, retail_price_card, compare_at_price, wholesale_price,
  image_url, images, categories,
  catalog_visible, catalog_badge_text, catalog_badge_color, catalog_badge_visible,
  pack_only_sale, created_at,
  product_variants ( id, product_id, company_id, size, color, stock, price, sku, image_url )
`;

/** Un producto por id, scoped al tenant actual. */
export function useProduct(productId: string | undefined): ProductState {
  const { companyId } = useStoreStatus();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!companyId || !productId) return;
    let cancelled = false;
    setProduct(null);
    setIsLoading(true);
    setError(null);

    (async () => {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .eq('company_id', companyId)
        .eq('id', productId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setProduct(null);
        setError(error.message);
        setIsLoading(false);
        return;
      }
      setProduct((data as unknown as Product) ?? null);
      setError(null);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, productId, reloadKey]);

  return { product, isLoading, error, reload };
}
