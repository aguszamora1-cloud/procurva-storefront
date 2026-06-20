import { Link } from 'react-router-dom';
import { usePromotions } from '@/context/PromotionsContext';
import { PromoCountdown } from './PromoCountdown';

/**
 * Banner de promoción de tienda completa (scope 'all' con banner_image_url). Se
 * muestra arriba del grid del home. Si hay varias, mostramos la primera (la más
 * relevante). Linkea al listado de productos. Si la promo tiene countdown, lo
 * superpone sobre la imagen.
 */
export function PromoBannerAuto() {
  const { bannerPromotions } = usePromotions();
  const promo = bannerPromotions[0];
  if (!promo || !promo.banner_image_url) return null;

  return (
    <section className="relative">
      <Link to="/productos" className="block">
        <img
          src={promo.banner_image_url}
          alt={promo.name}
          className="h-auto w-full object-cover"
          loading="eager"
        />
        {promo.show_countdown && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2">
            <PromoCountdown endsAt={promo.ends_at} color={promo.badge_color} className="shadow-md" />
          </div>
        )}
      </Link>
    </section>
  );
}
