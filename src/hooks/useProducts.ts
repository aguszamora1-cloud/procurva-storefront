import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import { hasStock } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface ProductsState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

// Columnas mínimas para las CARDS del catálogo (home + listados + relacionados).
// NO traemos `description` (texto largo, solo se usa en el detalle vía useProduct)
// y de las variantes solo pedimos lo que la card necesita: size/color/stock para
// disponibilidad y stock, e image_url para el modo "card por color"
// (display_variants_separately). Omitir id/price/sku por variante achica mucho el
// payload en catálogos grandes (las variantes multiplican por producto).
//
// is_featured y display_variants_separately van aparte: si alguna de esas
// migraciones todavía no se aplicó, la query falla y caemos a COLS_BASE (sin
// romper el grid; el modo "card por color" simplemente no se activa hasta migrar).
const COLS_BASE = `
  id, company_id, name,
  retail_price, retail_price_transfer, retail_price_card, compare_at_price, wholesale_price,
  image_url, images, categories,
  catalog_visible, catalog_badge_text, catalog_badge_color, catalog_badge_visible,
  pack_only_sale, created_at,
  product_variants ( size, color, stock, image_url )
`;
const PRODUCT_COLUMNS = `${COLS_BASE}, is_featured, is_new_arrival, display_variants_separately, curva_surtida_enabled, free_shipping`;

const OPTIONAL_COLS_RE = /is_featured|is_new_arrival|display_variants_separately|curva_surtida_enabled|free_shipping/i;

// Una vez que detectamos en esta sesión que las columnas opcionales NO existen
// (migración sin aplicar), recordamos ir directo a COLS_BASE para no pagar el
// doble-query (intento extendido que falla + reintento base) en cada navegación.
let preferBaseColumns = false;

// Cache stale-while-revalidate de productos (mismo patrón que la config del
// tenant): servimos el catálogo cacheado para el primer paint instantáneo y
// SIEMPRE revalidamos contra Supabase en segundo plano. v1: payload recortado.
const CACHE_VERSION = 'v1';
const cacheKey = (companyId: string, storeType: string) =>
  `procurva_products_${CACHE_VERSION}:${companyId}:${storeType}`;

function readProductsCache(key: string): Product[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Product[]) : null;
  } catch {
    return null;
  }
}

function writeProductsCache(key: string, products: Product[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(products));
  } catch {
    /* quota excedida o sessionStorage no disponible: ignorar (es solo cache) */
  }
}

/**
 * Productos visibles del tenant con sus variantes. Filtra por company_id y
 * catalog_visible. Los productos sin stock NO se descartan: se muestran con
 * cartel "Sin stock" (no comprables) y se ordenan al final de la lista.
 */
export function useProducts(): ProductsState {
  const { companyId, storeType } = useStoreStatus();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!companyId || !storeType) return;
    let cancelled = false;
    const key = cacheKey(companyId, storeType);

    // 1) Servir desde cache para el primer paint (stale-while-revalidate).
    const cached = readProductsCache(key);
    if (cached) {
      setProducts(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setError(null);

    // 2) Revalidación contra Supabase. SIEMPRE corre.
    (async () => {
      // En mayorista filtramos por wholesale_price>0 (los productos pueden tener
      // retail_price 0/null); en minorista, por retail_price>0 como siempre.
      const priceCol = storeType === 'wholesale' ? 'wholesale_price' : 'retail_price';
      const runQuery = (columns: string) =>
        supabase
          .from('products')
          .select(columns)
          .eq('company_id', companyId)
          .eq('catalog_visible', true)
          .gt(priceCol, 0)
          .order('created_at', { ascending: false });

      let data: unknown;
      let error: { message: string } | null;
      if (preferBaseColumns) {
        ({ data, error } = await runQuery(COLS_BASE));
      } else {
        ({ data, error } = await runQuery(PRODUCT_COLUMNS));
        // Si alguna columna opcional todavía no existe (migración sin aplicar),
        // reintentamos con COLS_BASE y recordamos la preferencia para la sesión.
        if (error && OPTIONAL_COLS_RE.test(error.message)) {
          preferBaseColumns = true;
          ({ data, error } = await runQuery(COLS_BASE));
        }
      }

      if (cancelled) return;
      if (error) {
        // Si ya teníamos cache, la mantenemos (no rompemos el grid por un error
        // transitorio de red); solo reportamos el error si no había nada.
        if (!cached) {
          setProducts([]);
          setError(error.message);
        }
        setIsLoading(false);
        return;
      }
      // No descartamos los sin stock: los ordenamos al final (sort estable, así
      // dentro de cada grupo se respeta el orden por created_at de la query).
      const next = ((data ?? []) as unknown as Product[])
        .slice()
        .sort((a, b) => Number(hasStock(b)) - Number(hasStock(a)));
      setProducts(next);
      setError(null);
      setIsLoading(false);
      writeProductsCache(key, next);
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, storeType, reloadKey]);

  return { products, isLoading, error, reload };
}
