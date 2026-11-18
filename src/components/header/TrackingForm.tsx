import { type FormEvent, useState } from 'react';
import type { StoreMenuItem } from '@/lib/types';

/**
 * Buscador de seguimiento del menú: el cliente pega el código y la tienda lo
 * manda al rastreo del correo.
 *
 * Se despliega INLINE dentro del drawer, no en un modal: el drawer es un
 * `fixed` con `translate-x`, y un `position: fixed` anidado adentro de un
 * transform toma como referencia al drawer (no al viewport), así que un overlay
 * ahí quedaría encerrado en la columna de 300px.
 *
 * Sobre la URL: la mayoría de los correos resuelven el rastreo con un
 * formulario y no aceptan el código en la dirección. Sólo sustituimos cuando la
 * URL declara `{codigo}`; si no, abrimos la página y le copiamos el código al
 * cliente para que lo pegue (es lo que iba a hacer a mano de todos modos).
 */
export function TrackingForm({
  item,
  className = 'mb-2 ml-1.5 space-y-2 border-l border-line-soft pb-1 pl-3',
}: {
  item: Extract<StoreMenuItem, { kind: 'tracking' }>;
  /** Contenedor del formulario. Default: el del menú lateral (sangría con filete). */
  className?: string;
}) {
  const [carrierIndex, setCarrierIndex] = useState(0);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Los correos imprimen el código con puntos y espacios; ninguno los acepta.
    const clean = code.replace(/[\s.]/g, '').trim();
    if (!clean) return;
    const carrier = item.carriers[carrierIndex] ?? item.carriers[0];
    const takesCode = carrier.url.includes('{codigo}');
    // El copiado va ANTES y sin await: `window.open` tiene que salir dentro del
    // gesto del usuario o el navegador lo bloquea como popup.
    if (!takesCode) {
      navigator.clipboard?.writeText(clean).then(
        () => setCopied(true),
        () => {},
      );
    }
    const target = takesCode
      ? carrier.url.replace('{codigo}', encodeURIComponent(clean))
      : carrier.url;
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  return (
    <form onSubmit={submit} className={className}>
      {item.help && <p className="text-[calc(13px_*_var(--font-scale,1))] text-muted">{item.help}</p>}
      {item.carriers.length > 1 && (
        <select
          value={carrierIndex}
          onChange={(e) => setCarrierIndex(Number(e.target.value))}
          aria-label="Correo"
          className="w-full rounded-md border border-line bg-background px-2.5 py-2 text-[calc(14px_*_var(--font-scale,1))] text-on-surface focus:border-accent focus:outline-none"
        >
          {item.carriers.map((c, i) => (
            <option key={`${c.name}-${i}`} value={i}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <input
        type="text"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setCopied(false);
        }}
        placeholder="Código de seguimiento"
        className="w-full rounded-md border border-line bg-background px-2.5 py-2 text-[calc(14px_*_var(--font-scale,1))] text-on-surface placeholder:text-on-surface-muted focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        className="w-full rounded-button bg-primary px-3 py-2 text-[calc(14px_*_var(--font-scale,1))] font-medium text-on-primary transition-colors hover:bg-accent hover:text-on-accent"
      >
        Ver mi envío
      </button>
      {copied && (
        <p className="text-[calc(12px_*_var(--font-scale,1))] text-muted">
          Copiamos el código: pegalo en el buscador del correo.
        </p>
      )}
    </form>
  );
}
