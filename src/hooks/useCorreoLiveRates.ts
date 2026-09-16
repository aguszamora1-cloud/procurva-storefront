import { useEffect, useMemo, useState } from 'react';
import { applyCorreoRates, correoPostalCode, correoRatesKey, fetchCorreoRates, type CorreoItem, type CorreoRate } from '@/lib/micorreo';
import type { ShippingOption } from '@/lib/shipping';

export interface CorreoLiveRatesValue {
  /** Opciones con la tarifa real aplicada a las de `liveCarrier` (el resto, intactas). */
  options: ShippingOption[];
  /** true mientras se cotiza el CP/carrito actual. Sólo afecta a las opciones con `liveCarrier`. */
  loading: boolean;
}

/**
 * Cotiza en vivo con MiCorreo las opciones marcadas con `liveCarrier` para el CP
 * y el carrito dados, y devuelve las opciones con el costo real. Va DESPUÉS del
 * filtro por CP/canal y ANTES de calcular costo/promo, así el precio que se
 * muestra y el que se cobra salen del mismo número.
 *
 * - Sin opciones en vivo, sin CP completo o con carrito vacío: no llama a nada.
 * - Mientras cotiza (o espera el debounce) `loading` es true y las opciones
 *   quedan con el costo configurado; la UI debe mostrar "Cotizando…".
 * - Si la cotización falla: fallback silencioso al costo configurado.
 * - Sólo aplica un resultado si corresponde a la clave ACTUAL (CP + carrito): una
 *   respuesta vieja nunca pisa el precio de otro CP.
 */
export function useCorreoLiveRates(
  options: ShippingOption[],
  companyId: string,
  postalCode: string | null | undefined,
  items: CorreoItem[],
  debounceMs = 400,
): CorreoLiveRatesValue {
  const needsLive = options.some((o) => o.liveCarrier === 'correo-argentino');
  const key = needsLive ? correoRatesKey(companyId, postalCode ?? null, items) : null;
  const cp = correoPostalCode(postalCode ?? null);

  // Resultado de la última cotización terminada, atado a su clave.
  const [result, setResult] = useState<{ key: string; rates: CorreoRate[] | null } | null>(null);

  // El carrito llega como array nuevo en cada render: dependemos de la clave (string).
  const itemsRef = useMemo(() => items, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!key || !cp) return;
    if (result?.key === key) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchCorreoRates(companyId, cp, itemsRef)
        .then((res) => {
          if (!cancelled) setResult({ key, rates: res.rates });
        })
        .catch((err) => {
          console.warn('[micorreo] no se pudo cotizar; quedan los costos configurados', err);
          if (!cancelled) setResult({ key, rates: null });
        });
    }, debounceMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // result queda afuera: sólo lo leemos para no re-cotizar lo que ya tenemos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, cp, companyId, debounceMs]);

  const current = key && result?.key === key ? result : null;
  const quoted = useMemo(
    () => (current ? applyCorreoRates(options, current.rates) : options),
    [options, current],
  );

  return { options: quoted, loading: Boolean(key) && !current };
}
