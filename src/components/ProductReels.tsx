import { useReels } from '@/hooks/useReels';
import { ReelsCarousel } from './ReelsCarousel';

/**
 * Videos de UN producto en su ficha. Pool separado del home: sólo filas con
 * placement='product' y ese product_id.
 *
 * No es otra galería — la galería son las fotos del producto. Esto es contenido
 * que ayuda a decidir la compra, por eso el título le habla al comprador
 * ("Mirá cómo queda") y no usa el nombre interno del panel.
 *
 * Si el producto no tiene videos no renderiza NADA: sin estado vacío ni
 * placeholder, para no meter un hueco en fichas que no cargaron videos.
 */
export function ProductReels({ productId }: { productId: string }) {
  const { reels } = useReels('product', productId);
  if (reels.length === 0) return null;
  // width="detail": la ficha usa max-w-[1200px], no el ancho completo del home.
  return <ReelsCarousel reels={reels} title="Mirá cómo queda" width="detail" />;
}
