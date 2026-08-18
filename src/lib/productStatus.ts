// ============================================================================
// products.status / products.catalog_visible aplicados a la tienda.
//
// El ERP tiene DOS controles distintos por producto y hasta ahora la tienda solo
// miraba uno:
//
//   - catalog_visible (interruptor "Mostrar en la tienda online"): oculta el
//     producto de la web sin darlo de baja. Lo filtran las queries de listado.
//   - status ('Activo' | 'Inactivo' | 'Agotado' | 'Borrador'): el estado en el
//     ERP. La tienda lo ignoraba, así que marcar "Agotado" no hacía nada: el
//     producto se seguía vendiendo si tenía stock cargado.
//
// Acá se traduce el estado a lo que ve el visitante:
//
//   - 'Inactivo' (y 'Borrador') -> el producto no existe para la tienda.
//   - 'Agotado'                 -> se muestra, con stock 0 en TODAS sus variantes.
//
// El stock a 0 es deliberado y es el único punto donde se traduce el estado:
// toda la tienda deriva "agotado" del stock de las variantes (el badge "Sin
// stock" de la card, el botón deshabilitado del detalle, los talles tachados, el
// orden que manda los agotados al final de la grilla, los packs y curvas del
// mayorista, los complementarios). Forzándolo en el borde de la query, esos ~15
// lugares hacen lo correcto sin tocarlos. Es seguro: la tienda solo LEE
// productos, nunca escribe stock.
// ============================================================================

/** Fila de producto con lo mínimo que mira este módulo. */
interface StatusRow {
  status?: string | null;
  catalog_visible?: boolean | null;
  product_variants?: { stock?: number | null }[] | null;
}

const norm = (s: string | null | undefined): string =>
  (s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

// Estados que NO van a la tienda. Es una lista de exclusión a propósito: un
// estado desconocido (o NULL, o vacío) se publica como hasta ahora. Al revés
// —publicar solo 'Activo'— un valor legacy inesperado le vaciaría el catálogo
// al comercio sin que nadie toque nada.
const NOT_PUBLISHED = new Set(['inactivo', 'borrador']);

/**
 * Estado que saca al producto de la tienda: 'Inactivo' (lo marcó el comercio) o
 * 'Borrador' (se guardó sin terminar desde la ficha).
 */
export function isUnpublished(row: StatusRow): boolean {
  return NOT_PUBLISHED.has(norm(row.status));
}

/** El comercio lo marcó Agotado a mano: se muestra pero no se puede comprar. */
export function isMarkedSoldOut(row: StatusRow): boolean {
  return norm(row.status) === 'agotado';
}

/**
 * No va a la tienda: Inactivo, o con el interruptor de publicación apagado.
 * `catalog_visible` se chequea con `=== false` porque las filas viejas pueden
 * tenerlo en NULL (la columna nace con DEFAULT true) y porque hay SELECTs que no
 * lo traen: sin el dato, el producto se publica igual que antes.
 */
export function isHiddenFromStore(row: StatusRow): boolean {
  return row.catalog_visible === false || isUnpublished(row);
}

/** Pone en 0 el stock de todas las variantes si el producto está marcado Agotado. */
export function forceSoldOutIfMarked<T extends StatusRow>(row: T): T {
  if (!isMarkedSoldOut(row)) return row;
  // El cast es por el genérico: TS no sabe que el spread sigue siendo un T.
  return {
    ...row,
    product_variants: (row.product_variants ?? []).map((v) => ({ ...v, stock: 0 })),
  } as T;
}

/**
 * Producto tal como debe verlo el visitante, o `null` si no va a la tienda.
 * Punto único: ver el comentario de arriba.
 */
export function applyStoreStatus<T extends StatusRow>(row: T): T | null {
  if (isHiddenFromStore(row)) return null;
  return forceSoldOutIfMarked(row);
}

/** Igual que applyStoreStatus, sobre una lista (descarta los que no van). */
export function applyStoreStatusList<T extends StatusRow>(rows: T[]): T[] {
  const out: T[] = [];
  for (const row of rows) {
    const next = applyStoreStatus(row);
    if (next) out.push(next);
  }
  return out;
}
