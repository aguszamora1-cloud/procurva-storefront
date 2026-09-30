import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * ¿TODOS estos productos tienen "Envío gratis" (products.free_shipping)?
 *
 * Se consulta en vivo y no se guarda en el carrito: si el comercio prende o
 * apaga el switch en la ficha, el carrito que ya estaba armado se entera.
 *
 * La regla es "todos o nada": con un solo producto sin envío gratis, el envío
 * se cobra entero (no hay forma honesta de prorratear una tarifa de Correo).
 *
 * Devuelve false mientras carga, sin productos o si la columna todavía no
 * existe: ante la duda se cobra el envío configurado, como antes.
 */
export function useFreeShippingProducts(companyId: string | undefined, productIds: string[]): boolean {
  // Clave estable: el array cambia de identidad en cada render del carrito.
  const key = useMemo(() => Array.from(new Set(productIds.filter(Boolean))).sort().join(','), [productIds]);
  const [result, setResult] = useState<{ key: string; allFree: boolean } | null>(null);

  useEffect(() => {
    if (!companyId || !key) return;
    let cancelled = false;
    const ids = key.split(',');
    (async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, free_shipping')
        .eq('company_id', companyId)
        .in('id', ids);
      if (cancelled) return;
      if (error) {
        console.warn('[useFreeShippingProducts] no se pudo leer free_shipping:', error.message);
        setResult({ key, allFree: false });
        return;
      }
      const rows = (data ?? []) as { id: string; free_shipping: boolean | null }[];
      // Un producto que no volvió (oculto/borrado) cuenta como "sin envío gratis".
      const allFree = ids.every((id) => rows.some((r) => r.id === id && r.free_shipping === true));
      setResult({ key, allFree });
    })();
    return () => { cancelled = true; };
  }, [companyId, key]);

  return !!key && result?.key === key && result.allFree;
}
