import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useStoreType } from '@/context/StoreProvider';
import { useWholesalePricing } from '@/context/WholesalePricingContext';
import { useProducts } from '@/hooks/useProducts';
import { useProductVariants } from '@/hooks/useProductVariants';
import { PriceStack } from './PriceStack';
import { formatPrice } from '@/lib/utils';
import { applyStockOverrides } from '@/lib/productStatus';
import {
  colorsOf,
  sizesOf,
  findVariant,
  sizeInStock,
  variantHasStock,
  retailUnitLine,
  wholesaleUnitLine,
  minUnitKind,
  packLinesFor,
  curvaLinesFor,
  complementInStock,
  curvaColorInStock,
  type WholesaleData,
} from '@/lib/complementarios';
import type { CartItem, Product, Reel } from '@/lib/types';

/**
 * Productos vinculados a un conjunto de videos, listos para comprar.
 *
 * Los datos salen de useProducts() (catálogo del tenant, ya filtrado por canal y
 * por catalog_visible) más useProductVariants() para las variantes COMPLETAS
 * (con id y price, que el grid recorta). Mismo camino que ComplementaryBlock: sin
 * query nueva por producto y sin problemas de RLS. Si el producto vinculado no
 * está en esa lista —oculto, sin precio en este canal, borrado— simplemente no
 * hay card, y el video se ve igual.
 *
 * Una sola llamada para TODOS los videos del visor: los hooks no se pueden
 * llamar por slide, y además así se pide una vez y no N.
 */
export function useReelProducts(reels: Reel[]): Record<string, Product> {
  const { products } = useProducts();

  // Producto comprable de cada video: el vínculo explícito y, si no hay, el
  // producto de la ficha (placement='product'). Así los videos de un producto
  // muestran su card sin que el comercio configure nada.
  const ids = useMemo(() => {
    const set = new Set<string>();
    for (const r of reels) {
      const id = r.linked_product_id ?? r.product_id;
      if (id) set.add(id);
    }
    return Array.from(set);
  }, [reels]);

  const { variantsByProduct } = useProductVariants(ids);

  return useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const out: Record<string, Product> = {};
    for (const id of ids) {
      const base = byId.get(id);
      if (!base) continue;
      const full = variantsByProduct[id];
      // applyStockOverrides al final: las variantes completas vienen de otra
      // query y pisarían el stock 0 que useProducts ya aplicó a los Agotado.
      out[id] = applyStockOverrides(full?.length ? { ...base, product_variants: full } : base);
    }
    return out;
  }, [ids, products, variantsByProduct]);
}

/** Producto comprable de un video (vínculo explícito → producto de la ficha). */
export const reelProductId = (reel: Reel): string | null => reel.linked_product_id ?? reel.product_id ?? null;

interface Props {
  product: Product;
  /** Se llama al navegar a la ficha, para que el visor se cierre. */
  onNavigate?: () => void;
  /**
   * Se llama después de agregar al carrito. El visor lo usa para cerrarse: el
   * drawer del carrito vive en z-50 y el visor en z-1000, así que si el visor
   * quedara abierto el carrito se abriría DETRÁS y el comprador no vería nada.
   * Cerrar es además el feedback más fuerte que hay: el drawer entra solo.
   */
  onAdded?: () => void;
}

/**
 * Card del producto vinculado a un video, con quick-add.
 *
 * Va SOBRE el video (fondo sólido, no un gradiente): tiene que leerse sea cual
 * sea el frame que quedó detrás. Los selectores de color/talle están SIEMPRE a
 * la vista, sin paso de "expandir" como en ComplementaryBlock: acá el usuario
 * está mirando un video y cada tap de más es una razón para cerrar.
 *
 * Respeta la unidad mínima de venta del canal (unidad / curva / pack), igual que
 * el resto de la tienda — en mayorista no se agrega una prenda suelta si el
 * producto se vende por curva.
 */
