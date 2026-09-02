// A qué tienda pertenece un contenido del home (banners, orden de categorías,
// reseñas, videos).
//
// Un negocio puede tener varias tiendas sobre un mismo depósito — típicamente dos
// marcas, o los sub-negocios de un mismo dueño. Esas tiendas comparten stock pero
// NO identidad: las reseñas de una marca no son las de la otra.
//
// LA REGLA (espeja 20260903_per_store_content):
//   El alcance de una fila es la CLAVE de la tienda, con un valor especial que
//   significa "las dos tiendas históricas":
//
//       ''      en catalog_banners.store_key y catalog_category_order.store_key
//       'both'  en catalog_reels.catalog_type (el valor que esa tabla ya usaba)
//
//   Una tienda NUEVA ve sólo lo suyo — arranca vacía, que es el punto. Las dos
//   históricas ven lo suyo más lo compartido, así ningún negocio de hoy pierde
//   nada.

/** Las dos claves de tienda que existían antes de multi-tienda. */
const LEGACY_STORE_KEYS = ['retail', 'wholesale'];

export function isLegacyStore(storeKey: string | null | undefined): boolean {
  return !!storeKey && LEGACY_STORE_KEYS.includes(storeKey);
}

/**
 * Los valores de alcance que esta tienda tiene que ver.
 *
 * `sharedValue` es cómo se escribe "las dos históricas" en esa tabla: '' para
 * banners y categorías, 'both' para videos. Pasar `null` cuando la tabla no
 * tiene alcance compartido (reseñas: cada fila es de una tienda concreta).
 */
export function storeScopeValues(
  storeKey: string | null | undefined,
  sharedValue: string | null,
): string[] {
  const key = storeKey || 'retail';
  if (sharedValue === null || !isLegacyStore(key)) return [key];
  return [key, sharedValue];
}

/** `true` si el error de Supabase es "esa columna no existe" (42703). */
export function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42703' || /store_key/i.test(error.message ?? '');
}
