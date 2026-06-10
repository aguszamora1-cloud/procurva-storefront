import { useMemo } from 'react';
import { useProducts } from './useProducts';
import type { Product } from '@/lib/types';

/**
 * Productos relacionados a `product`: prioriza los que comparten alguna
 * categoría y completa con los más recientes hasta `limit`. Excluye el producto
 * actual. Deriva de `useProducts()` (mismo tenant, ya filtrado por
 * catalog_visible y stock), así que no agrega una query nueva ni problemas de RLS.
 */
export function useRelatedProducts(product: Product | null, limit = 4) {
  const { products, isLoading } = useProducts();

  const related = useMemo(() => {
    if (!product) return [];
    const others = products.filter((p) => p.id !== product.id);

    const cats = new Set(
      (Array.isArray(product.categories) ? product.categories : []).filter(Boolean),
    );
    const sameCat =
      cats.size > 0
        ? others.filter((p) =>
            (Array.isArray(p.categories) ? p.categories : []).some((c) => c && cats.has(c)),
          )
        : [];
    const sameCatIds = new Set(sameCat.map((p) => p.id));
    const fillers = others.filter((p) => !sameCatIds.has(p.id));

    // Primero misma categoría (más relevantes), después el resto por recencia.
    return [...sameCat, ...fillers].slice(0, limit);
  }, [products, product, limit]);

  return { related, isLoading };
}
