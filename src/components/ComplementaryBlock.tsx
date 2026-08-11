import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronUp } from 'lucide-react';
import { useStore, useStoreType } from '@/context/StoreProvider';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { useCart } from '@/context/CartContext';
import { useProducts } from '@/hooks/useProducts';
import { useWholesalePricing } from '@/context/WholesalePricingContext';
import { useComplementarios } from '@/hooks/useComplementarios';
import { useProductVariants } from '@/hooks/useProductVariants';
import { formatPrice } from '@/lib/utils';
import { PriceStack } from './PriceStack';
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
import type { Product } from '@/lib/types';

type Contexto = 'ficha' | 'modal' | 'carrito';

interface Props {
  contexto: Contexto;
  /** Producto de origen (ficha/modal). En 'carrito' se resuelve de los ítems. */
  product?: Product | null;
  /** Herencia de talle del principal (minorista, sólo en la ficha). */
  preferredSize?: string | null;
  className?: string;
}

/**
 * Bloque "Complementarios" (cross-selling) de la vitrina. Un solo componente para
 * los tres contextos (ficha | modal | carrito): cambia el ancho/padding y la fuente
 * de los productos origen. Resuelve los complementarios manuales, oculta sin stock,
 * excluye lo que ya está en el carrito y corta en `maximoVisible`. Quick-add sin
 * salir de la página (unidad / curva / pack según el modo de venta).
 *
 * NOTA: el outfit que contiene el producto y el bloque "sumá otros colores"
 * (mayorista) son parte del spec pero quedan para una fase siguiente; hoy el bloque
 * cubre los complementarios manuales.
 */
export function ComplementaryBlock({ contexto, product, preferredSize, className }: Props) {
  const config = useStore();
  const storeType = useStoreType() ?? 'retail';
  const { items: cartItems } = useCart();

  const cartProductIds = useMemo(
    () => Array.from(new Set(cartItems.map((i) => i.product_id))),
    [cartItems],
  );

  const sourceIds = useMemo(() => {
    if (contexto === 'carrito') return cartProductIds;
    return product ? [product.id] : [];
  }, [contexto, product?.id, cartProductIds]);

  const excludeIds = useMemo(() => {
    const base = new Set<string>(cartProductIds);
    if (product) base.add(product.id);
    return Array.from(base);
  }, [cartProductIds, product?.id]);

  const gated = config.isPro && config.sections.upsell;
  const { items: resolved, isLoading } = useComplementarios(gated ? sourceIds : [], {
    excludeProductIds: excludeIds,
  });

  const block = config.complementaryBlock;
  // Datos mayoristas (curva/pack) por producto, para decidir "sin stock" según la
  // unidad mínima de venta (unidad / curva / pack) — mismo criterio que el quick-add.
  const { curveTiers, curveDistributions, productPacks } = useWholesalePricing();
  const wOf = useCallback(
    (id: string): WholesaleData => ({
      tiers: curveTiers[id] ?? [],
      dist: curveDistributions[id] ?? [],
      packs: productPacks[id] ?? [],
    }),
    [curveTiers, curveDistributions, productPacks],
  );
  const shown = useMemo(() => {
    let list = resolved;
    if (block.ocultarSinStock) list = list.filter((c) => complementInStock(c, storeType, wOf(c.id)));
    return list.slice(0, block.maximoVisible);
  }, [resolved, block.ocultarSinStock, block.maximoVisible, storeType, wOf]);

  // Gate de pintado: en la FICHA el bloque forma parte de la columna derecha, así
  // que la página lo espera (si no, aparecía después y empujaba el contenido).
  // En el carrito NO retiene nada: el drawer vive en el Layout y sobrevive a los
  // cambios de ruta, así que estaría reteniendo pantallas que ni lo muestran.
  // La key lleva el contexto para que las dos instancias no se pisen.
  useFirstPaintGate(`complementarios-${contexto}`, contexto === 'ficha' && gated && isLoading);

  const shownIds = useMemo(() => Array.from(new Set(shown.map((c) => c.id))), [shown]);
  const { variantsByProduct } = useProductVariants(shownIds);
  const { products: gridProducts } = useProducts();
  const baseById = useMemo(() => {
    const m = new Map<string, Product>();
    gridProducts.forEach((p) => m.set(p.id, p));
    return m;
  }, [gridProducts]);

  if (!gated || isLoading || shown.length === 0) return null;

  return (
    <section className={`rounded-2xl border border-line p-4 ${className ?? ''}`}>
      {/* Título vaciado desde el editor → el bloque va sin encabezado. */}
      {block.titulo && <h3 className="mb-3 text-[15px] font-semibold text-text">{block.titulo}</h3>}
      <ul className="space-y-2">
        {shown.map((card) => (
          <ComplementRow
            key={card.card_key ?? card.id}
            card={card}
            base={baseById.get(card.id) ?? card}
            variants={variantsByProduct[card.id] ?? []}
            storeType={storeType}
            preferredSize={contexto === 'ficha' ? (preferredSize ?? null) : null}
          />
        ))}
      </ul>
    </section>
  );
}

