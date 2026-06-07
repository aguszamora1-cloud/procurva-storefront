import { formatPrice } from '@/lib/utils';
import { priceRows } from '@/lib/wholesale';
import type { CurvePriceTier } from '@/lib/types';

/**
 * Tabla de precios escalonados mayoristas: "Por talle" (wholesale_price) + una fila
 * por tier de curva. El mejor precio (tier más alto) se resalta con un badge pill
 * en color acento. Usa la tipografía del sitio (hereda font-body).
 */
export function WholesalePriceTable({
  wholesalePrice,
  tiers,
  variant = 'card',
}: {
  wholesalePrice: number;
  tiers: CurvePriceTier[];
  variant?: 'card' | 'detail';
}) {
  const rows = priceRows(wholesalePrice, tiers);
  if (wholesalePrice <= 0 && rows.length <= 1) {
    return <p className="text-[15px] font-semibold text-subtle">Consultar precio</p>;
  }

  const detail = variant === 'detail';

  return (
    <div className={detail ? 'flex flex-col gap-2' : 'flex flex-col gap-1'}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <span className={`text-[13px] ${r.best ? 'font-bold text-accent' : 'font-medium text-muted'}`}>{r.label}</span>
            {r.best && (
              <span className="rounded-full bg-accent px-2 py-[3px] text-[9px] font-bold uppercase leading-none tracking-wide text-on-accent">
                Mejor precio
              </span>
            )}
          </span>
          <span className={`text-[14px] ${r.best ? 'font-extrabold text-accent' : 'font-semibold text-text'}`}>
            {formatPrice(r.price)}
          </span>
        </div>
      ))}
    </div>
  );
}
