import { CreditCard, ShieldCheck, Truck } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';

/** Franja de promesa de envío + confianza. Configurable desde catalog_settings. */
export function ShippingPromise() {
  const config = useStore();
  if (!config.shippingPromiseEnabled) return null;

  const items = [
    { icon: Truck, title: config.shippingPromiseTitle, subtitle: config.shippingPromiseSubtitle },
    { icon: CreditCard, title: 'Pagá como quieras', subtitle: 'Transferencia, efectivo y más' },
    { icon: ShieldCheck, title: 'Compra protegida', subtitle: 'Atención personalizada' },
  ];

  return (
    <section className="border-y border-line bg-secondary">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-8 sm:grid-cols-3">
        {items.map(({ icon: Icon, title, subtitle }) => (
          <div key={title} className="flex items-center gap-3">
            <Icon size={26} className="shrink-0 text-accent" />
            <div>
              <p className="text-sm font-bold uppercase tracking-wide">{title}</p>
              {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
