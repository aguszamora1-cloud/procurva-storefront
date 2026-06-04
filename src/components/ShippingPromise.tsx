import { useStore } from '@/context/StoreProvider';
import { TrustBadges } from './TrustBadges';

/** Franja de confianza/promesa de envío. Configurable desde catalog_settings. */
export function ShippingPromise() {
  const config = useStore();
  if (!config.shippingPromiseEnabled) return null;
  return (
    <div className="mx-auto max-w-[1400px] px-6">
      <TrustBadges />
    </div>
  );
}
