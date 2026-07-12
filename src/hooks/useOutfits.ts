import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import type { Outfit, Product } from '@/lib/types';

/** Outfit con sus productos ya resueltos y ordenados. */
export interface OutfitWithProducts extends Outfit {
  products: Product[];
}

// Columnas mínimas para la sección (imagen, precio y link). No traemos variantes
// ni filtramos por catalog_visible/stock: un look se muestra completo aunque algún
// producto esté agotado u oculto del listado general.
const OUTFIT_PRODUCT_COLUMNS =
  'id, company_id, name, image_url, images, retail_price, retail_price_card, retail_price_transfer, compare_at_price';

/** Outfits activos del tenant con sus productos resueltos, ordenados por `order`. */
export function useOutfits(): { outfits: OutfitWithProducts[]; isLoading: boolean } {
  const { companyId } = useStoreStatus();
  const [outfits, setOutfits] = useState<OutfitWithProducts[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      // 1) Outfits activos.
      const { data: outfitRows, error: outfitErr } = await supabase
        .from('catalog_outfits')
        .select('id, company_id, name, description, image_url, image_urls, order, active, combo_price')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('order', { ascending: true });

      if (cancelled) return;
      if (outfitErr) {
        console.error('[useOutfits] error cargando outfits:', outfitErr);
        setOutfits([]);
        setIsLoading(false);
        return;
      }

      const baseOutfits = (outfitRows ?? []) as Omit<Outfit, 'items'>[];
      if (baseOutfits.length === 0) {
        console.debug('[useOutfits] sin outfits activos para company', companyId);
        setOutfits([]);
        setIsLoading(false);
        return;
      }

      // 2) Items de esos outfits (sin embed: query separada, más robusta).
      const outfitIds = baseOutfits.map((o) => o.id);
      const { data: itemRows, error: itemErr } = await supabase
        .from('catalog_outfit_items')
        .select('outfit_id, product_id, variant_color, order')
        .in('outfit_id', outfitIds);

      if (cancelled) return;
      if (itemErr) console.error('[useOutfits] error cargando items:', itemErr);
      const items = (itemRows ?? []) as { outfit_id: string; product_id: string; variant_color: string | null; order: number | null }[];

      // 3) Productos referenciados (resueltos por id, sin filtro de visibilidad/stock).
      const productIds = Array.from(new Set(items.map((it) => it.product_id)));
      let productMap = new Map<string, Product>();
      if (productIds.length > 0) {
        const { data: prodRows, error: prodErr } = await supabase
          .from('products')
          .select(OUTFIT_PRODUCT_COLUMNS)
          .in('id', productIds);
        if (cancelled) return;
        if (prodErr) console.error('[useOutfits] error cargando productos:', prodErr);
        productMap = new Map(((prodRows ?? []) as unknown as Product[]).map((p) => [p.id, p]));
      }

      // 4) Ensamblar: cada outfit con sus productos en orden.
      const resolved: OutfitWithProducts[] = baseOutfits.map((o) => {
        const myItems = items
          .filter((it) => it.outfit_id === o.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const products = myItems
          .map((it) => productMap.get(it.product_id))
          .filter((p): p is Product => Boolean(p));
        return {
          ...o,
          items: myItems.map((it) => ({ product_id: it.product_id, variant_color: it.variant_color, order: it.order })),
          products,
        };
      });

      console.debug('[useOutfits] resueltos', {
        companyId,
        outfits: resolved.length,
        items: items.length,
        productosEncontrados: productMap.size,
        detalle: resolved.map((r) => ({ name: r.name, productos: r.products.length })),
      });

      setOutfits(resolved);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { outfits, isLoading };
}
