import { useEffect } from 'react';
import { useStore } from '@/context/StoreProvider';
import { useRatingSummary } from '@/hooks/useProductReviews';
import { setJsonLd } from '@/lib/seo';
import type { Product } from '@/lib/types';

const SCRIPT_ID = 'ld-product';
const CURRENCY_BY_COUNTRY: Record<string, string> = { AR: 'ARS', PY: 'PYG' };

/**
 * Datos estructurados del producto (schema.org/Product) para Google. Con
 * reseñas verificadas suma `aggregateRating`, que es lo que habilita las
 * estrellas en los resultados de búsqueda. Sólo cuenta reseñas de clientes
 * reales: Google penaliza el marcado de opiniones cargadas por la tienda.
 * No renderiza nada.
 */
export function ProductJsonLd({ product, images }: { product: Product; images: string[] }) {
  const config = useStore();
  const summary = useRatingSummary(product.id);
  // `images` llega como array nuevo en cada render de la ficha: la clave evita
  // reescribir el bloque en cada render.
  const imagesKey = images.slice(0, 5).join('|');

  useEffect(() => {
    const price = Number(product.retail_price || 0);
    const data: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      ...(imagesKey ? { image: imagesKey.split('|') } : {}),
      ...(product.description?.trim() ? { description: product.description.trim().slice(0, 5000) } : {}),
      brand: { '@type': 'Brand', name: config.name },
      ...(price > 0
        ? {
            offers: {
              '@type': 'Offer',
              price: price.toFixed(2),
              priceCurrency: CURRENCY_BY_COUNTRY[(config.country || 'AR').toUpperCase()] ?? 'ARS',
              url: typeof window !== 'undefined' ? window.location.href.split('?')[0] : undefined,
            },
          }
        : {}),
      ...(summary && summary.count > 0
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: summary.avg.toFixed(1),
              reviewCount: summary.count,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
    };
    setJsonLd(SCRIPT_ID, data);
  }, [product, imagesKey, summary, config.name, config.country]);

  // Al salir de la ficha, el bloque no tiene que quedar en otras páginas.
  useEffect(() => () => setJsonLd(SCRIPT_ID, null), []);

  return null;
}
