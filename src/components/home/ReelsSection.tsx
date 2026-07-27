import { useReels } from '@/hooks/useReels';
import { useStore } from '@/context/StoreProvider';
import { ReelsCarousel } from '../ReelsCarousel';

/**
 * Sección de videos del HOME. Pool propio: sólo videos con placement='home'
 * (product_id NULL). Los videos de producto nunca aparecen acá.
 *
 * Si no hay videos no renderiza nada: sin estado vacío ni placeholder.
 */
export function ReelsSection() {
  const { reels } = useReels('home');
  const { reelsTitle } = useStore();
  if (reels.length === 0) return null;
  return <ReelsCarousel reels={reels} title={reelsTitle} />;
}
