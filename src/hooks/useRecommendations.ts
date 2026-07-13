import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/context/StoreProvider';
import { useProducts } from './useProducts';
import { productAsColorCard } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface RecRow {
  recommended_product_id: string;
  recommended_color: string | null;
  label: string | null;
  position: number | null;
}

export interface RecommendationsResult {
  /** Cards recomendadas (cada color = su propia card), en el orden cargado. */
  items: Product[];
  /** Etiqueta configurada por el comercio (título de la sección). */
  label: string;
  isLoading: boolean;
}

/**
 * Recomendaciones manuales cargadas en el admin (tabla product_recommendations)
 * para el detalle de `product`. Cada fila puede fijar un color: se resuelve a una
 * virtual card por color (foto + deep-link a ?color=), igual que el modo
 * "card por color" del catálogo. Los productos salen de useProducts() (mismo
 * tenant, ya filtrado por catalog_visible/stock) → sin query extra de productos
 * ni problemas de RLS; si un recomendado no está en esa lista, se omite.
 */
export function useRecommendations(product: Product | null | undefined): RecommendationsResult {
  const companyId = useStore().companyId;
  const { products } = useProducts();
  const [rows, setRows] = useState<RecRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const sourceId = product?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!sourceId) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    (async () => {
      let q = supabase
        .from('product_recommendations')
        .select('recommended_product_id, recommended_color, label, position')
        .eq('source_product_id', sourceId)
        .eq('is_active', true)
        .order('position', { ascending: true });
      if (companyId) q = q.eq('company_id', companyId);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        // Silencioso: si la tabla/columna no existe todavía, caemos a "sin recos"
        // y el detalle usa el fallback por categoría.
        setRows([]);
      } else {
        setRows((data ?? []) as RecRow[]);
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceId, companyId]);

  const byId = useMemo(() => {
    const m = new Map<string, Product>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const items = useMemo(() => {
    if (!rows) return [];
    const cards: Product[] = [];
    for (const r of rows) {
      const base = byId.get(r.recommended_product_id);
      if (!base) continue; // recomendado no visible / no cargado
      cards.push(r.recommended_color ? productAsColorCard(base, r.recommended_color) : base);
    }
    return cards;
  }, [rows, byId]);

  const label = useMemo(() => rows?.find((r) => r.label)?.label || 'Te puede interesar', [rows]);

  return { items, label, isLoading };
}
