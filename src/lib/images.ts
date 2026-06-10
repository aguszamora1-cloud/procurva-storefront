// Optimización de imágenes servidas desde Supabase Storage.
//
// Supabase expone transformación de imágenes en el endpoint
//   /storage/v1/render/image/public/<bucket>/<path>?width=&quality=&resize=
// (sólo en planes pagos con Image Transformations activado). Reescribimos las
// URLs públicas (`/storage/v1/object/public/`) a ese endpoint para servir
// thumbnails livianos. Si el proyecto NO tiene transformación habilitada, el
// componente <StoreImage> hace fallback a la URL original con onError, así las
// imágenes nunca se rompen.

const PUBLIC_OBJECT = '/storage/v1/object/public/';
const RENDER_IMAGE = '/storage/v1/render/image/public/';

/** ¿Es una URL pública de Supabase Storage que podemos transformar? */
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
 * Devuelve la URL transformada (render/image) si es una imagen pública de
 * Supabase; si no, devuelve la URL original sin tocar.
 *
 * Importante: `resize` (cover/contain/fill) solo se envía cuando hay un box
 * completo (width + height). Con solo `width`, Supabase mantiene el aspect ratio
 * original y hace un downscale proporcional. Mandar `resize=cover` con solo
 * `width` rompe la proporción (devuelve una imagen con el alto original), lo que
 * provocaba que las fotos ya recortadas a 3:4 se vieran "zoomeadas" en las cards.
 */
export function transformedSrc(url: string | null | undefined, opts: TransformOpts = {}): string {
  if (!url || !isSupabasePublicImage(url)) return url ?? '';
  const { width, height, quality = 70, resize } = opts;
  const base = url.replace(PUBLIC_OBJECT, RENDER_IMAGE);
  const params = new URLSearchParams();
  if (width) params.set('width', String(Math.round(width)));
  if (height) params.set('height', String(Math.round(height)));
  params.set('quality', String(quality));
  if (resize && width && height) params.set('resize', resize);
  return `${base}?${params.toString()}`;
}
