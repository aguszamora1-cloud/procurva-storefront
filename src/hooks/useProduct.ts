import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
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

const PRODUCT_COLUMNS_BASE = `
  id, company_id, name, description, status,
  retail_price, retail_price_transfer, retail_price_card, compare_at_price, wholesale_price,
  image_url, images, categories,
  catalog_visible, catalog_badge_text, catalog_badge_color, catalog_badge_visible,
  pack_only_sale, created_at,
  product_variants ( id, product_id, company_id, size, color, stock, price, sku, image_url )
`;
// curva_surtida_enabled y product_media van aparte: si esas migraciones todavía
// no se aplicaron la query falla y caemos a BASE (sin romper el detalle; la
// curva surtida no se ofrece y no se muestran videos).
// track_stock (stock infinito, migración 20260819) va con las opcionales por la
// misma razón: sin la migración, pedirla explícitamente rompe el detalle.
const PRODUCT_COLUMNS = `${PRODUCT_COLUMNS_BASE}, curva_surtida_enabled, free_shipping, track_stock, product_media ( id, type, url, thumbnail_url, sort_order, object_position )`;

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
      let { data, error } = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .eq('company_id', companyId)
        .eq('id', productId)
        .maybeSingle();

      // Fallback si algo opcional aún no existe (migración sin aplicar):
      // curva_surtida_enabled/free_shipping (columnas) o product_media (tabla).
      if (error && /curva_surtida_enabled|free_shipping|product_media/i.test(error.message)) {
        ({ data, error } = await supabase
          .from('products')
          .select(PRODUCT_COLUMNS_BASE)
          .eq('company_id', companyId)
          .eq('id', productId)
          .maybeSingle());
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
