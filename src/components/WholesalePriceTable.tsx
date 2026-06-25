import { formatPrice } from '@/lib/utils';
import { combinedPriceRows } from '@/lib/packs';
import type { CurvePriceTier, ProductPack } from '@/lib/types';

/**
 * Tabla de precios escalonados mayoristas: "Por talle" (wholesale_price) + una fila
 * por tier de curva + una fila por cada escalón de los packs habilitados (media
 * docena / docena / bulto). El mejor precio (menor $/u de todos) se resalta con un
 * badge pill en color acento. Usa la tipografía del sitio (hereda font-body).
 */
export function WholesalePriceTable({
  wholesalePrice,
  tiers,
  packs = [],
  variant = 'card',
  discount,
}: {
  wholesalePrice: number;
  tiers: CurvePriceTier[];
  packs?: ProductPack[];
  variant?: 'card' | 'detail';
  /** Si hay promo mayorista vigente: descuenta cada precio por unidad. */
  discount?: (price: number) => number;
}) {
  const rows = combinedPriceRows(wholesalePrice, tiers, packs);
  if (wholesalePrice <= 0 && rows.length <= 1) {
    return <p className="text-[15px] font-semibold text-subtle">Consultar precio</p>;
  }

  const detail = variant === 'detail';

  return (
    <div className={detail ? 'flex flex-col gap-2' : 'flex flex-col gap-1'}>
      {rows.map((r, i) => {
        const promoPrice = discount ? discount(r.price) : r.price;
        const onPromo = discount != null && promoPrice < r.price;
        return (
          <div key={`${r.label}-${i}`} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span className={`text-[14px] ${r.best ? 'font-bold text-accent' : 'font-medium text-muted'}`}>{r.label}</span>
              {r.best && (
                <span className="rounded bg-accent px-2 py-[3px] text-[9px] font-bold uppercase leading-none tracking-wide text-on-accent">
                  Mejor precio
                </span>
              )}
            </span>
            <span className="flex items-baseline gap-1.5">
              {onPromo && <span className="text-[12px] font-medium text-subtle line-through">{formatPrice(r.price)}</span>}
              <span
                className={
                  onPromo || r.best
                    ? 'text-[15px] font-extrabold text-accent'
                    : 'text-[14px] font-semibold text-text'
                }
              >
                {formatPrice(promoPrice)}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
