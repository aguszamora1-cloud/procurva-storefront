import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProductReview } from '@/lib/types';

/** Reseñas activas de un producto (Extra PRO), ordenadas por `order`. */
export function useProductReviews(productId: string | undefined): {
  reviews: ProductReview[];
  isLoading: boolean;
} {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!productId) {
      setReviews([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      const { data } = await supabase
        .from('catalog_product_reviews')
        .select('id, product_id, customer_name, customer_photo_url, text, rating, order, active')
        .eq('product_id', productId)
        .eq('active', true)
        .order('order', { ascending: true });
      if (cancelled) return;
      setReviews((data as ProductReview[]) ?? []);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return { reviews, isLoading };
}
