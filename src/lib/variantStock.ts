/**
 * Stock que la TIENDA puede vender, que no siempre es el stock total.
 *
 * `product_variants.stock` es el cache con la suma de TODOS los depósitos del
 * ERP. Si la empresa le configuró a la tienda una sucursal propia (Ajustes >
 * Depósitos > "La tienda online descuenta de"), la web tiene que mostrar el
 * stock de ESA sucursal: si no, muestra 30, el visitante compra 15 y el checkout
 * lo frena — el peor lugar posible para enterarse.
 *
 * `product_variants.catalog_stock` (migración 20260903_catalog_stock_column) trae
 * exactamente ese número, y es IGUAL a `stock` para toda empresa que no haya
 * configurado nada. Se pide con alias (`stock:catalog_stock`) para que el resto
 * de la tienda siga leyendo `stock` sin enterarse de nada.
 *
 * Si la migración todavía no está aplicada, PostgREST tira 42703 y se llevaría
 * puesto el catálogo entero (ver AUDIT: los SELECT explícitos son la trampa
 * clásica de esta tienda). Por eso el fallback: se reintenta con `stock` y se
 * recuerda para el resto de la sesión.
 */

let catalogStockMissing = false;

/** Columna de stock a pedir en el select de variantes. */
export function variantStockCol(): string {
  return catalogStockMissing ? 'stock' : 'stock:catalog_stock';
}

/**
 * ¿El error es "todavía no existe catalog_stock"? Si lo es, lo recuerda para no
 * volver a pagar el doble-query en cada navegación.
 */
export function isMissingCatalogStock(error: unknown): boolean {
  if (!error) return false;
  const e = error as { code?: string; message?: string };
  const msg = String(e.message ?? '');
  // Se exige que el mensaje NOMBRE la columna: un 42703 por otra columna que
  // falte no tiene que apagar esto para toda la sesión.
  if (!msg.includes('catalog_stock')) return false;
  catalogStockMissing = true;
  return true;
}

/**
 * Corre la query con `catalog_stock` y, si esa columna no existe todavía, la
 * repite con `stock`. `run` recibe el nombre de columna ya listo para el select.
 */
export async function selectWithVariantStock<T>(
  run: (stockCol: string) => PromiseLike<{ data: T | null; error: unknown }>,
): Promise<{ data: T | null; error: unknown }> {
  const first = await run(variantStockCol());
  if (first.error && isMissingCatalogStock(first.error)) {
    return await run('stock');
  }
  return first;
}
