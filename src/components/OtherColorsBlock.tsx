import { useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWholesalePricing } from '@/context/WholesalePricingContext';
import { formatPrice } from '@/lib/utils';
import { itemsPerCurve } from '@/lib/wholesale';
import {
  colorsOf,
  curvaColorInStock,
  curvaLines,
  curvaUnitPrice,
  minUnitKind,
  type WholesaleData,
} from '@/lib/complementarios';
import type { Product } from '@/lib/types';

interface Props {
  /** Producto principal de la ficha. */
  product: Product;
  /** Color ya elegido en el principal (se excluye del bloque). */
  selectedColor: string | null;
  className?: string;
}

/**
 * "Sumá otros colores" (mayorista): ofrece los OTROS colores del mismo producto que
 * se venden por curva, cada uno como card con su curva y precio. Con "Los N" agrega
 * todas de una, tomando el precio del escalón por volumen (si existe). Se autooculta
 * si el producto no se vende por curva o no queda ningún color con curva completable.
 *
 * Va ANTES del bloque de complementarios en la columna derecha. Gateado por
 * `mostrar_otros_colores` (solo mayorista) desde el componente padre.
 */
export function OtherColorsBlock({ product, selectedColor, className }: Props) {
  const { addItem } = useCart();
  const { curveTiers, curveDistributions, productPacks } = useWholesalePricing();
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const w: WholesaleData = useMemo(
    () => ({
      tiers: curveTiers[product.id] ?? [],
      dist: curveDistributions[product.id] ?? [],
      packs: productPacks[product.id] ?? [],
    }),
    [curveTiers, curveDistributions, productPacks, product.id],
  );

  // Solo cuando la unidad mínima del producto es la curva (no pack / no suelto).
  const isCurva = minUnitKind(product, w) === 'curva';

  // Otros colores: todos menos el elegido, y solo los que pueden completar una curva.
  const colors = useMemo(() => {
    if (!isCurva) return [];
    return colorsOf(product)
      .filter((c) => c !== selectedColor)
      .filter((c) => curvaColorInStock(product, c, w));
  }, [isCurva, product, selectedColor, w]);

  const img = product.image_url ?? null;
  const imgOf = (color: string) =>
    (product.product_variants ?? []).find((v) => v.color === color && v.image_url)?.image_url ?? img;
  const unitsOf = (color: string) => itemsPerCurve(w.dist, product, color);

  // Precio por unidad a 1 curva (cards) y a N curvas (opción "Los N", con descuento).
  const unit1 = curvaUnitPrice(product, w, 1);
  const unitN = curvaUnitPrice(product, w, colors.length);
  const curveTotal1 = (color: string) => unitsOf(color) * unit1;
  const totalAll = colors.reduce((s, c) => s + unitsOf(c) * unitN, 0);
  const hasVolumeDiscount = colors.length > 1 && unitN < unit1;

  const flash = (key: string) => {
    setJustAdded(key);
    window.setTimeout(() => setJustAdded((k) => (k === key ? null : k)), 1800);
  };

  const addColor = (color: string) => {
    const lines = curvaLines(product, color, w, imgOf(color), 1);
    if (lines.length === 0) return;
    lines.forEach(addItem);
    flash(color);
  };

  const addAll = () => {
    let any = false;
    for (const color of colors) {
      const lines = curvaLines(product, color, w, imgOf(color), colors.length);
      if (lines.length === 0) continue;
      lines.forEach(addItem);
      any = true;
    }
    if (any) flash('__all__');
  };

  if (!isCurva || colors.length === 0) return null;

  return (
    <section className={`rounded-2xl border border-line p-4 ${className ?? ''}`}>
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text">Sumá otros colores</h3>
      <p className="mb-3 text-xs text-subtle">Mismo modelo, otros colores — por curva.</p>

      <div className="grid grid-cols-2 gap-2">
        {colors.map((color) => {
          const added = justAdded === color;
          const thumb = imgOf(color);
          return (
            <div key={color} className="flex flex-col gap-1.5 rounded-xl border border-line/70 p-2">
              {thumb ? (
                <img src={thumb} alt="" className="aspect-square w-full rounded-lg object-cover" />
              ) : (
                <div className="aspect-square w-full rounded-lg bg-secondary" />
              )}
              <p className="truncate text-xs font-medium text-text">{color}</p>
              <p className="text-[11px] text-subtle">
                Curva {unitsOf(color)} u. · <span className="font-semibold text-text">{formatPrice(curveTotal1(color))}</span>
              </p>
              <button
                type="button"
                onClick={added ? undefined : () => addColor(color)}
                aria-label={added ? 'Agregado' : `Agregar curva ${color}`}
                className={`mt-auto flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                  added ? 'bg-green-600 text-white' : 'bg-primary text-on-primary hover:opacity-90'
                }`}
              >
                {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {added ? 'Agregado' : 'curva'}
              </button>
            </div>
          );
        })}
      </div>

      {colors.length > 1 && (
        <button
          type="button"
          onClick={justAdded === '__all__' ? undefined : addAll}
          aria-label={`Sumar los ${colors.length} colores`}
          className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary py-2 text-xs font-semibold transition-colors ${
            justAdded === '__all__' ? 'bg-green-600 text-white' : 'text-primary hover:bg-primary hover:text-on-primary'
          }`}
        >
          {justAdded === '__all__' ? (
            <>
              <Check className="h-3.5 w-3.5" /> Agregado
            </>
          ) : (
            <>
              Sumá los {colors.length} colores · {formatPrice(totalAll)}
              {hasVolumeDiscount && <span className="opacity-80">(precio x{colors.length} curvas)</span>}
            </>
          )}
        </button>
      )}
    </section>
  );
}
