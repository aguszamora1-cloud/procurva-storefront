import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import type { Product } from '@/lib/types';
import { PriceDisplay } from './PriceDisplay';
import {
  badgeColor,
  colorToHex,
  getPriceInfo,
  mainImage,
  sortSizes,
  totalStock,
} from '@/lib/utils';

export function ProductCard({ product }: { product: Product }) {
  const image = mainImage(product);
  const { cardPrice, cashPrice, cashDiscountPct } = getPriceInfo(product);
  const displayPrice = cashPrice ?? cardPrice; // precio prominente (efectivo si hay descuento)
  const hasDiscount = Boolean(cashPrice && cashDiscountPct > 0);
  const { addItem } = useCart();
  const navigate = useNavigate();

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const variants = product.product_variants ?? [];
  const sizes = useMemo(
    () => sortSizes(Array.from(new Set(variants.filter((v) => v.size).map((v) => v.size as string)))),
    [variants],
  );
  const colors = useMemo(
    () => Array.from(new Set(variants.filter((v) => v.color).map((v) => v.color as string))),
    [variants],
  );

  const variant = useMemo(() => {
    if (variants.length === 0) return null;
    return (
      variants.find(
        (v) => (selectedSize ? v.size === selectedSize : true) && (selectedColor ? v.color === selectedColor : true),
      ) ?? null
    );
  }, [variants, selectedSize, selectedColor]);

  const isSizeDisabled = (size: string) => {
    const matches = variants.filter((v) => v.size === size && (!selectedColor || v.color === selectedColor));
    return matches.length === 0 || matches.every((v) => (v.stock ?? 0) <= 0);
  };

  const stock = totalStock(product);
  const lowStock = stock > 0 && stock <= 5;
  const showBadge = product.catalog_badge_visible && product.catalog_badge_text;

  const needsSize = sizes.length > 0 && !selectedSize;
  const needsColor = colors.length > 0 && !selectedColor;
  const canAddDirect = !needsSize && !needsColor && variant && (variant.stock ?? 0) > 0 && cardPrice > 0;
  const outOfStock = !needsSize && !needsColor && variant && (variant.stock ?? 0) <= 0;
  const ctaLabel = outOfStock ? 'SIN STOCK' : 'AGREGAR AL CARRITO';

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleCTA = (e: React.MouseEvent) => {
    stop(e);
    if (canAddDirect && variant) {
      addItem({
        product_id: product.id,
        variant_id: variant.id,
        name: product.name,
        size: variant.size,
        color: variant.color,
        unit_price: displayPrice,
        qty: 1,
        image_url: image ?? null,
      });
      return;
    }
    navigate(`/producto/${product.id}`);
  };

  return (
    <article className="group flex flex-col overflow-hidden border border-line-soft bg-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover">
      {/* Imagen */}
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        <Link to={`/producto/${product.id}`} className="block h-full w-full">
          {image ? (
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-[1px] text-subtle">
              Sin imagen
            </div>
          )}
        </Link>

        {/* Badges */}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1 md:left-3 md:top-3 md:gap-1.5">
          {hasDiscount && (
            <span className="bg-primary px-2 py-[3px] text-[11px] font-bold uppercase leading-none text-on-primary md:px-3 md:py-1 md:text-[12px]">
              -{cashDiscountPct}%
            </span>
          )}
          {showBadge && (
            <span
              className="px-2 py-[3px] text-[11px] font-bold uppercase leading-none text-white md:px-3 md:py-1 md:text-[12px]"
              style={{ backgroundColor: badgeColor(product.catalog_badge_color) }}
            >
              {product.catalog_badge_text}
            </span>
          )}
          {lowStock && (
            <span className="bg-accent px-2 py-[3px] text-[11px] font-bold uppercase leading-none text-on-accent md:px-3 md:py-1 md:text-[12px]">
              Últimas unidades
            </span>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col p-2.5 md:p-4">
        <Link to={`/producto/${product.id}`} className="block">
          <h3 className="mb-1.5 text-[14px] font-semibold leading-[1.3] text-text transition-colors group-hover:text-accent md:text-[15px]">
            {product.name}
          </h3>
          <PriceDisplay product={product} variant="card" />
        </Link>

        {/* Quick-add — sólo desktop (igual que RSW) */}
        <div className="mt-3 hidden md:flex md:flex-col">
          {colors.length > 0 && (
            <div className="mb-2.5">
              <p className="mb-1.5 text-[12px] font-medium text-subtle">Colores</p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => {
                  const active = selectedColor === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      aria-label={`Color ${c}`}
                      onClick={(e) => {
                        stop(e);
                        setSelectedColor((prev) => (prev === c ? null : c));
                      }}
                      className={`shape-circle h-6 w-6 border transition-all ${
                        active ? 'border-text ring-2 ring-text ring-offset-2' : 'border-line hover:border-subtle'
                      }`}
                      style={{ backgroundColor: colorToHex(c) }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {sizes.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-[12px] font-medium text-subtle">Talles</p>
              <div className="flex flex-wrap gap-1.5">
                {sizes.map((s) => {
                  const disabled = isSizeDisabled(s);
                  const active = selectedSize === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={disabled}
                      onClick={(e) => {
                        stop(e);
                        if (!disabled) setSelectedSize((prev) => (prev === s ? null : s));
                      }}
                      className={`h-9 min-w-[40px] border px-2 text-[13px] font-medium transition-colors ${
                        active
                          ? 'border-text bg-primary text-on-primary'
                          : disabled
                            ? 'cursor-not-allowed border-line bg-secondary text-subtle line-through'
                            : 'border-line bg-background text-text hover:border-text'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-auto pt-1">
            <button
              type="button"
              onClick={handleCTA}
              disabled={Boolean(outOfStock)}
              className="inline-flex w-full items-center justify-center gap-2 bg-primary py-[14px] text-[14px] font-bold uppercase tracking-[0.5px] text-on-primary transition-colors duration-200 hover:bg-accent hover:text-on-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary disabled:hover:text-on-primary"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              {ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
