import { useMemo } from 'react';
import { ProductsSection } from '@/components/home/ProductsSection';
import { useProducts } from '@/hooks/useProducts';
import { productCategories, retailPrice } from '@/lib/utils';
import { useStore } from '@/context/StoreProvider';
import type { CustomSection, CustomSectionProductsContent, Product } from '@/lib/types';

/**
 * Grilla de productos a medida del comercio.
 *
 * Las tres secciones fijas del home (Destacados / Nuevos / Ofertas) tienen la
 * membresía decidida por reglas — ranking de ventas, recencia, promociones
 * activas. Acá la elige él, y por eso esta sección se puede repetir: una por
 * categoría, marca o segmento que quiera destacar.
 *
 * El filtro corre sobre el catálogo YA cargado (useProducts lo trae entero y lo
 * cachea), así que agregar diez de estas no agrega una sola query.
 */

/** True si el producto entra en la sección según el criterio configurado. */
function matches(p: Product, source: string, value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return true;
  switch (source) {
    case 'category':
      return productCategories(p).some((c) => c.toLowerCase() === v);
    case 'brand':
      return (p.brand || '').trim().toLowerCase() === v;
    case 'segment':
      return (p.segment || '').trim().toLowerCase() === v;
    default:
      return true;
  }
}

export function CustomProductsSection({ section }: { section: CustomSection }) {
  const c = section.content as CustomSectionProductsContent;
  const { products, isLoading } = useProducts();
  const { storeType } = useStore();

  const source = c.source || 'all';
  const value = c.value || '';
  const sort = c.sort || 'default';

  const selected = useMemo(() => {
    // `products` ya viene ordenado con stock primero y, dentro de eso, por
    // created_at DESC. Ese es el orden 'default' y también el de 'newest': el
    // sort sólo se reemplaza cuando el comercio pide uno por precio.
    const filtered = source === 'all' ? products.slice() : products.filter((p) => matches(p, source, value));
    if (sort === 'price_asc' || sort === 'price_desc') {
      // En mayorista el precio que ve el comprador es wholesale_price; ordenar
      // por el minorista dejaría la grilla en un orden que no se corresponde con
      // los números que está viendo.
      const price = (p: Product) =>
        storeType === 'wholesale' ? Number(p.wholesale_price ?? 0) : retailPrice(p);
      const dir = sort === 'price_asc' ? 1 : -1;
      filtered.sort((a, b) => (price(a) - price(b)) * dir);
    }
    return filtered;
  }, [products, source, value, sort, storeType]);

  // Mientras carga el catálogo no dibujamos nada (el gate de pintado del home ya
  // espera a useProducts, así que esto es sólo para el caso de la ficha).
  if (isLoading) return null;

  const heading = (c.heading || '').trim() || value || 'Productos';
  const maxItems = typeof c.max_items === 'number' && c.max_items > 0 ? Math.min(48, c.max_items) : 12;

  return <ProductsSection label={c.label} title={heading} products={selected} maxItems={maxItems} />;
}
