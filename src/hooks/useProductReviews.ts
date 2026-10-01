import { useEffect, useState } from 'react';
import { useStore } from '@/context/StoreProvider';
import {
  fetchProductReviews,
  fetchRatingSummary,
  type RatingSummary,
  type VerifiedReview,
} from '@/lib/reviews';

/** ¿La tienda muestra reseñas? Extra PRO + sección "Reseñas en productos" prendida. */
export function useReviewsEnabled(): boolean {
  const config = useStore();
  return config.isPro && config.sections.productReviews;
}

/** Reseñas verificadas publicadas de un producto. Vacío si el extra está apagado. */
export function useProductReviews(productId: string | undefined): {
  reviews: VerifiedReview[];
  isLoading: boolean;
} {
  const { companyId } = useStore();
  const enabled = useReviewsEnabled();
  const [reviews, setReviews] = useState<VerifiedReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !companyId || !productId) {
      setReviews([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetchProductReviews(companyId, productId).then((data) => {
      if (cancelled) return;
      setReviews(data);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, companyId, productId]);

  return { reviews, isLoading };
}

/**
 * Promedio y cantidad de reseñas de un producto (para las cards y el encabezado
 * de la ficha). Comparte una sola consulta por tienda. null = sin reseñas.
 */
export function useRatingSummary(productId: string | undefined): RatingSummary | null {
  const { companyId } = useStore();
  const enabled = useReviewsEnabled();
  const [summary, setSummary] = useState<RatingSummary | null>(null);

  useEffect(() => {
    if (!enabled || !companyId || !productId) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    fetchRatingSummary(companyId).then((map) => {
      if (!cancelled) setSummary(map.get(productId) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, companyId, productId]);

  return summary;
}
