import { formatPrice } from '@/lib/utils';
import { priceRows } from '@/lib/wholesale';
import type { CurvePriceTier } from '@/lib/types';

/**
 * Tabla de precios escalonados mayoristas: "Por talle" (wholesale_price) + una fila
 * por tier de curva. El mejor precio (tier más alto) se resalta en color acento.
 * variant 'card' = compacta para la grilla; 'detail' = más aireada.
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
  const labelCls = detail ? 'text-[13px]' : 'text-[11px] md:text-[12px]';
  const priceCls = detail ? 'text-[14px]' : 'text-[12px] md:text-[13px]';

  return (
    <div className={detail ? 'flex flex-col gap-2' : 'flex flex-col gap-0.5'}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-2">
          <span className={`${labelCls} ${r.best ? 'font-semibold text-accent' : 'text-muted'}`}>
            {r.label}
            {r.best && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide">🔥 mejor precio</span>}
          </span>
          <span className={`${priceCls} ${r.best ? 'font-extrabold text-accent' : 'font-semibold text-text'}`}>
            {formatPrice(r.price)}
          </span>
        </div>
      ))}
    </div>
  );
}
