import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useStoreType } from '@/context/StoreProvider';
import { useWholesalePricing } from '@/context/WholesalePricingContext';
import { usePromotions } from '@/context/PromotionsContext';
import { applyPromoToPrice } from '@/lib/promotions';
import type { Product } from '@/lib/types';
import { PriceDisplay } from './PriceDisplay';
import { WholesalePriceTable } from './WholesalePriceTable';
import { StoreImage } from './StoreImage';
import { CardBadge } from './CardBadge';
import { badgeColor, colorToHex, getPriceInfo, mainImage, totalStock } from '@/lib/utils';

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const image = mainImage(product);
  // Virtual card por color: el link al detalle pre-selecciona ese color.
  const detailHref = product.variant_color
    ? `/producto/${product.id}?color=${encodeURIComponent(product.variant_color)}`
    : `/producto/${product.id}`;
  const siblingColors = product.variant_color ? product.sibling_colors ?? [] : [];
  const { comparePrice, compareDiscountPct } = getPriceInfo(product);
  const onSale = Boolean(comparePrice && compareDiscountPct > 0); // oferta vs precio de lista
  const isWholesale = useStoreType() === 'wholesale';
  const { curveTiers, productPacks } = useWholesalePricing();
  const { promoForProduct, quantityPromoFor } = usePromotions();
  // Promoción automática vigente para este producto (descuento del modo actual).
  const promo = promoForProduct(product);
  // Promo por cantidad (no descuenta hasta llegar al mínimo en el carrito; solo badge).
  const qtyPromo = quantityPromoFor(product);
  // En mayorista, descontamos cada precio por unidad de la tabla de curvas/packs.
  const wholesaleDiscount = promo ? (p: number) => applyPromoToPrice(p, promo, 'wholesale') : undefined;

  const stock = totalStock(product);
  const outOfStock = stock <= 0;
  const lowStock = stock > 0 && stock <= 5;
  const showBadge = product.catalog_badge_visible && product.catalog_badge_text;

  // Minorista: catálogo limpio (foto + nombre + precio, sin recuadro ni acciones
  // de compra). Mayorista conserva su tarjeta y el flujo suelto/curva del detalle.
  return (
    <article
      className={`group flex h-full flex-col overflow-hidden bg-background${
        isWholesale ? ' border border-line-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover' : ''
      }`}
    >
      {/* Imagen */}
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
        <Link to={detailHref} className="block h-full w-full">
          {image ? (
            <StoreImage
              src={image}
              alt={product.name}
              transformWidth={500}
              width={400}
              height={500}
              loading={priority ? 'eager' : 'lazy'}
              className={`h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.04]${
                outOfStock ? ' opacity-50 grayscale' : ''
              }`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-[1px] text-on-surface-subtle">
              Sin imagen
            </div>
          )}
        </Link>

        {/* Badge — UNO solo por tarjeta. Prioridad: sin stock > descuento > badge del comercio > últimas unidades. */}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1.5 md:left-3 md:top-3">
          {outOfStock ? (
            <CardBadge bg="#525252">Sin stock</CardBadge>
          ) : promo ? (
            <CardBadge bg={promo.badge_color || 'var(--color-accent)'}>{promo.badge_text || 'PROMO'}</CardBadge>
          ) : qtyPromo ? (
            <CardBadge bg={qtyPromo.badge_color || 'var(--color-accent)'}>{qtyPromo.badge_text || 'PROMO'}</CardBadge>
          ) : onSale && !isWholesale ? (
            <CardBadge bg="var(--color-accent)" color="var(--color-on-accent)">
              -{compareDiscountPct}%
            </CardBadge>
          ) : showBadge ? (
            <CardBadge bg={badgeColor(product.catalog_badge_color)}>{product.catalog_badge_text}</CardBadge>
          ) : lowStock ? (
            <CardBadge bg="#EF4444" className="px-2.5 py-0.5 text-[10px]">
              <Zap className="h-3 w-3" fill="currentColor" />
              Últimas unidades
            </CardBadge>
          ) : null}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col p-2.5 md:p-4">
        <Link to={detailHref} className="block">
          <h3 className="mb-1.5 text-[15px] font-bold uppercase leading-[1.3] tracking-[0.02em] text-on-surface transition-colors group-hover:text-accent">
            {product.name}
          </h3>
          {isWholesale ? (
            <WholesalePriceTable
              wholesalePrice={product.wholesale_price ?? 0}
              tiers={curveTiers[product.id] ?? []}
              packs={productPacks[product.id] ?? []}
              variant="card"
              discount={wholesaleDiscount}
            />
          ) : (
            <PriceDisplay product={product} variant="card" />
          )}
        </Link>

        {/* Swatches de los otros colores del mismo producto (modo "card por color").
            Fuera del <Link> de arriba para no anidar links. El contenedor reserva su
            alto SIEMPRE (con o sin colores) para que el footer arranque a la misma
            altura en todas las tarjetas de la fila. */}
        <div className="mt-2 flex min-h-[20px] flex-wrap items-center gap-1.5">
          {siblingColors.length > 0 &&
            siblingColors.slice(0, 5).map((c) => (
              <Link
                key={c}
                to={`/producto/${product.id}?color=${encodeURIComponent(c)}`}
                title={c}
                aria-label={`Ver ${c}`}
                className="h-5 w-5 rounded-full border border-line ring-1 ring-inset ring-black/5 transition-transform hover:scale-110"
                style={{ backgroundColor: colorToHex(c) }}
              />
            ))}
          {siblingColors.length > 5 && (
            <span className="text-[11px] text-subtle">+{siblingColors.length - 5}</span>
          )}
        </div>

        {/* Mayorista: el flujo suelto/curva vive en el detalle → CTA que navega ahí.
            mt-auto lo pega al fondo para emparejar el footer entre tarjetas. */}
        {isWholesale && (
          <div className="mt-auto pt-3">
            <Link
              to={detailHref}
              className="inline-flex w-full items-center justify-center gap-2 bg-primary py-[14px] text-[14px] font-bold text-on-primary transition-colors duration-200 hover:bg-accent hover:text-on-accent"
            >
              Comprar
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
