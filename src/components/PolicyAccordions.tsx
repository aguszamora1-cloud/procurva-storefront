import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';

interface Props {
  className?: string;
}

/**
 * Acordeones de políticas (Envío / Cambios y devoluciones / Medios de pago) del
 * settings mayorista. Se extrajo de `WholesalePurchasePanel` para poder ubicarlo
 * DEBAJO de los bloques de complementarios/outfit en la ficha. Se autooculta si no
 * hay ninguna política cargada.
 */
export function PolicyAccordions({ className }: Props) {
  const config = useStore();
  const [openPolicy, setOpenPolicy] = useState<string | null>(null);

  const policies = [
    { key: 'envio', label: 'Envío', text: config.policyShipping },
    { key: 'cambios', label: 'Cambios y devoluciones', text: config.policyReturns },
    { key: 'pagos', label: 'Medios de pago', text: config.policyPayments },
  ].filter((p) => p.text);

  if (policies.length === 0) return null;

  return (
    <div className={`divide-y divide-line border-y border-line ${className ?? ''}`}>
      {policies.map((p) => {
        const open = openPolicy === p.key;
        return (
          <div key={p.key}>
            <button
              type="button"
              onClick={() => setOpenPolicy(open ? null : p.key)}
              className="flex w-full items-center justify-between py-3.5 text-left"
            >
              <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{p.label}</span>
              <ChevronDown size={16} className={`text-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <p className="whitespace-pre-line pb-4 text-[13px] font-medium leading-relaxed text-muted">{p.text}</p>}
          </div>
        );
      })}
    </div>
  );
}
