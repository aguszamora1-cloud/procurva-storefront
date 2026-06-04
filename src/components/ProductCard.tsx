import { Link } from 'react-router-dom';
import type { Product } from '@/lib/types';
import {
  availableColors,
  badgeColor,
  colorToHex,
  formatPrice,
  mainImage,
  retailPrice,
  totalStock,
} from '@/lib/utils';

export function ProductCard({ product }: { product: Product }) {
  const img = mainImage(product);
  const price = retailPrice(product);
  const colors = availableColors(product).slice(0, 5);
  const stock = totalStock(product);
  const lowStock = stock > 0 && stock <= 5;
  const showBadge = product.catalog_badge_visible && product.catalog_badge_text;

  return (
    <Link to={`/producto/${product.id}`} className="group flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        {img ? (
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            Sin imagen
          </div>
        )}
        {showBadge && (
          <span
            className="absolute left-0 top-3 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: badgeColor(product.catalog_badge_color) }}
          >
            {product.catalog_badge_text}
          </span>
        )}
        {lowStock && (
          <span className="absolute bottom-3 left-3 bg-background/90 px-2 py-1 text-[0.65rem] font-semibold uppercase text-accent">
            Últimas unidades
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-3">
        <h3 className="product-title line-clamp-2 transition-colors group-hover:text-accent">
          {product.name}
        </h3>
        <div className="mt-1 flex items-center justify-between">
          <span className="price">{formatPrice(price)}</span>
          {colors.length > 0 && (
            <div className="flex items-center gap-1">
              {colors.map((c) => (
                <span
                  key={c}
                  title={c}
                  className="shape-circle h-3 w-3 border border-line"
                  style={{ backgroundColor: colorToHex(c) }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
