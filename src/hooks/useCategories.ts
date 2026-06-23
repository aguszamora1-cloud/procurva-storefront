import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import { productCategories } from '@/lib/utils';
import type { Product } from '@/lib/types';

export interface CategoryInfo {
  name: string;
  count: number;
  /** Imagen propia asignada en el admin; si es null, el render cae a la foto del primer producto. */
  imageUrl: string | null;
}

interface OrderRow {
  category_name: string;
  sort_order: number | null;
  visible: boolean | null;
  image_url: string | null;
}

/**
 * Categorías del tenant. Las categorías son un text[] en products; el orden y
 * la visibilidad salen de catalog_category_order cuando hay filas, si no se
 * derivan de los productos (alfabético).
 */
export function useCategories(products: Product[]): {
  categories: CategoryInfo[];
  isLoading: boolean;
} {
  const { companyId } = useStoreStatus();
  const [order, setOrder] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('catalog_category_order')
        .select('category_name, sort_order, visible, image_url')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      setOrder((data as OrderRow[]) ?? []);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const categories = useMemo<CategoryInfo[]>(() => {
    // Conteo por categoría a partir de los productos.
    const counts = new Map<string, number>();
    for (const p of products) {
      for (const cat of productCategories(p)) {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    }

    if (order.length > 0) {
      // Mostramos TODAS las categorías activas (visible !== false), tengan o no
      // productos con stock. Las inactivas (visible === false) sí quedan ocultas.
      // El count puede ser 0: la categoría se muestra igual (con mensaje de vacía
      // en su página).
      return order
        .filter((o) => o.visible !== false)
        .map((o) => ({ name: o.category_name, count: counts.get(o.category_name) ?? 0, imageUrl: o.image_url ?? null }));
    }

    // Fallback: derivadas de productos, alfabético.
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count, imageUrl: null }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [products, order]);

  return { categories, isLoading };
}
