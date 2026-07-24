import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/context/StoreProvider';
import { useProducts } from './useProducts';
import { productAsColorCard } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface RecRow {
  source_product_id: string;
  recommended_product_id: string;
  recommended_color: string | null;
  position: number | null;
}

export interface ComplementariosResult {
  /** Color-cards complementarias, deduplicadas y ordenadas por el orden más bajo. */
  items: Product[];
  isLoading: boolean;
}

/** true si el producto (o la color-card) tiene al menos una variante con stock. */
export function hasStock(p: Product): boolean {
  const vs = p.product_variants ?? [];
  if (vs.length === 0) return true; // sin variantes cargadas → no lo ocultamos
  return vs.some((v) => (v.stock ?? 0) > 0);
}

/**
 * Complementarios manuales (tabla product_recommendations) para uno o varios
 * productos origen. Resuelve cada fila a una color-card (color fijado → card por
 * color; null → producto entero), deduplica por (producto, color) conservando el
 * orden más bajo, y excluye los productos indicados (p. ej. los que ya están en
 * el carrito). El corte por `maximoVisible` y el "ocultar sin stock" los aplica el
 * componente (dependen de config y del carrito en vivo).
 *
 * Los productos salen de useProducts() (mismo tenant, ya filtrado por
 * visibilidad): sin query extra ni problemas de RLS; si un complementario no está
 * en esa lista, se omite.
 */
export function useComplementarios(
  sourceIds: string[],
  opts?: { excludeProductIds?: string[] },
): ComplementariosResult {
  const companyId = useStore().companyId;
  const { products } = useProducts();
  const [rows, setRows] = useState<RecRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Clave estable de las fuentes para el efecto (evita refetch por identidad de array).
  const sourceKey = useMemo(() => Array.from(new Set(sourceIds)).sort().join(','), [sourceIds]);

  useEffect(() => {
    let cancelled = false;
    const ids = sourceKey ? sourceKey.split(',') : [];
    if (ids.length === 0) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    (async () => {
      let q = supabase
        .from('product_recommendations')
        .select('source_product_id, recommended_product_id, recommended_color, position')
        .in('source_product_id', ids)
        .eq('is_active', true)
        .order('position', { ascending: true });
      if (companyId) q = q.eq('company_id', companyId);
      const { data, error } = await q;
      if (cancelled) return;
      // Silencioso: si la tabla/columna no existe todavía, no mostramos el bloque.
      setRows(error ? [] : ((data ?? []) as RecRow[]));
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceKey, companyId]);

  const byId = useMemo(() => {
    const m = new Map<string, Product>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const excludeKey = useMemo(
    () => Array.from(new Set(opts?.excludeProductIds ?? [])).sort().join(','),
    [opts?.excludeProductIds],
  );

  const items = useMemo(() => {
    if (!rows) return [];
    const exclude = new Set(excludeKey ? excludeKey.split(',') : []);
    // Dedup por (producto, color) conservando la position más baja.
    const best = new Map<string, { row: RecRow; pos: number }>();
    for (const r of rows) {
      if (exclude.has(r.recommended_product_id)) continue;
      const key = `${r.recommended_product_id}::${r.recommended_color ?? ''}`;
      const pos = r.position ?? 0;
      const prev = best.get(key);
      if (!prev || pos < prev.pos) best.set(key, { row: r, pos });
    }
    const ordered = Array.from(best.values()).sort((a, b) => a.pos - b.pos);
    const cards: Product[] = [];
    for (const { row } of ordered) {
      const base = byId.get(row.recommended_product_id);
      if (!base) continue; // complementario no visible / no cargado
      cards.push(row.recommended_color ? productAsColorCard(base, row.recommended_color) : base);
    }
    return cards;
  }, [rows, byId, excludeKey]);

  return { items, isLoading };
}
