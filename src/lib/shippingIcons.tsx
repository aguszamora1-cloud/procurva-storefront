import { Bike, Package, Store, Truck, type LucideIcon } from 'lucide-react';
import type { ShippingIconName } from '@/lib/shipping';

/** Ícono lucide-react de cada método de envío (compartido por el checkout y la calculadora). */
export const SHIPPING_ICONS: Record<ShippingIconName, LucideIcon> = {
  truck: Truck,
  store: Store,
  bike: Bike,
  package: Package,
};
