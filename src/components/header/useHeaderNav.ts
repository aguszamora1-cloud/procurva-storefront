import { useEffect, useState } from 'react';
import { useStore, useStoreStatus } from '@/context/StoreProvider';
import { applyProductFilter, productFilterKey } from '@/lib/productFilter';
import { storeScopeValues } from '@/lib/storeScope';
import { usePromotions } from '@/context/PromotionsContext';
import { promoVisibleIn } from '@/lib/promoPage';
import { supabase } from '@/lib/supabase';
import { applyStockOverrides, isOutOfStock, isUnpublished } from '@/lib/productStatus';
import { selectWithVariantStock } from '@/lib/variantStock';

interface CategoryOrderRow {
  category_name: string;
  visible: boolean | null;
  image_url: string | null;
}

/**
 * Lo que el encabezado ofrece para navegar, igual para todas las variantes:
 * links fijos, promociones vigentes, categorías, Outfits y los ítems que agrega
 * el comercio. Es la lógica que antes vivía en Navbar, movida sin cambios: las
 * variantes sólo deciden CÓMO mostrarla.
 */
export function useHeaderNav() {
  const config = useStore();
  const { storeType, storeKey, productFilter, hideOutOfStock } = useStoreStatus();
  const productFilterKeyStr = productFilterKey(productFilter);
  // Promos vigentes que descuentan algo en ESTA tienda (canal). Cada una tiene su
  // página (/promo/:slug); se van solas del menú cuando vencen.
  const { promotions } = usePromotions();
  const menuPromos = promotions.filter((p) => promoVisibleIn(p, storeType ?? 'retail'));
  const [categories, setCategories] = useState<string[]>([]);
  // La sección Outfits vive en el home (no tiene página). Mostramos su link en el
  // menú sólo si está habilitada para esta tienda y hay al menos un outfit activo.
  const [hasOutfits, setHasOutfits] = useState(false);
  const showOutfitsLink =
    storeType !== 'wholesale' && config.isPro && config.sections.outfits && hasOutfits;

  // Links principales del menú. (Outfits se muestra como sección del home, no
  // tiene página propia, así que no se agrega para evitar un 404.)
  const navItems = [
    { label: 'INICIO', to: '/', end: true },
    { label: 'PRODUCTOS', to: '/productos', end: false },
  ];

  // Subcategorías del menú. Misma lógica que la página /categorias (useCategories):
  // las categorías viven en products.categories; catalog_category_order solo aporta
  // orden/visibilidad. Hacemos UNIÓN para no depender de que esa tabla esté
  // sincronizada: filas ordenadas/visibles con productos (o imagen propia) +
  // categorías reales de productos que no estén en la tabla. Sin esto, una fila
  // huérfana "Otros" (0 productos) sería lo único que se mostraría en el menú.
  useEffect(() => {
    const cid = config.companyId;
    if (!cid) return;
    let cancelled = false;
    (async () => {
      // En mayorista los productos se filtran por wholesale_price>0 (igual que useProducts).
      const priceCol = storeType === 'wholesale' ? 'wholesale_price' : 'retail_price';
      const [orderRes, prodRes] = await Promise.all([
        // El orden/visibilidad de categorías también es de ESTA tienda.
        supabase
          .from('catalog_category_order')
          .select('category_name, sort_order, visible, image_url')
          .eq('company_id', cid)
          .in('store_key', storeScopeValues(storeKey, ''))
          .order('sort_order', { ascending: true }),
        // El menú lateral tiene su PROPIA query (no pasa por useProducts), así
        // que también le va el filtro de catálogo: si no, la segunda marca
        // muestra en el menú las categorías de la primera.
        //
        // Con "ocultar sin stock" se piden además las variantes: si no, una
        // categoría cuyos productos están todos agotados seguiría en el menú y
        // abriría vacía. Sin la opción, la query sigue siendo la liviana.
        hideOutOfStock
          ? selectWithVariantStock((stockCol) =>
              applyProductFilter(
                supabase
                  .from('products')
                  .select(`categories, status, track_stock, product_variants ( ${stockCol} )`)
                  .eq('company_id', cid)
                  .eq('catalog_visible', true)
                  .gt(priceCol, 0),
                productFilter,
              ),
            )
          : applyProductFilter(
              supabase
                .from('products')
                .select('categories, status')
                .eq('company_id', cid)
                .eq('catalog_visible', true)
                .gt(priceCol, 0),
              productFilter,
            ),
      ]);
      if (cancelled) return;

      // Conteo por categoría a partir de los productos visibles. El status se
      // filtra en JS y no con .neq(): en SQL, `status <> 'Inactivo'` es NULL para
      // las filas sin estado y se llevaría puestos esos productos.
      type MenuProductRow = {
        categories: string[] | null;
        status: string | null;
        track_stock?: boolean | null;
        product_variants?: { stock?: number | null }[] | null;
      };
      const counts = new Map<string, number>();
      for (const p of (prodRes.data as MenuProductRow[] | null) ?? []) {
        if (isUnpublished(p)) continue;
        if (hideOutOfStock && isOutOfStock(applyStockOverrides(p))) continue;
        for (const c of Array.isArray(p.categories) ? p.categories : []) {
          counts.set(c, (counts.get(c) ?? 0) + 1);
        }
      }

      const rows = (orderRes.data as CategoryOrderRow[] | null) ?? [];
      const known = new Set(rows.map((r) => r.category_name));
      // Ordenadas: visibles y con productos (o imagen propia → vacía intencional).
      const ordered = rows
        .filter((r) => r.visible !== false)
        .filter((r) => (counts.get(r.category_name) ?? 0) > 0 || r.image_url)
        .map((r) => r.category_name);
      // Reales no listadas en la tabla, alfabético.
      const extra = Array.from(counts.entries())
        .filter(([name, count]) => count > 0 && !known.has(name))
        .map(([name]) => name)
        .sort((a, b) => a.localeCompare(b, 'es'));

      setCategories([...ordered, ...extra]);
    })();
    return () => {
      cancelled = true;
    };
  }, [config.companyId, storeType, storeKey, productFilterKeyStr, hideOutOfStock]);

  // ¿La tienda tiene outfits activos? Query liviana (solo count) gateada por los
  // mismos flags que el home usa para renderizar la sección.
  useEffect(() => {
    const cid = config.companyId;
    if (!cid || storeType === 'wholesale' || !config.isPro || !config.sections.outfits) {
      setHasOutfits(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('catalog_outfits')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', cid)
        .eq('active', true);
      if (!cancelled) setHasOutfits((count ?? 0) > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [config.companyId, config.isPro, config.sections.outfits, storeType]);

  return { navItems, menuPromos, categories, showOutfitsLink, menuItems: config.menuItems };
}

export type HeaderNav = ReturnType<typeof useHeaderNav>;
