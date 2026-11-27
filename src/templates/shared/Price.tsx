import { formatPrice } from '@/lib/utils';
import type { Product } from '@/lib/types';
import { useTplPrice } from './commerce';

/**
 * Precio con los datos reales (contado / tarjeta / tachado / cuotas). El marcado
 * es común y cada plantilla lo dibuja con su CSS (`<cls>__big`, `<cls>__small`…);
 * puede ocultar partes, nunca cambiar el número.
 */
export function PriceView({
  product,
  cls,
  color,
  size,
  showInstallments = false,
}: {
  product: Product;
  cls: string;
  color?: string | null;
  size?: string | null;
  showInstallments?: boolean;
}) {
  const p = useTplPrice(product, { color, size });
  // `cls` puede traer modificadores ("mo-price mo-price--pdp"): las partes usan
  // sólo la clase base, y los modificadores van en el contenedor.
  const root = cls;
  cls = cls.split(" ")[0];
  if (!p) return <p className={`${root} ${cls}--ask`}>Consultar precio</p>;
  return (
    <div className={root}>
      <p className={`${cls}__row`}>
        {p.from && <span className={`${cls}__from`}>Desde </span>}
        <span className={`${cls}__big`}>{formatPrice(p.big)}</span>
        {p.bigLabel && <span className={`${cls}__label`}> {p.bigLabel}</span>}
        {p.strike != null && (
          <>
            {' '}
            <s className={`${cls}__strike`}>
              <span className="tpl-sr">Antes </span>
              {formatPrice(p.strike)}
            </s>
          </>
        )}
        {p.offPct > 0 && <span className={`${cls}__off`}> −{p.offPct}%</span>}
      </p>
      {p.small != null && (
        <p className={`${cls}__small`}>
          {formatPrice(p.small)} {p.smallLabel}
        </p>
      )}
      {showInstallments && p.installments && <p className={`${cls}__inst`}>{p.installments}</p>}
    </div>
  );
}
