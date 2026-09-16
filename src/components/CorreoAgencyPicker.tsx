import { Clock, MapPin } from 'lucide-react';
import { Spinner } from '@/components/Spinner';
import { agencyAddressLine, agencyHoursText, type CorreoAgency } from '@/lib/micorreo';
import type { CorreoAgenciesStatus } from '@/hooks/useCorreoAgencies';

/**
 * Selector de sucursal de Correo Argentino para el retiro en sucursal cotizado
 * en vivo. Presentacional: la lista la trae `useCorreoAgencies` y la elección
 * vive en el checkout (que la valida y la persiste en el pedido).
 */
export function CorreoAgencyPicker({
  status,
  agencies,
  errorCode,
  value,
  onChange,
  labelCls,
  inputCls,
}: {
  status: CorreoAgenciesStatus;
  agencies: CorreoAgency[];
  errorCode: string | null;
  value: CorreoAgency | null;
  onChange: (agency: CorreoAgency | null) => void;
  labelCls: string;
  inputCls: string;
}) {
  const hours = value ? agencyHoursText(value.hours) : '';
  const address = value ? agencyAddressLine(value) : '';

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <span className={labelCls}>Sucursal de Correo Argentino donde retirás *</span>

      {status === 'idle' && (
        <p className="text-[calc(13px_*_var(--font-scale,1))] text-muted">
          Completá la provincia para ver las sucursales cercanas.
        </p>
      )}

      {status === 'loading' && (
        <p className="flex items-center gap-2 text-[calc(13px_*_var(--font-scale,1))] text-muted">
          <Spinner size={14} /> Buscando sucursales…
        </p>
      )}

      {status === 'error' && (
        <p className="text-[calc(13px_*_var(--font-scale,1))] text-muted">
          {errorCode === 'invalid_province' || errorCode === 'invalid_postal_code'
            ? 'No encontramos sucursales con esa provincia o código postal. Revisá cómo los escribiste.'
            : 'No pudimos cargar las sucursales en este momento. Podés confirmar igual y coordinamos la sucursal con vos.'}
        </p>
      )}

      {status === 'done' && agencies.length === 0 && (
        <p className="text-[calc(13px_*_var(--font-scale,1))] text-muted">
          No hay sucursales habilitadas para esa provincia. Revisá la provincia o elegí envío a domicilio.
        </p>
      )}

      {status === 'done' && agencies.length > 0 && (
        <>
          <select
            className={inputCls}
            value={value?.code ?? ''}
            onChange={(e) => onChange(agencies.find((a) => a.code === e.target.value) ?? null)}
          >
            <option value="">Elegí una sucursal</option>
            {agencies.map((a) => {
              const line = agencyAddressLine(a);
              return (
                <option key={a.code} value={a.code}>
                  {line ? `${a.name} — ${line}` : a.name}
                </option>
              );
            })}
          </select>
          {value && (address || hours) && (
            <div className="mt-1 space-y-1 text-[calc(12px_*_var(--font-scale,1))] text-muted">
              {address && (
                <p className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" />
                  <span className="min-w-0">{address}</span>
                </p>
              )}
              {hours && (
                <p className="flex items-start gap-1.5">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" />
                  <span className="min-w-0">{hours}</span>
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
