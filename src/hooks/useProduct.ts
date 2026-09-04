import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { variantStockCol, isMissingCatalogStock } from '@/lib/variantStock';
import { useStoreStatus } from '@/context/StoreProvider';
import { applyStoreStatus } from '@/lib/productStatus';
import { matchesProductFilter } from '@/lib/productFilter';
import type { Product } from '@/lib/types';

interface ProductState {
  product: Product | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

// El stock de las variantes se pide con alias: en la tienda, `stock` es el stock
// VENDIBLE POR LA WEB, no el total del ERP (ver lib/variantStock).
const productColumnsBase = (stockCol: string) => `
  id, company_id, name, description, status,
  retail_price, retail_price_transfer, retail_price_card, compare_at_price, wholesale_price,
  image_url, images, categories,
  catalog_visible, catalog_badge_text, catalog_badge_color, catalog_badge_visible,
  pack_only_sale, created_at,
  product_variants ( id, product_id, company_id, size, color, ${stockCol}, price, sku, image_url )
`;
// curva_surtida_enabled y product_media van aparte: si esas migraciones todavía
// no se aplicaron la query falla y caemos a BASE (sin romper el detalle; la
// curva surtida no se ofrece y no se muestran videos).
// track_stock (stock infinito, migración 20260819) va con las opcionales por la
// misma razón: sin la migración, pedirla explícitamente rompe el detalle.
const productColumns = (stockCol: string) =>
  `${productColumnsBase(stockCol)}, curva_surtida_enabled, free_shipping, track_stock, product_media ( id, type, url, thumbnail_url, sort_order, object_position )`;

/** Un producto por id, scoped al tenant actual. */
export function useProduct(productId: string | undefined): ProductState {
  const { companyId, productFilter } = useStoreStatus();
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
      const fetchWith = (columns: string) =>
        supabase
          .from('products')
          .select(columns)
          .eq('company_id', companyId)
          .eq('id', productId)
          .maybeSingle();

      let stockCol = variantStockCol();
      let { data, error } = await fetchWith(productColumns(stockCol));

      // Fallback 1: catalog_stock todavía no existe (migración sin aplicar).
      if (error && isMissingCatalogStock(error)) {
        stockCol = 'stock';
        ({ data, error } = await fetchWith(productColumns(stockCol)));
      }

      // Fallback 2: algo opcional aún no existe (migración sin aplicar):
      // curva_surtida_enabled/free_shipping (columnas) o product_media (tabla).
      if (error && /curva_surtida_enabled|free_shipping|product_media/i.test(error.message)) {
        ({ data, error } = await fetchWith(productColumnsBase(stockCol)));
      }

      if (cancelled) return;
      if (error) {
        setProduct(null);
        setError(error.message);
        setIsLoading(false);
        return;
      }
      // Oculto (catalog_visible=false) o Inactivo: para la tienda no existe, ni
      // por link directo -> "Producto no encontrado". Si está marcado Agotado
      // llega con stock 0 y el detalle lo pinta como no comprable.
      //
      // Lo mismo para un producto que NO es de esta tienda: la ficha se pide por
      // id, así que sin este chequeo un link directo mostraría un producto de la
      // otra marca aunque no aparezca en ningún listado.
      const visible = data && matchesProductFilter(data as any, productFilter);
      setProduct(visible ? applyStoreStatus(data as unknown as Product) : null);
      setError(null);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, productId, reloadKey]);

  return { product, isLoading, error, reload };
}
