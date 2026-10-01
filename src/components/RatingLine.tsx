import { Stars } from '@/components/ReviewCard';
import { useRatingSummary } from '@/hooks/useProductReviews';

/**
 * Estrellas + promedio + cantidad de reseñas verificadas de un producto. Para
 * las cards del listado y el encabezado de la ficha. No pinta nada si el
 * producto no tiene reseñas o la tienda no tiene el extra prendido.
 */
export function RatingLine({ productId, variant = 'card' }: { productId: string; variant?: 'card' | 'detail' }) {
  const summary = useRatingSummary(productId);
  if (!summary || summary.count === 0) return null;

  const detail = variant === 'detail';
  const label = summary.avg.toFixed(1);
  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`${label} de 5 estrellas, ${summary.count} ${summary.count === 1 ? 'opinión' : 'opiniones'}`}
    >
      <Stars value={Math.round(summary.avg)} size={detail ? 15 : 12} />
      <span
        aria-hidden="true"
        className={`font-semibold text-text ${detail ? 'text-[calc(14px_*_var(--font-scale,1))]' : 'text-[calc(12px_*_var(--font-scale,1))]'}`}
      >
        {label}
      </span>
      <span
        aria-hidden="true"
        className={`text-muted ${detail ? 'text-[calc(14px_*_var(--font-scale,1))]' : 'text-[calc(12px_*_var(--font-scale,1))]'}`}
      >
        ({summary.count})
      </span>
    </div>
  );
}
