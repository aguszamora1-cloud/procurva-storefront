import { formatPrice } from '@/lib/utils';
import { combinedPriceRows, curvaSurtidaRows } from '@/lib/packs';
import type { CurvePriceTier, ProductPack } from '@/lib/types';

/**
 * Tabla de precios escalonados mayoristas: "Por talle" (wholesale_price) + una fila
 * por tier de curva + una fila por cada escalón de los packs habilitados (media
 * docena / docena / bulto). El mejor precio (menor $/u de todos) se resalta como una
 * fila entera con fondo gris suave, label + subtítulo "MEJOR PRECIO" a la izquierda y
 * el monto (un punto más grande) a la derecha — robusto a cualquier tipografía.
 * Todos los montos usan cifras tabulares (tabular-nums) para alinearse parejos.
 */
export function WholesalePriceTable({
  wholesalePrice,
  tiers,
  packs = [],
  curvaSurtidaTiers,
  variant = 'card',
  discount,
}: {
  wholesalePrice: number;
  tiers: CurvePriceTier[];
  packs?: ProductPack[];
  /** Tiers de curva surtida (modalidad independiente): líneas sueltas sin best. */
  curvaSurtidaTiers?: CurvePriceTier[];
  variant?: 'card' | 'detail';
  /** Si hay promo mayorista vigente: descuenta cada precio por unidad. */
  discount?: (price: number) => number;
}) {
  const rows = combinedPriceRows(wholesalePrice, tiers, packs);
  const surtidaRows = curvaSurtidaTiers?.length ? curvaSurtidaRows(curvaSurtidaTiers) : [];
  if (wholesalePrice <= 0 && rows.length <= 1 && surtidaRows.length === 0) {
    return <p className="text-[15px] font-semibold text-subtle">Consultar precio</p>;
  }

  const detail = variant === 'detail';

  return (
    <div className={detail ? 'flex flex-col gap-2' : 'flex flex-col gap-1'}>
      {rows.map((r, i) => {
        const promoPrice = discount ? discount(r.price) : r.price;
        const onPromo = discount != null && promoPrice < r.price;

        // Fila del mejor precio: bloque resaltado con fondo gris suave. El fondo
        // se extiende un poco hacia los lados (-mx) sin tocar el borde de la card.
        if (r.best) {
          return (
            <div
              key={`${r.label}-${i}`}
              className="-mx-1.5 flex items-center justify-between gap-2 rounded-md bg-secondary px-1.5 py-1.5"
            >
              <span className="flex flex-col leading-tight">
                <span className="text-[13px] font-semibold text-on-surface">{r.label}</span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.3px] text-subtle">Mejor precio</span>
              </span>
              <span className="flex items-baseline gap-1.5">
                {onPromo && <span className="text-[12px] font-medium text-subtle line-through tabular-nums">{formatPrice(r.price)}</span>}
                <span className="text-[15px] font-bold text-on-surface tabular-nums">{formatPrice(promoPrice)}</span>
              </span>
            </div>
          );
        }

        return (
          <div key={`${r.label}-${i}`} className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-medium text-muted">{r.label}</span>
            <span className="flex items-baseline gap-1.5">
              {onPromo && <span className="text-[12px] font-medium text-subtle line-through tabular-nums">{formatPrice(r.price)}</span>}
              <span className={onPromo ? 'text-[14px] font-semibold text-accent tabular-nums' : 'text-[14px] font-semibold text-text tabular-nums'}>
                {formatPrice(promoPrice)}
              </span>
            </span>
          </div>
        );
      })}

      {/* Curva surtida: modalidad independiente. Líneas sueltas, sin encabezado y
          sin participar del "MEJOR PRECIO" (mismo markup que la fila simple). */}
      {surtidaRows.map((r, i) => {
        const promoPrice = discount ? discount(r.price) : r.price;
        const onPromo = discount != null && promoPrice < r.price;
        return (
          <div key={`surtida-${r.label}-${i}`} className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-medium text-muted">{r.label}</span>
            <span className="flex items-baseline gap-1.5">
              {onPromo && <span className="text-[12px] font-medium text-subtle line-through tabular-nums">{formatPrice(r.price)}</span>}
              <span className={onPromo ? 'text-[14px] font-semibold text-accent tabular-nums' : 'text-[14px] font-semibold text-text tabular-nums'}>
                {formatPrice(promoPrice)}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
