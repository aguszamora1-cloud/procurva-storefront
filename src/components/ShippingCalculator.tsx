import { useState } from 'react';
import { useStore } from '@/context/StoreProvider';
import { Spinner } from '@/components/Spinner';
import { formatPrice, whatsappLink } from '@/lib/utils';
import { etaBadgeColors, fetchShippingOptions, methodCoversPostalCode, normalizePostalCode, type ShippingOption } from '@/lib/shipping';

type Status = 'idle' | 'loading' | 'done' | 'empty' | 'error';

/**
 * Calculadora de envío del detalle de producto: el cliente ingresa su CP y ve
 * las opciones configuradas por el negocio (misma fuente que el checkout).
 */
export function ShippingCalculator() {
  const config = useStore();
  const [cp, setCp] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [options, setOptions] = useState<ShippingOption[]>([]);

  const waHref = config.whatsapp
    ? whatsappLink(
        config.whatsapp,
        `¡Hola ${config.name}! Quería consultar el costo de envío${cp ? ` a mi código postal ${cp}` : ''}.`,
      )
    : '';

  const calcular = async () => {
    if (status === 'loading' || cp.length === 0) return;
    setStatus('loading');
    try {
      const all = await fetchShippingOptions(config.companyId);
      // Filtramos por CP: el retiro en local y los métodos sin restricción siempre
      // aparecen; los envíos sólo si cubren la zona del cliente. Si nada cubre la
      // zona se cae al estado vacío (con CTA a WhatsApp).
      const cpNum = normalizePostalCode(cp);
      const matched = all.filter((o) => methodCoversPostalCode(o, cpNum));
      if (matched.length === 0) {
        setOptions([]);
        setStatus('empty');
        return;
      }
      setOptions(matched);
      setStatus('done');
    } catch (e) {
      console.error('[ShippingCalculator] error calculando envío:', e);
      setStatus('error');
    }
  };

  return (
    <div className="border-t border-line pt-6">
      <p className="mb-2 text-[12px] font-bold uppercase tracking-[1px] text-subtle">Calculá tu envío</p>

      <div className="flex gap-2">
        <input
          value={cp}
          onChange={(e) => setCp(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={(e) => { if (e.key === 'Enter') calcular(); }}
          inputMode="numeric"
          maxLength={4}
          placeholder="Tu código postal"
          className="w-full rounded-[8px] border border-line bg-background px-3.5 py-2.5 text-[16px] text-text outline-none transition-colors focus:border-accent"
        />
        <button
          type="button"
          onClick={calcular}
          disabled={status === 'loading' || cp.length === 0}
          className="flex shrink-0 items-center justify-center rounded-[8px] bg-[#111] px-5 text-[13px] font-bold uppercase tracking-wide text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'loading' ? <Spinner size={14} /> : 'Calcular'}
        </button>
      </div>

      <a
        href="https://www.correoargentino.com.ar/formularios/cpa"
        target="_blank"
        rel="noreferrer"
        className="mt-1.5 inline-block text-[12px] text-subtle underline hover:text-accent"
      >
        No sé mi código postal
      </a>

      {status === 'loading' && (
        <div className="mt-4 flex items-center gap-2 text-[13px] text-muted">
          <Spinner size={14} /> Calculando…
        </div>
      )}

      {status === 'done' && (
        <div className="mt-4 space-y-2">
          {options.map((o) => {
            const badge = o.eta ? etaBadgeColors(o.eta) : null;
            return (
              <div
                key={o.id}
                className="rounded-[8px] border border-[#eee] transition-colors hover:border-[#111]"
                style={{ padding: '14px 16px' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-text">
                      <span className="mr-1.5">{o.icon}</span>{o.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted">{o.description}</p>
                    {o.eta && badge && (
                      <span
                        className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {o.eta}
                      </span>
                    )}
                  </div>
                  <span
                    className="shrink-0 text-[14px] font-bold text-text"
                    style={o.cost === 0 ? { color: '#2e7d32' } : undefined}
                  >
                    {o.cost === 0 ? 'GRATIS' : o.cost == null ? 'A coordinar' : formatPrice(o.cost)}
                  </span>
                </div>
              </div>
            );
          })}
          {options.some((o) => o.cost == null) && (
            <p className="pt-1 text-[12px] text-muted">
              {waHref ? (
                <a href={waHref} target="_blank" rel="noreferrer" className="font-semibold text-accent underline">Consultá el costo exacto a tu zona por WhatsApp</a>
              ) : (
                'Consultá el costo exacto a tu zona por WhatsApp.'
              )}
            </p>
          )}
        </div>
      )}

      {status === 'empty' && (
        <p className="mt-4 text-[13px] text-muted">
          No hay envíos disponibles para tu zona.{' '}
          {waHref ? (
            <a href={waHref} target="_blank" rel="noreferrer" className="font-semibold text-accent underline">Contactanos por WhatsApp.</a>
          ) : (
            'Contactanos por WhatsApp.'
          )}
        </p>
      )}

      {status === 'error' && (
        <p className="mt-4 text-[13px] text-red-600">No pudimos calcular el envío. Intentá de nuevo.</p>
      )}
    </div>
  );
}
