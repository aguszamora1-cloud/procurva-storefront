import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import {
  parseCategoryTierRow,
  resolveTierConfigForProduct,
  type CategoryTierConfig,
  type CategoryTierRow,
} from '@/lib/categoryTiers';
import type { Product } from '@/lib/types';

/**
 * Escalones por cantidad a nivel de categoría (tabla category_volume_tiers). Se
 * cargan UNA sola vez por empresa (igual que PromotionsProvider) y se aplican
 * client-side. La ficha de producto resuelve, por las categorías del producto,
 * qué config de escalones le corresponde (precedencia por sort_order del catálogo,
 * ver resolveTierConfigForProduct).
 */
interface CategoryTiersValue {
  loading: boolean;
  /** Config de escalones aplicable a un producto (o null si no tiene). */
  tiersForProduct: (product: Pick<Product, 'categories'>) => CategoryTierConfig | null;
}

const CategoryTiersContext = createContext<CategoryTiersValue>({
  loading: false,
  tiersForProduct: () => null,
});

export function CategoryTiersProvider({ children }: { children: ReactNode }) {
  const { companyId } = useStoreStatus();
  const [configByCategory, setConfigByCategory] = useState<Map<string, CategoryTierConfig>>(new Map());
  const [sortOrderByCategory, setSortOrderByCategory] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setConfigByCategory(new Map());
      setSortOrderByCategory(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Escalones activos de la empresa (RLS anon: is_active + catalog_enabled) +
      // el orden de categorías del catálogo (para la precedencia por sort_order).
      const [tiersRes, orderRes] = await Promise.all([
        supabase
          .from('category_volume_tiers')
          .select('category_name, is_active, variant_per_unit, tiers')
          .eq('company_id', companyId)
          .eq('is_active', true),
        supabase
          .from('catalog_category_order')
          .select('category_name, sort_order')
          .eq('company_id', companyId),
      ]);
      if (cancelled) return;

      if (tiersRes.error) {
        console.error('[CategoryTiers] error cargando escalones', tiersRes.error);
      }

      const cfg = new Map<string, CategoryTierConfig>();
      for (const row of (tiersRes.data ?? []) as CategoryTierRow[]) {
        const parsed = parseCategoryTierRow(row);
        if (parsed.tiers.length > 0) cfg.set(parsed.categoryName, parsed);
      }
      const order = new Map<string, number>();
      for (const row of (orderRes.data ?? []) as { category_name: string; sort_order: number | null }[]) {
        order.set(row.category_name, row.sort_order ?? Number.POSITIVE_INFINITY);
      }
      setConfigByCategory(cfg);
      setSortOrderByCategory(order);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const tiersForProduct = useCallback(
    (product: Pick<Product, 'categories'>) => resolveTierConfigForProduct(product, configByCategory, sortOrderByCategory),
    [configByCategory, sortOrderByCategory],
  );

  const value = useMemo<CategoryTiersValue>(() => ({ loading, tiersForProduct }), [loading, tiersForProduct]);
  return <CategoryTiersContext.Provider value={value}>{children}</CategoryTiersContext.Provider>;
}

export function useCategoryTiers(): CategoryTiersValue {
  return useContext(CategoryTiersContext);
}
