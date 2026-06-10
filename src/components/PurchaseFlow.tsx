import { CheckCircle2, Circle, MinusCircle } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import type { PurchaseFlowStep } from '@/lib/types';

const GREEN = '#22c55e';

function StepIcon({ state }: { state: PurchaseFlowStep['state'] }) {
  if (state === 'done') return <CheckCircle2 className="h-6 w-6 shrink-0" style={{ color: GREEN }} />;
  if (state === 'current') return <MinusCircle className="h-6 w-6 shrink-0 text-text" />;
  return <Circle className="h-6 w-6 shrink-0 text-subtle" />;
}

/**
 * "Así funciona tu compra": timeline vertical que explica el recorrido del
 * pedido (reaseguro en el detalle de producto). Los pasos y el on/off los
 * configura cada comercio desde el admin (Catálogo Online → Envío y Pagos).
 */
export function PurchaseFlow() {
  const { purchaseFlowEnabled, purchaseFlowSteps } = useStore();
  if (!purchaseFlowEnabled || purchaseFlowSteps.length === 0) return null;
  return (
    <div className="border-t border-line pt-6">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[2px] text-accent">Así funciona tu compra</p>
      <div>
        {purchaseFlowSteps.map((step, index) => {
          const last = index === purchaseFlowSteps.length - 1;
          return (
            <div key={index} className="flex">
              <div className="flex flex-col items-center">
                <StepIcon state={step.state} />
                {!last && (
                  <div
                    className={`w-[1.5px] grow ${step.state === 'done' ? '' : 'bg-line'}`}
                    style={step.state === 'done' ? { backgroundColor: GREEN } : undefined}
                  />
                )}
              </div>
              <div className={`ml-3 ${last ? '' : 'pb-6'}`}>
                <p className="text-[14px] font-semibold text-text">{step.name}</p>
                {step.detail && <p className="mt-0.5 text-[13px] text-muted">{step.detail}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
