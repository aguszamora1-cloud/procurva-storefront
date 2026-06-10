import { Link } from 'react-router-dom';
import { useStoreType } from '@/context/StoreProvider';
import { useWholesalePricing } from '@/context/WholesalePricingContext';
import type { Product } from '@/lib/types';
import { PriceDisplay } from './PriceDisplay';
import { WholesalePriceTable } from './WholesalePriceTable';
import { StoreImage } from './StoreImage';
import { CardBadge } from './CardBadge';
import { badgeColor, getPriceInfo, mainImage, totalStock } from '@/lib/utils';

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const image = mainImage(product);
  const { comparePrice, compareDiscountPct } = getPriceInfo(product);
  const onSale = Boolean(comparePrice && compareDiscountPct > 0); // oferta vs precio de lista
  const isWholesale = useStoreType() === 'wholesale';
  const { curveTiers } = useWholesalePricing();

  const stock = totalStock(product);
  const lowStock = stock > 0 && stock <= 5;
  const showBadge = product.catalog_badge_visible && product.catalog_badge_text;

  // Minorista: catálogo limpio (foto + nombre + precio, sin recuadro ni acciones
  // de compra). Mayorista conserva su tarjeta y el flujo suelto/curva del detalle.
  return (
    <article
      className={`group flex flex-col overflow-hidden bg-background${
        isWholesale ? ' border border-line-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover' : ''
      }`}
    >
      {/* Imagen */}
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
        <Link to={`/producto/${product.id}`} className="block h-full w-full">
          {image ? (
            <StoreImage
              src={image}
              alt={product.name}
              transformWidth={500}
              width={400}
              height={500}
              loading={priority ? 'eager' : 'lazy'}
              className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-[1px] text-on-surface-subtle">
              Sin imagen
            </div>
          )}
        </Link>

        {/* Badge — UNO solo por tarjeta. Prioridad: descuento > badge del comercio > últimas unidades. */}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1.5 md:left-3 md:top-3">
          {onSale && !isWholesale ? (
            <CardBadge bg="var(--color-accent)" color="var(--color-on-accent)">
              -{compareDiscountPct}%
            </CardBadge>
          ) : showBadge ? (
            <CardBadge bg={badgeColor(product.catalog_badge_color)}>{product.catalog_badge_text}</CardBadge>
          ) : lowStock ? (
            <CardBadge bg="#EF4444">⚡ Últimas unidades</CardBadge>
          ) : null}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col p-2.5 md:p-4">
        <Link to={`/producto/${product.id}`} className="block">
          <h3 className="mb-1.5 text-[14px] font-semibold leading-[1.3] tracking-[-0.01em] text-on-surface transition-colors group-hover:text-accent md:text-[15px]">
            {product.name}
          </h3>
          {isWholesale ? (
            <WholesalePriceTable
              wholesalePrice={product.wholesale_price ?? 0}
              tiers={curveTiers[product.id] ?? []}
              variant="card"
            />
          ) : (
            <PriceDisplay product={product} variant="card" />
          )}
        </Link>

        {/* Mayorista: el flujo suelto/curva vive en el detalle → CTA que navega ahí. */}
        {isWholesale && (
          <div className="mt-3">
            <Link
              to={`/producto/${product.id}`}
              className="inline-flex w-full items-center justify-center gap-2 bg-primary py-[14px] text-[14px] font-bold uppercase tracking-[0.5px] text-on-primary transition-colors duration-200 hover:bg-accent hover:text-on-accent"
            >
              Comprar
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
