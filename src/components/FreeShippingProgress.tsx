import { Truck } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import { evalFreeShipping } from '@/lib/shipping';
import { formatPrice } from '@/lib/utils';

/**
 * Barra de progreso hacia el envío gratis ("te faltan $X"). La comparten el
 * carrito y el drawer para que la promesa sea EXACTAMENTE la misma en los dos
 * lados: el umbral y el subtotal salen del mismo helper que después usa el
 * checkout para poner el envío en cero.
 *
 * `subtotal` es el de mercadería que la tienda ya muestra como "Subtotal"
 * (contado cuando hay precio de contado, que es el más chico: así nunca
 * prometemos un envío gratis que el checkout después cobra).
 *
 * Si el comercio no configuró umbral no se renderiza nada.
 */
export function FreeShippingProgress({ subtotal, className = '' }: { subtotal: number; className?: string }) {
  const config = useStore();
  const promo = evalFreeShipping(config.freeShippingFrom, subtotal);
  if (!promo.active) return null;

  const pct = Math.min(100, Math.max(0, Math.round((subtotal / promo.threshold) * 100)));

  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 text-[calc(12px_*_var(--font-scale,1))] text-muted">
        <Truck className={`h-3.5 w-3.5 shrink-0 ${promo.reached ? 'text-[#27ae60]' : 'text-subtle'}`} />
        {promo.reached ? (
          <span className="font-semibold text-[#1e8449]">Tenés envío gratis</span>
        ) : (
          <span>
            Te faltan <span className="font-semibold text-text">{formatPrice(promo.missing)}</span> para el envío gratis
          </span>
        )}
      </p>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-[#27ae60] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
