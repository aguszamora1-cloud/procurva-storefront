// Optimización de imágenes servidas desde Supabase Storage.
//
// Antes reescribíamos las URLs públicas al endpoint de transformación de Supabase
// (/storage/v1/render/image/) para servir thumbnails livianos, pero eso consume la
// cuota de Image Transformations. Ya no hace falta: el origen se sube como WebP
// ≤1200px (compressImage en procurva2), así que servimos la URL pública directa.
// `transformedSrc` quedó como pass-through (ver abajo).

const PUBLIC_OBJECT = '/storage/v1/object/public/';

/** ¿Es una URL pública de Supabase Storage? */
export function isSupabasePublicImage(url: string): boolean {
  return typeof url === 'string' && url.includes(PUBLIC_OBJECT);
}

export interface TransformOpts {
  /** Ancho objetivo en px (se sirve a 1x; el navegador escala con CSS). */
  width?: number;
  /** Alto objetivo en px. Solo necesario si se quiere recortar con `resize`. */
  height?: number;
  /** Calidad 20-100. Default 70. */
  quality?: number;
  /** Modo de redimensionado. Solo aplica si se pasa width + height. */
  resize?: 'cover' | 'contain' | 'fill';
}

/**
 * Pass-through: devuelve la URL pública directa sin transformar.
 *
 * Mantiene la firma y `TransformOpts` por compatibilidad con los call sites
 * (StoreImage, Hero, ProductGrid…), pero ignora width/height/quality/resize.
 * Ver el comentario de cabecera del archivo para el porqué.
 */
export function transformedSrc(url: string | null | undefined, _opts: TransformOpts = {}): string {
  // Pass-through: ya NO usamos el endpoint de transformación /storage/v1/render/image/
  // (cuenta contra la cuota de Image Transformations). El origen ya se sube como
  // WebP ≤1200px (compressImage en procurva2), así que servimos la URL pública
  // directa sin transformar. Los argumentos (width/quality/resize) se ignoran a
  // propósito; la firma y TransformOpts se mantienen para no tocar los call sites.
  return url ?? '';
}
