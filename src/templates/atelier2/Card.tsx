/**
 * Atelier 2 · tarjeta de producto (A2; el catálogo de A3 la reutiliza).
 *
 * Datos reales y nada más: foto (y la segunda al pasar el mouse), nombre,
 * precio con PriceView (contado, tarjeta, tachado: los mismos números que
 * Classic) y «Agotado» si no hay stock. Sin etiquetas inventadas.
 */

import { Link } from 'react-router-dom';
import { StoreImage } from '@/components/StoreImage';
import { mainImage } from '@/lib/utils';
import type { Product } from '@/lib/types';
import { cardHref, isSoldOut, secondImage } from '../shared/commerce';
import { PriceView } from '../shared/Price';

export function Atelier2Card({ product, big, priority }: { product: Product; big?: boolean; priority?: boolean }) {
  const img = mainImage(product);
  const alt = secondImage(product);
  const soldOut = isSoldOut(product);
  return (
    <article className={big ? 'a2-card a2-card--big' : 'a2-card'}>
      <Link to={cardHref(product)} className="a2-card__m" tabIndex={-1} aria-hidden="true">
        {img ? (
          <StoreImage src={img} alt="" width={600} height={800} loading={priority ? 'eager' : 'lazy'} />
        ) : (
          <span className="a2-card__noimg">Sin foto</span>
        )}
        {alt && <StoreImage src={alt} alt="" width={600} height={800} className="a2-card__alt" />}
        {soldOut && <span className="a2-card__flag">Agotado</span>}
      </Link>
      <Link to={cardHref(product)} className="a2-card__n">
        {product.name}
      </Link>
      <PriceView product={product} cls="a2-price" color={product.variant_color} />
    </article>
  );
}

export function Atelier2CardSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="a2-wrap a2-sk" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i}>
          <span className="a2-sk__img" />
          <span className="a2-sk__l" />
          <span className="a2-sk__l a2-sk__l--s" />
        </div>
      ))}
    </div>
  );
}
