// Qué productos muestra ESTA tienda.
//
// Un negocio puede tener varias tiendas sobre un mismo depósito y un mismo stock
// — típicamente dos marcas — y cada una tiene que mostrar sólo lo suyo. El filtro
// se configura por tienda en el admin y viaja en el payload de
// `get_storefront_by_slug` como `product_filter`.
//
// Todas las lecturas de productos del storefront pasan por acá: el listado, la
// ficha, el menú de categorías, los outfits y los más vendidos. Si alguna se
// olvida, esa pantalla muestra los productos de la otra marca.
//
// REGLA: un filtro sin valores elegidos NO filtra. Es a propósito — una tienda
// vacía se lee como que la app se rompió, y el admin avisa lo mismo.

export type ProductFilterMode = 'all' | 'brand' | 'category' | 'segment';

export interface ProductFilter {
  mode: ProductFilterMode;
  values: string[];
}

export const ALL_PRODUCTS: ProductFilter = { mode: 'all', values: [] };

/** La columna de `products` que mira cada modo. */
const COLUMN_BY_MODE: Record<Exclude<ProductFilterMode, 'all'>, 'brand' | 'segment' | 'categories'> = {
  brand: 'brand',
  segment: 'segment',
  category: 'categories',
};

/** Normaliza lo que venga del payload (o de una cache vieja) a un filtro usable. */
export function normalizeProductFilter(raw: unknown): ProductFilter {
  if (!raw || typeof raw !== 'object') return ALL_PRODUCTS;
  const mode = (raw as any).mode;
  if (mode !== 'brand' && mode !== 'category' && mode !== 'segment') return ALL_PRODUCTS;
  const values = Array.isArray((raw as any).values)
    ? (raw as any).values.filter((v: unknown): v is string => typeof v === 'string' && v.trim() !== '')
    : [];
  return { mode, values };
}

/** ¿Este filtro recorta algo? Un filtro sin valores no filtra. */
export function isFilterActive(filter: ProductFilter | null | undefined): boolean {
  return !!filter && filter.mode !== 'all' && filter.values.length > 0;
}

/**
 * Aplica el filtro a una query de Supabase sobre `products`.
 *
 * Se hace en el servidor y no en memoria a propósito: un catálogo grande con
 * filtro por marca traería igual todos los productos de la otra marca por la red
 * antes de descartarlos, y el paginado contaría mal.
 */
// El parámetro NO se restringe estructuralmente (`T extends { in, overlaps }`) a
// propósito: los tipos del query builder de supabase-js son lo bastante profundos
// como para que esa restricción haga explotar la inferencia con TS2589 ("type
// instantiation is excessively deep"). Con `T` libre y un cast adentro, el tipo
// que ve el llamador es exactamente el que le pasó.
export function applyProductFilter<T>(query: T, filter: ProductFilter | null | undefined): T {
  if (!isFilterActive(filter)) return query;
  const f = filter as ProductFilter;
  const column = COLUMN_BY_MODE[f.mode as Exclude<ProductFilterMode, 'all'>];
  const q = query as any;
  // `categories` es un text[]: la fila entra si comparte AL MENOS una categoría
  // con las elegidas. `brand` y `segment` son texto plano.
  return (column === 'categories' ? q.overlaps(column, f.values) : q.in(column, f.values)) as T;
}

/**
 * Versión en memoria, para lo que ya vino de la base sin poder filtrarse en la
 * query (por ejemplo los más vendidos, que salen de una RPC).
 */
export function matchesProductFilter(
  product: { brand?: string | null; segment?: string | null; categories?: string[] | null },
  filter: ProductFilter | null | undefined,
): boolean {
  if (!isFilterActive(filter)) return true;
  const f = filter as ProductFilter;
  if (f.mode === 'brand') return !!product.brand && f.values.includes(product.brand);
  if (f.mode === 'segment') return !!product.segment && f.values.includes(product.segment);
  const cats = Array.isArray(product.categories) ? product.categories : [];
  return cats.some((c) => f.values.includes(c));
}

/**
 * Parte estable de una clave de cache. DOS tiendas de la misma empresa con el
 * mismo modo comparten `companyId` y `storeType`: sin esto, el visitante que
 * salta de una marca a la otra ve el catálogo cacheado de la anterior.
 */
export function productFilterKey(filter: ProductFilter | null | undefined): string {
  if (!isFilterActive(filter)) return 'all';
  const f = filter as ProductFilter;
  return `${f.mode}:${[...f.values].sort().join('|')}`;
}
