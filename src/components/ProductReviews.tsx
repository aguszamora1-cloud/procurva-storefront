import { useMemo } from 'react';
import { useProductReviews } from '@/hooks/useProductReviews';
import type { ProductReview } from '@/lib/types';

const initials = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-0.5 leading-none" style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? 'text-amber-400' : 'text-line'}>
          ★
        </span>
      ))}
    </div>
  );
}

function ReviewCard({ r }: { r: ProductReview }) {
  return (
    <article className="flex flex-col gap-3 border border-line bg-[var(--color-background)] p-5">
      <Stars value={r.rating ?? 5} />
      <p className="text-[14px] leading-relaxed text-text">“{r.text}”</p>
      <div className="mt-1 flex items-center gap-3">
        {r.customer_photo_url ? (
          <img src={r.customer_photo_url} alt={r.customer_name} loading="lazy" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-text">
            {initials(r.customer_name)}
          </span>
        )}
        <span className="text-[12px] font-semibold uppercase tracking-[0.5px] text-text">{r.customer_name}</span>
      </div>
    </article>
  );
}

/**
 * Reseñas del producto en su página de detalle (Extra PRO). Se renderiza sólo si
 * el producto tiene reseñas activas. El gating de plan/section lo hace el caller.
 */
export function ProductReviews({ productId, title }: { productId: string; title?: string }) {
  const { reviews } = useProductReviews(productId);

  const average = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + (r.rating ?? 5), 0);
    return sum / reviews.length;
  }, [reviews]);

  if (reviews.length === 0) return null;

  const rounded = Math.round(average);
  const avgLabel = average.toFixed(average % 1 === 0 ? 0 : 1);
  const countLabel = reviews.length === 1 ? '1 opinión' : `${reviews.length} opiniones`;

  return (
    <section className="border-t border-line pt-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{title?.trim() || 'Opiniones de clientes'}</p>
        <div className="flex items-center gap-2">
          <Stars value={rounded} />
          <span className="text-[13px] font-semibold text-text">{avgLabel}</span>
          <span className="text-[13px] text-subtle">· {countLabel}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {reviews.map((r) => (
          <ReviewCard key={r.id} r={r} />
        ))}
      </div>
    </section>
  );
}