interface RowProps {
  card: Product;
  base: Product;
  variants: Product['product_variants'];
  storeType: 'retail' | 'wholesale';
  preferredSize: string | null;
}

function ComplementRow({ card, base, variants, storeType, preferredSize }: RowProps) {
  const { addItem } = useCart();
  const { curveTiers, curveDistributions, productPacks } = useWholesalePricing();

  const [added, setAdded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const pinned = card.variant_color ?? null;
  const [pickColor, setPickColor] = useState<string | null>(pinned);
  const [pickSize, setPickSize] = useState<string | null>(null);

  // Producto "completo" para operar (precios/flags del base + variantes con id/price).
  const full: Product = useMemo(
    () => ({ ...base, product_variants: variants.length ? variants : (card.product_variants ?? []) }),
    [base, variants, card],
  );
  const img = card.image_url ?? full.image_url ?? null;

  const wdata: WholesaleData = useMemo(
    () => ({
      tiers: curveTiers[full.id] ?? [],
      dist: curveDistributions[full.id] ?? [],
      packs: productPacks[full.id] ?? [],
    }),
    [curveTiers, curveDistributions, productPacks, full.id],
  );

  const colors = pinned ? [pinned] : colorsOf(full);
  const kind = storeType === 'wholesale' ? minUnitKind(full, wdata) : 'unit';

  // Color efectivo (único, fijado o elegido).
  const effColor = colors.length === 1 ? colors[0] : pickColor;
  // Talle efectivo (retail/unit): herencia del principal → único → elegido.
  const sizesForColor = sizesOf(full, effColor);
  const inheritedSize =
    preferredSize && effColor != null && sizeInStock(full, effColor, preferredSize) ? preferredSize : null;
  const effSize = inheritedSize ?? (sizesForColor.length === 1 ? sizesForColor[0] : pickSize);

  const needsColor = colors.length > 1 && !pinned;
  const needsSize = (storeType !== 'wholesale' || kind === 'unit') && sizesForColor.length > 1 && !inheritedSize;
  // Sin stock según la unidad mínima de venta (unidad / curva / pack). Mismo criterio
  // de "agotado" que el resto de la tienda: botón deshabilitado, nunca panel vacío.
  const outOfStock = !complementInStock(full, storeType, wdata);
  // Motivo por el que el botón "Agregar" está deshabilitado (para mostrarlo en el
  // propio botón en vez de dejarlo gris sin explicación).
  const missingReason = needsColor && !effColor ? 'Elegí un color' : needsSize && !effSize ? 'Elegí un talle' : null;

  const flash = () => {
    setAdded(true);
    setExpanded(false);
    setPickSize(null);
    window.setTimeout(() => setAdded(false), 2000);
  };

  // Intenta agregar directo; devuelve false si necesita que el usuario elija algo.
  const tryAdd = (): boolean => {
    if (storeType === 'wholesale' && kind === 'pack') {
      const lines = packLinesFor(full, wdata, img);
      if (lines.length === 0) return false;
      lines.forEach(addItem);
      flash();
      return true;
    }
    if (storeType === 'wholesale' && kind === 'curva') {
      if (needsColor && !effColor) return false;
      const color = effColor ?? colors[0];
      if (!color) return false;
      const lines = curvaLinesFor(full, color, wdata, img);
      if (lines.length === 0) return false;
      lines.forEach(addItem);
      flash();
      return true;
    }
    // unidad (retail o mayorista suelto)
    if (needsColor && !effColor) return false;
    if (needsSize && !effSize) return false;
    const v = findVariant(full, effColor, effSize);
    if (!variantHasStock(v)) return false;
    addItem(storeType === 'wholesale' ? wholesaleUnitLine(full, v!, img) : retailUnitLine(full, v!, img));
    flash();
    return true;
  };

  const onPlus = () => {
    if (outOfStock) return;
    if (tryAdd()) return;
    // Solo expandir si hay algo real que elegir (color/talle). Si no —p. ej. curva o
    // pack que no se puede completar por stock— NO abrir un panel vacío.
    if (needsColor || needsSize) setExpanded(true);
  };

  return (
    <li className="rounded-xl border border-line/70 p-2">
      <div className="flex items-center gap-3">
        <Link to={`/producto/${full.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          {img ? (
            <img src={img} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-secondary" />
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-text">{card.name}</p>
            <PriceLines product={full} storeType={storeType} />
          </div>
        </Link>
        {/* Sin stock (según unidad mínima): botón deshabilitado, sin acción. */}
        {outOfStock ? (
          <button
            type="button"
            disabled
            aria-label="Sin stock"
            className="flex-shrink-0 cursor-not-allowed rounded-pill border border-line px-2.5 py-1 text-[11px] font-medium text-subtle opacity-70"
          >
            Sin stock
          </button>
        ) : expanded ? (
          /* Expandido: colapsar. El CTA de confirmación es "Agregar" del panel de abajo. */
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Colapsar"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-text transition-colors hover:opacity-90"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        ) : (
          /* Botón de texto "Agregar" (consistente con "Sumá otros colores"). Única
             variante → agrega directo; múltiples → expande el selector inline. */
          <button
            type="button"
            onClick={added ? undefined : onPlus}
            aria-label={added ? 'Agregado' : 'Agregar'}
            className={`flex flex-shrink-0 items-center gap-1 rounded-button px-3 py-1.5 text-xs font-semibold transition-colors ${
              added ? 'bg-green-600 text-white' : 'bg-primary text-on-primary hover:opacity-90'
            }`}
          >
            {added && <Check className="h-3.5 w-3.5" />}
            {added ? 'Agregado' : 'Agregar'}
          </button>
        )}
      </div>

      {/* Selector inline (color/talle) cuando hace falta elegir. No navega. */}
      {expanded && (needsColor || needsSize) && (
        <div className="mt-2 space-y-2 border-t border-line/60 pt-2">
          {needsColor && (
            <div className="flex flex-wrap gap-1.5">
              {colors.map((c) => {
                // En curva, un color sin stock para completar una curva se deshabilita
                // (mismo criterio de agotado). En unidad, el stock lo maneja el talle.
                const colorOut = storeType === 'wholesale' && kind === 'curva' && !curvaColorInStock(full, c, wdata);
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={colorOut}
                    onClick={
                      colorOut
                        ? undefined
                        : () => {
                            setPickColor(c);
                            setPickSize(null);
                          }
                    }
                    className={`rounded-pill border px-2 py-0.5 text-[11px] ${
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
              {sizesForColor.map((s) => {
                const inStock = sizeInStock(full, effColor, s);
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!inStock}
                    onClick={() => setPickSize(s)}
                    className={`rounded-md border px-2 py-0.5 text-[11px] ${
                      effSize === s ? 'border-primary bg-primary text-on-primary' : 'border-line text-muted'
                    } ${!inStock ? 'cursor-not-allowed opacity-40 line-through' : ''}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => tryAdd()}
            className="w-full rounded-button bg-primary py-1.5 text-xs font-semibold text-on-primary disabled:opacity-60"
            disabled={!!missingReason}
          >
            {missingReason ?? 'Agregar'}
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * Precio con la misma estructura (y jerarquía) que el resto de la tienda: contado
 * protagonista, tarjeta secundaria, vía PriceStack. En mayorista, el precio base
 * "por talle" (sin split tarjeta/contado).
 */
function PriceLines({ product, storeType }: { product: Product; storeType: 'retail' | 'wholesale' }) {
  if (storeType === 'wholesale') {
    return product.wholesale_price ? (
      <p className="text-xs font-semibold text-text">{formatPrice(product.wholesale_price)}</p>
    ) : null;
  }
  return <PriceStack product={product} variant="compact" />;
}