export function ReelProductCard({ product, onNavigate, onAdded }: Props) {
  const { addItem } = useCart();
  const storeType = useStoreType() ?? 'retail';
  const { curveTiers, curveDistributions, productPacks } = useWholesalePricing();

  const [added, setAdded] = useState(false);
  const [pickColor, setPickColor] = useState<string | null>(null);
  const [pickSize, setPickSize] = useState<string | null>(null);

  const wdata: WholesaleData = useMemo(
    () => ({
      tiers: curveTiers[product.id] ?? [],
      dist: curveDistributions[product.id] ?? [],
      packs: productPacks[product.id] ?? [],
    }),
    [curveTiers, curveDistributions, productPacks, product.id],
  );

  const colors = colorsOf(product);
  const kind = storeType === 'wholesale' ? minUnitKind(product, wdata) : 'unit';

  const effColor = colors.length === 1 ? colors[0] : pickColor;
  const sizes = sizesOf(product, effColor);
  const effSize = sizes.length === 1 ? sizes[0] : pickSize;

  const needsColor = colors.length > 1;
  // En curva/pack el talle no se elige: la distribución lo resuelve.
  const needsSize = (storeType !== 'wholesale' || kind === 'unit') && sizes.length > 1;
  const outOfStock = !complementInStock(product, storeType, wdata);

  const missingReason = needsColor && !effColor ? 'Elegí un color' : needsSize && !effSize ? 'Elegí un talle' : null;

  const img = product.image_url ?? null;

  const add = useCallback(() => {
    if (outOfStock || missingReason) return;
    let lines: CartItem[] = [];
    if (storeType === 'wholesale' && kind === 'pack') {
      lines = packLinesFor(product, wdata, img);
    } else if (storeType === 'wholesale' && kind === 'curva') {
      const color = effColor ?? colors[0];
      if (!color) return;
      lines = curvaLinesFor(product, color, wdata, img);
    } else {
      const v = findVariant(product, effColor, effSize);
      if (!variantHasStock(v)) return;
      lines = [storeType === 'wholesale' ? wholesaleUnitLine(product, v!, img) : retailUnitLine(product, v!, img)];
    }
    if (lines.length === 0) return;
    lines.forEach(addItem);
    setAdded(true);
    setPickSize(null);
    window.setTimeout(() => setAdded(false), 2000);
    onAdded?.();
  }, [outOfStock, missingReason, storeType, kind, product, wdata, img, effColor, effSize, colors, addItem, onAdded]);

  return (
    <div className="pointer-events-auto rounded-xl bg-background p-2.5 text-text shadow-lg">
      <div className="flex items-center gap-2.5">
        <Link to={`/producto/${product.id}`} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5">
          {img ? (
            <img src={img} alt="" className="h-11 w-11 flex-shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="h-11 w-11 flex-shrink-0 rounded-lg bg-secondary" />
          )}
          <div className="min-w-0">
            <p className="truncate text-[calc(13px_*_var(--font-scale,1))] font-medium">{product.name}</p>
            {storeType === 'wholesale' ? (
              product.wholesale_price ? (
                <p className="text-[calc(13px_*_var(--font-scale,1))] font-semibold">{formatPrice(product.wholesale_price)}</p>
              ) : null
            ) : (
              <PriceStack product={product} variant="compact" />
            )}
          </div>
        </Link>

        <button
          type="button"
          onClick={outOfStock || added ? undefined : add}
          disabled={outOfStock || !!missingReason}
          className={`flex flex-shrink-0 items-center gap-1 rounded-button px-3.5 py-2 text-[calc(13px_*_var(--font-scale,1))] font-semibold transition-colors disabled:opacity-50 ${
            added ? 'bg-green-600 text-white' : 'bg-primary text-on-primary'
          }`}
        >
          {added && <Check className="h-3.5 w-3.5" />}
          {outOfStock ? 'Sin stock' : added ? 'Agregado' : (missingReason ?? 'Agregar')}
        </button>
      </div>

      {/* Selectores a la vista, sin paso intermedio. Se ocultan si no hay nada
          que elegir (color único, o curva/pack donde el talle no se elige). */}
      {!outOfStock && (needsColor || needsSize) && (
        <div className="mt-2 space-y-1.5 border-t border-line-a60 pt-2">
          {needsColor && (
            <div className="flex flex-wrap gap-1.5">
              {colors.map((c) => {
                const colorOut = storeType === 'wholesale' && kind === 'curva' && !curvaColorInStock(product, c, wdata);
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={colorOut}
                    onClick={() => {
                      setPickColor(c);
                      setPickSize(null);
                    }}
                    className={`rounded-pill border px-2.5 py-1 text-[calc(12px_*_var(--font-scale,1))] ${
                      effColor === c ? 'border-primary bg-primary text-on-primary' : 'border-line text-muted'
                    } ${colorOut ? 'cursor-not-allowed opacity-40 line-through' : ''}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          )}
          {needsSize && effColor != null && (
            <div className="flex flex-wrap gap-1.5">
              {sizes.map((s) => {
                const inStock = sizeInStock(product, effColor, s);
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!inStock}
                    onClick={() => setPickSize(s)}
                    className={`min-w-[36px] rounded-md border px-2 py-1 text-[calc(12px_*_var(--font-scale,1))] ${
                      effSize === s ? 'border-primary bg-primary text-on-primary' : 'border-line text-muted'
                    } ${!inStock ? 'cursor-not-allowed opacity-40 line-through' : ''}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
