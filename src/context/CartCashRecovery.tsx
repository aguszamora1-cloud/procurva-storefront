import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useCart } from '@/context/CartContext';
import { usePromotions } from '@/context/PromotionsContext';
import { useStoreStatus } from '@/context/StoreProvider';
import { supabase } from '@/lib/supabase';
import { cashRecoverySignature, needsCashOriginal } from '@/lib/cartCashLine';
import { isHiddenFromStore } from '@/lib/productStatus';
import { matchesProductFilter } from '@/lib/productFilter';
import type { RecoveryProduct } from '@/lib/cartCashRecovery';

/**
 * Recupera el contado de lista de las líneas guardadas antes de P1.2-FIN0-A
 * (ver lib/cartCashRecovery.ts). Sólo lecturas: los productos de esas líneas,
 * de ESTA tienda, recién leídos (sin caché). Cada línea se intenta UNA vez por
 * sesión; recuperada o no, deja de estar pendiente. Lo que no se puede verificar
 * queda con el resguardo de FIN0-A (no acumula).
 *
 * `pending` = hay alguna línea todavía sin verificar: el checkout no deja
 * confirmar mientras tanto, porque el total de contado todavía puede bajar.
 */
const COLUMNS = `id, company_id, status, catalog_visible, categories, brand, segment,
  retail_price, retail_price_transfer, retail_price_card, compare_at_price, size_price_adjustments,
  product_variants ( id, size, color )`;
/** Tope de espera de la lectura y de la verificación entera. */
const TIMEOUT_MS = 8000;

type Row = RecoveryProduct & { company_id: string; status?: string | null; catalog_visible?: boolean | null; brand?: string | null; segment?: string | null };

const CartCashRecoveryContext = createContext<{ pending: boolean }>({ pending: false });

export function CartCashRecoveryProvider({ children }: { children: ReactNode }) {
  const { items, fillCashOriginal } = useCart();
  const { companyId, storeType, productFilter } = useStoreStatus();
  const { promotions, ready, loading, failed } = usePromotions();
  // Huellas ya resueltas (recuperadas o no) y en curso, en esta sesión.
  const done = useRef(new Set<string>());
  const inFlight = useRef(new Set<string>());
  const [, setTick] = useState(0);

  // En mayorista no hay contado: nada que verificar.
  const applies = storeType !== 'wholesale';
  const candidates = useMemo(() => (applies ? items.filter(needsCashOriginal) : []), [items, applies]);
  const pendingKey = candidates
    .map(cashRecoverySignature)
    .filter((s) => !done.current.has(s))
    .sort()
    .join('\n');
  const pending = pendingKey !== '';

  const resolve = (sigs: string[]) => {
    for (const s of sigs) {
      inFlight.current.delete(s);
      done.current.add(s);
    }
    setTick((t) => t + 1);
  };

  useEffect(() => {
    if (storeType !== 'retail' || !companyId || !ready || loading) return;
    const todo = candidates.filter((c) => {
      const s = cashRecoverySignature(c);
      return !done.current.has(s) && !inFlight.current.has(s);
    });
    if (todo.length === 0) return;
    const sigs = todo.map(cashRecoverySignature);
    // Promos que no se pudieron leer: sin la lista completa no se verifica.
    if (failed) return resolve(sigs);
    sigs.forEach((s) => inFlight.current.add(s));
    // Foto de lo que se usa para verificar: si la tienda o las promos cambian
    // en el medio, se verifica contra este estado, completo y consistente.
    const snap = { companyId, promotions, productFilter };
    const ids = Array.from(new Set(todo.map((t) => t.product_id)));
    (async () => {
      try {
        const timeout = new Promise<null>((r) => setTimeout(() => r(null), TIMEOUT_MS));
        const res = await Promise.race([
          supabase.from('products').select(COLUMNS).eq('company_id', snap.companyId).in('id', ids),
          timeout,
        ]);
        const rows = res && !res.error && Array.isArray(res.data) ? (res.data as unknown as Row[]) : null;
        if (!rows) return;
        const { recoverCashOriginal } = await import('@/lib/cartCashRecovery');
        todo.forEach((line, i) => {
          const p = rows.find((r) => r.id === line.product_id && r.company_id === snap.companyId);
          const visible = !!p && !isHiddenFromStore({ status: p.status, catalog_visible: p.catalog_visible }) && matchesProductFilter(p, snap.productFilter);
          const value = visible ? recoverCashOriginal(line, p, snap.promotions) : null;
          // Si la red de seguridad ya la dio por no recuperable (el checkout pudo
          // habilitarse con ese total), no se completa a destiempo.
          // fillCashOriginal vuelve a chequear la huella contra el carrito ACTUAL.
          if (value != null && !done.current.has(sigs[i])) fillCashOriginal(sigs[i], value);
        });
      } catch (e) {
        console.warn('[CartCashRecovery] no se pudo verificar el contado de lista', e);
      } finally {
        resolve(sigs);
      }
    })();
  }, [candidates, storeType, companyId, ready, loading, failed, promotions, productFilter, fillCashOriginal]);

  // Red de seguridad: lo que siga pendiente (tienda o promos que nunca terminan
  // de cargar) se da por no recuperable, así el checkout no queda trabado.
  useEffect(() => {
    if (!pending) return;
    const sigs = pendingKey.split('\n');
    const t = setTimeout(() => resolve(sigs.filter((s) => !done.current.has(s))), TIMEOUT_MS * 2);
    return () => clearTimeout(t);
  }, [pending, pendingKey]);

  const value = useMemo(() => ({ pending }), [pending]);
  return <CartCashRecoveryContext.Provider value={value}>{children}</CartCashRecoveryContext.Provider>;
}

/** ¿Hay líneas del carrito cuyo contado de lista todavía se está verificando? */
export function useCartCashRecoveryPending(): boolean {
  return useContext(CartCashRecoveryContext).pending;
}
