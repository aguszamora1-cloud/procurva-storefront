import { useState } from 'react';
import { transformedSrc, type TransformOpts } from '@/lib/images';

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'> {
  src: string | null | undefined;
  alt: string;
  /** Ancho objetivo para la transformación de Supabase (thumbnail liviano). */
  transformWidth?: number;
  quality?: number;
  resize?: TransformOpts['resize'];
  /** Atributos intrínsecos para reservar espacio y evitar CLS. */
  width?: number;
  height?: number;
  /** 'eager' para above-the-fold (LCP), 'lazy' para el resto. Default 'lazy'. */
  loading?: 'eager' | 'lazy';
}

/**
 * <img> optimizado para el storefront:
 *  - reescribe URLs de Supabase Storage a thumbnails transformados (width/quality);
 *  - loading="lazy" + decoding="async" por defecto;
 *  - width/height intrínsecos para reservar el layout (anti-CLS);
 *  - si la transformación falla (proyecto sin Image Transformations), hace
 *    fallback automático a la URL original — las imágenes nunca se rompen.
 */
export function StoreImage({
  src,
  alt,
  transformWidth,
  quality,
  resize,
  width,
  height,
  loading = 'lazy',
  decoding = 'async',
  ...rest
}: Props) {
  const [failed, setFailed] = useState(false);
  const original = src ?? '';
  const optimized = transformWidth
    ? transformedSrc(original, { width: transformWidth, quality, resize })
    : original;
  const finalSrc = failed ? original : optimized;

  if (!original) return null;

  return (
    <img
      src={finalSrc}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
      onError={() => {
        // La transformada falló (p. ej. proyecto sin Image Transformations).
        if (!failed && optimized !== original) setFailed(true);
      }}
      {...rest}
    />
  );
}
