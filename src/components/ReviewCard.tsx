import { BadgeCheck, Star } from 'lucide-react';

/**
 * Tarjeta de reseña — una sola implementación para las dos ubicaciones donde
 * aparecen opiniones: la sección del home (SocialProofSection) y la ficha de
 * producto (ProductReviews). Antes cada una tenía su propia copia y se fueron
 * separando de a poco; la misma reseña se veía distinta según dónde cayera.
 *
 * El orden de lectura es el del diseño de referencia: primero QUIÉN lo dice
 * (foto + nombre), después CUÁNTO puntuó (número + estrellas) y recién ahí el
 * texto. Poner la cara arriba es lo que le da peso de prueba social; con las
 * estrellas primero la tarjeta arranca en un dato abstracto.
 */

const initials = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

/**
 * Estrellas. Ojo con el gris de las vacías: tiene que ser un token pelado
 * (`text-line`), NO `text-line/30` — los colores del tema son `var(--color-*)`
 * sin `<alpha-value>` y Tailwind no genera la clase con opacidad (ver
 * scripts/check-dead-opacity.mjs).
 */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const filled = Math.floor(value);
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          width={size}
          height={size}
          strokeWidth={1.5}
          className={i < filled ? 'fill-amber-400 text-amber-400' : 'text-line'}
        />
      ))}
    </div>
  );
}

/** Lo mínimo que necesita la tarjeta: sirve para `Testimonial` y para las reseñas verificadas. */
export interface ReviewCardData {
  customer_name: string;
  customer_photo_url?: string | null;
  text: string;
  rating: number | null;
  /** Reseña de un cliente que compró (link único de la venta). */
  verified?: boolean;
  /** Fotos que subió el cliente con la reseña. */
  photo_urls?: string[];
}

/** `compact`: versión para la columna de la ficha (menos aire y tipografía más chica). */
export function ReviewCard({ review, compact }: { review: ReviewCardData; compact?: boolean }) {
  const rating = review.rating ?? 5;
  const avatar = compact ? 'h-11 w-11' : 'h-14 w-14';

  return (
    <article
      className={`flex h-full flex-col rounded-xl border border-line bg-[var(--color-background)] shadow-card ${
        compact ? 'p-4' : 'p-5 md:p-6'
      }`}
    >
      <div className={`flex items-center ${compact ? 'gap-3' : 'gap-4'}`}>
        {review.customer_photo_url ? (
          <img
            src={review.customer_photo_url}
            alt={review.customer_name}
            loading="lazy"
            className={`${avatar} shrink-0 rounded-xl object-cover`}
          />
        ) : (
          <span
            className={`${avatar} flex shrink-0 items-center justify-center rounded-xl bg-secondary font-semibold text-on-surface ${
              compact ? 'text-[calc(12px_*_var(--font-scale,1))]' : 'text-[calc(14px_*_var(--font-scale,1))]'
            }`}
          >
            {initials(review.customer_name)}
          </span>
        )}
        <div className="min-w-0">
          <p className={`font-semibold leading-tight text-on-surface ${compact ? 'text-[calc(14px_*_var(--font-scale,1))]' : 'text-[calc(16px_*_var(--font-scale,1))] md:text-[calc(17px_*_var(--font-scale,1))]'}`}>
            {review.customer_name}
          </p>
          {review.verified && (
            <p className="mt-1 flex items-center gap-1 text-[calc(12px_*_var(--font-scale,1))] text-on-surface-muted">
              <BadgeCheck width={14} height={14} strokeWidth={1.75} className="shrink-0" />
              Compra verificada
            </p>
          )}
        </div>
      </div>

      <div className={`flex items-center gap-2 ${compact ? 'my-3' : 'my-4'}`}>
        <span className={`font-bold text-on-surface ${compact ? 'text-[calc(13px_*_var(--font-scale,1))]' : 'text-[calc(15px_*_var(--font-scale,1))]'}`}>
          {rating.toFixed(1)}
        </span>
        <Stars value={rating} size={compact ? 14 : 16} />
      </div>

      {/* Una reseña verificada puede venir sólo con estrellas: sin texto no se
          dibujan las comillas vacías, pero el hueco flexible queda para que las
          tarjetas de una fila sigan parejas. */}
      {review.text?.trim() ? (
        <p className={`flex-1 leading-relaxed text-on-surface-muted ${compact ? 'text-[calc(13px_*_var(--font-scale,1))]' : 'text-[calc(14px_*_var(--font-scale,1))] md:text-[calc(15px_*_var(--font-scale,1))]'}`}>
          &ldquo;{review.text}&rdquo;
        </p>
      ) : (
        <div className="flex-1" />
      )}

      {review.photo_urls && review.photo_urls.length > 0 && (
        <div className={`flex gap-2 ${compact ? 'mt-3' : 'mt-4'}`}>
          {review.photo_urls.slice(0, 3).map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className={`${compact ? 'h-14 w-14' : 'h-16 w-16'} shrink-0 overflow-hidden rounded-md bg-secondary`}
            >
              <img src={url} alt={`Foto de ${review.customer_name}`} loading="lazy" className="h-full w-full object-cover" />
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
