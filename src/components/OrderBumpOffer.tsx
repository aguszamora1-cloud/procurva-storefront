import { useEffect, useMemo, useState } from 'react';
import { useProduct } from '@/hooks/useProduct';
import { colorsOf, findVariant, retailUnitLine, sizesOf, variantsOf } from '@/lib/complementarios';
import { formatPrice, getPriceInfo } from '@/lib/utils';
import type { CartItem, Product, Variant } from '@/lib/types';

/**
 * "Oferta antes de pagar" (order bump): UN producto que el comercio eligió, con
 * un tilde y a un precio especial que sólo existe en el checkout.
 *
 * La línea NO entra al carrito guardado: el checkout la suma a los ítems del
 * pedido mientras el tilde esté puesto (`onChange`). Así no queda dando vueltas
 * en el carrito a precio especial si el cliente vuelve atrás.
 *
 * Se oculta sola si el producto no carga, no tiene stock o ya está en el carrito
 * (ahí la oferta sería ofrecerle algo que ya lleva).
 *
 * `quantity` > 1 = pack fijo (típico de la mayorista: 12 pares de medias). El
 * precio es POR UNIDAD y la variante tiene que tener stock para el pack entero.
 */
interface Props {
  productId: string;
  price: number;
  quantity: number;
  isWholesale: boolean;
  cartProductIds: string[];
  onChange: (line: CartItem | null) => void;
}

const inStock = (p: Product, v: Variant, qty: number): boolean => p.track_stock === false || (v.stock ?? 0) >= qty;

export function OrderBumpOffer({ productId, price, quantity, isWholesale, cartProductIds, onChange }: Props) {
  const { product } = useProduct(productId);
  const [checked, setChecked] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);

  const available = useMemo(
    () => (product ? variantsOf(product).filter((v) => inStock(product, v, quantity)) : []),
    [product, quantity],
  );
  const hidden = !product || available.length === 0 || cartProductIds.includes(productId);

  const colors = product ? colorsOf(product).filter((c) => available.some((v) => v.color === c)) : [];
  const sizes = product
    ? sizesOf(product, color).filter((s) => available.some((v) => v.size === s && (!color || v.color === color)))
    : [];
  // Con una sola opción no hay nada que elegir: se toma esa.
  const effColor = colors.length === 1 ? colors[0] : color;
  const effSize = sizes.length === 1 ? sizes[0] : size;
  const variant = product ? findVariant(product, effColor, effSize) : null;
  const variantOk = !!product && !!variant && inStock(product, variant, quantity);

  // Precio de lista por unidad del canal: en la mayorista, el mayorista.
  const listPrice = !product
    ? 0
    : isWholesale
      ? Number(product.wholesale_price) || 0
      : getPriceInfo(product, variant?.size ?? null).mainPrice;

  useEffect(() => {
    if (hidden || !checked || !product || !variant || !variantOk) {
      onChange(null);
      return;
    }
    const base = retailUnitLine(product, variant, product.image_url ?? null);
    onChange({
      ...base,
      unit_price: price,
      unit_price_cash: price,
      // Nunca por debajo del especial: el desglose resta lista − final.
      unit_price_original: Math.max(listPrice, price),
      qty: quantity,
      source: 'suelto',
      order_bump: true,
    });
    // onChange es el setter del checkout (estable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, checked, product, variant, variantOk, price, quantity, listPrice]);

  if (hidden || !product) return null;

  const needsChoice = !variantOk;
  const selectCls =
    'rounded-md border border-line bg-background px-2.5 py-1.5 text-[calc(13px_*_var(--font-scale,1))] text-text';

  return (
    <div className="mt-9">
      <div className="rounded-lg border border-dashed border-primary p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-4 w-4 flex-none accent-[var(--color-accent)]"
          />
          {product.image_url && (
            <img src={product.image_url} alt="" className="h-14 w-14 flex-none rounded-md object-cover" loading="lazy" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[calc(12px_*_var(--font-scale,1))] font-semibold uppercase tracking-wide text-muted">
              Sumalo a tu pedido
            </span>
            <span className="mt-0.5 block text-[calc(14px_*_var(--font-scale,1))] font-medium text-text">
              {quantity > 1 ? `${quantity} u. · ${product.name}` : product.name}
            </span>
            <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              {listPrice > price && (
                <span className="text-[calc(13px_*_var(--font-scale,1))] text-subtle line-through">{formatPrice(listPrice)}</span>
              )}
              <span className="text-[calc(14px_*_var(--font-scale,1))] font-semibold text-text">{formatPrice(price)}</span>
              <span className="text-[calc(12px_*_var(--font-scale,1))] text-muted">
                {quantity > 1 ? `c/u · ${formatPrice(price * quantity)} el pack, sólo en esta compra` : 'sólo en esta compra'}
              </span>
            </span>
          </span>
        </label>

        {checked && (colors.length > 1 || sizes.length > 1) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
            {colors.length > 1 && (
              <select
                value={color ?? ''}
                onChange={(e) => { setColor(e.target.value || null); setSize(null); }}
                className={selectCls}
                aria-label="Color"
              >
                <option value="">Elegí el color</option>
                {colors.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {sizes.length > 1 && (
              <select
                value={size ?? ''}
                onChange={(e) => setSize(e.target.value || null)}
                className={selectCls}
                aria-label="Talle"
              >
                <option value="">Elegí el talle</option>
                {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {needsChoice && (
              <span className="text-[calc(12px_*_var(--font-scale,1))] text-muted">Elegí para sumarlo al pedido.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
