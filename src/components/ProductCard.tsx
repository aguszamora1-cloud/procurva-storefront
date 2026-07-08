import { Link } from 'react-router-dom';
import { useStoreType } from '@/context/StoreProvider';
import { useWholesalePricing } from '@/context/WholesalePricingContext';
import { usePromotions } from '@/context/PromotionsContext';
import { applyPromoToPrice } from '@/lib/promotions';
import { useProductBadges } from '@/hooks/useProductBadges';
import type { Product } from '@/lib/types';
import { PriceDisplay } from './PriceDisplay';
import { WholesalePriceTable } from './WholesalePriceTable';
import { StoreImage } from './StoreImage';
import { CardBadge } from './CardBadge';
import { colorToHex, mainImage } from '@/lib/utils';

// Clases del contenedor de badges según la esquina elegida. En las esquinas
// inferiores se apila hacia arriba (flex-col-reverse) para no desbordar la card.
// Strings completos para que Tailwind los detecte en build.
const BADGE_POSITION_CLASSES: Record<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right', string> = {
  'top-left': 'left-2 top-2 md:left-3 md:top-3 items-start flex-col',
  'top-right': 'right-2 top-2 md:right-3 md:top-3 items-end flex-col',
  'bottom-left': 'left-2 bottom-2 md:left-3 md:bottom-3 items-start flex-col-reverse',
  'bottom-right': 'right-2 bottom-2 md:right-3 md:bottom-3 items-end flex-col-reverse',
};

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const image = mainImage(product);
  // Virtual card por color: el link al detalle pre-selecciona ese color.
  const detailHref = product.variant_color
    ? `/producto/${product.id}?color=${encodeURIComponent(product.variant_color)}`
    : `/producto/${product.id}`;
  const siblingColors = product.variant_color ? product.sibling_colors ?? [] : [];
  const isWholesale = useStoreType() === 'wholesale';
  const { curveTiers, productPacks } = useWholesalePricing();
  const { promoForProduct } = usePromotions();
  // Promoción automática vigente: en mayorista descuenta cada precio por unidad.
  const promo = promoForProduct(product);
  const wholesaleDiscount = promo ? (p: number) => applyPromoToPrice(p, promo, 'wholesale') : undefined;

  // Badges (estilo/posición/íconos + candidatos por prioridad) desde config.badges.
  // La promo por cantidad ("LLEVANDO 2 = 10% OFF") solo se muestra en la ficha de
  // producto, no en las cards del listado → includeQuantityPromo: false.
  const { outOfStock, badges: visibleBadges, style: badgeStyle, position: badgePosition, showIcons } = useProductBadges(product, { includeQuantityPromo: false });

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

        {/* Badges — hasta 2 apilados en la esquina configurada. "Sin stock" excluyente. */}
        <div className={`pointer-events-none absolute flex gap-1 ${BADGE_POSITION_CLASSES[badgePosition]}`}>
          {outOfStock ? (
            <CardBadge bg="#525252" variant={badgeStyle}>Sin stock</CardBadge>
          ) : (
            visibleBadges.map((b) => (
              <CardBadge key={b.key} bg={b.bg} color={b.color} variant={badgeStyle}>
                {showIcons && b.icon}
                {b.label}
              </CardBadge>
            ))
          )}
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
