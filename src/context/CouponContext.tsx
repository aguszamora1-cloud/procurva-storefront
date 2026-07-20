import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore, useStoreType } from '@/context/StoreProvider';
import { fetchCoupon, couponBasicValidity, type CouponRecord } from '@/lib/coupons';

/**
 * Cupón guardado en el dispositivo. Hay UNO solo a la vez. `applied` distingue
 * entre "lo tengo guardado pero no lo apliqué" (chip disponible) y "lo apliqué"
 * (descuento activo en el resumen). El chip y el input del checkout son dos
 * vistas de este mismo estado.
 */
export interface SavedCoupon {
  code: string;
  applied: boolean;
}

interface CouponContextValue {
  /** Cupón guardado (código + si está aplicado), o null. */
  savedCoupon: SavedCoupon | null;
  /** Registro del cupón guardado, ya traído de la DB (o null si no hay/queda inválido). */
  couponRecord: CouponRecord | null;
  loading: boolean;
  /**
   * Valida (cart-independiente: existe + activo + vigencia + canal) y guarda el
   * cupón. `applied` por defecto false (queda "disponible"). Devuelve ok/error.
   */
  saveCoupon: (code: string, opts?: { applied?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  /** Marca el cupón guardado como aplicado / no aplicado (sin borrarlo). */
  setApplied: (applied: boolean) => void;
  /** Alterna aplicado ↔ no aplicado. */
  toggleCoupon: () => void;
  /** Borra el cupón guardado por completo. */
  removeCoupon: () => void;
}

const CouponContext = createContext<CouponContextValue | null>(null);

const storageKey = (companyId: string) => `procurva_saved_coupon:${companyId}`;

function loadSaved(companyId: string): SavedCoupon | null {
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.code === 'string' && p.code) return { code: p.code, applied: !!p.applied };
    return null;
  } catch {
    return null;
  }
}

function persistSaved(companyId: string, v: SavedCoupon | null): void {
  try {
    if (v) localStorage.setItem(storageKey(companyId), JSON.stringify(v));
    else localStorage.removeItem(storageKey(companyId));
  } catch {
    /* localStorage no disponible: el cupón vive solo en memoria esta sesión */
  }
}

export function CouponProvider({ children }: { children: ReactNode }) {
  const config = useStore();
  const storeType = useStoreType() ?? 'retail';
  const companyId = config.companyId;

  const [savedCoupon, setSavedCoupon] = useState<SavedCoupon | null>(() => loadSaved(companyId));
  const [couponRecord, setCouponRecord] = useState<CouponRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const magicHandled = useRef(false);

  // Persistimos cada cambio del cupón guardado (sobrevive reload y navegación).
  useEffect(() => {
    persistSaved(companyId, savedCoupon);
  }, [companyId, savedCoupon]);

  // Traer/revalidar el registro del cupón guardado (cart-independiente). Si quedó
  // hard-inválido (no existe / vencido / agotado / canal equivocado), lo
  // descartamos en silencio para no ofrecer un cupón muerto.
  useEffect(() => {
    let cancelled = false;
    const code = savedCoupon?.code;
    if (!code) {
      setCouponRecord(null);
      return;
    }
    setLoading(true);
    fetchCoupon(companyId, code).then((rec) => {
      if (cancelled) return;
      setLoading(false);
      if (!rec || !couponBasicValidity(rec, storeType).ok) {
        setCouponRecord(null);
        setSavedCoupon(null);
        return;
      }
      setCouponRecord(rec);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, savedCoupon?.code, storeType]);

  const saveCoupon = useCallback(
    async (code: string, opts?: { applied?: boolean }): Promise<{ ok: boolean; error?: string }> => {
      const clean = code.trim().toUpperCase();
      if (!clean) return { ok: false, error: 'Ingresá un código.' };
      setLoading(true);
      const rec = await fetchCoupon(companyId, clean);
      setLoading(false);
      if (!rec) return { ok: false, error: 'El código no es válido.' };
      const basic = couponBasicValidity(rec, storeType);
      if (!basic.ok) return { ok: false, error: basic.error };
      setCouponRecord(rec);
      setSavedCoupon({ code: rec.code, applied: opts?.applied ?? false });
      return { ok: true };
    },
    [companyId, storeType],
  );

  const setApplied = useCallback((applied: boolean) => {
    setSavedCoupon((prev) => (prev ? { ...prev, applied } : prev));
  }, []);

  const toggleCoupon = useCallback(() => {
    setSavedCoupon((prev) => (prev ? { ...prev, applied: !prev.applied } : prev));
  }, []);

  const removeCoupon = useCallback(() => {
    setSavedCoupon(null);
    setCouponRecord(null);
  }, []);

  // Magic link ?coupon=CODE (se suscribió en el celu y compra en la compu, o
  // borró el caché). Guardamos el cupón (NO aplicado) y limpiamos el query param
  // para no dejarlo visible ni compartible. Corre una sola vez, en cualquier ruta.
  useEffect(() => {
    if (magicHandled.current || !companyId) return;
    magicHandled.current = true;
    let code = '';
    try {
      const params = new URLSearchParams(window.location.search);
      code = (params.get('coupon') || '').trim();
      if (!code) return;
      params.delete('coupon');
      const qs = params.toString();
      const url = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
      window.history.replaceState({}, '', url);
    } catch {
      return;
    }
    if (!code) return;
    // Validación cart-independiente: el carrito suele estar vacío al llegar por el
    // link, así que NO usamos la validación completa (rechazaría por "sin items").
    // Si el link es viejo/ inválido, se ignora en silencio (sin error visible).
    saveCoupon(code, { applied: false }).catch(() => {
      /* link inválido: ignorar */
    });
  }, [companyId, saveCoupon]);

  return (
    <CouponContext.Provider
      value={{ savedCoupon, couponRecord, loading, saveCoupon, setApplied, toggleCoupon, removeCoupon }}
    >
      {children}
    </CouponContext.Provider>
  );
}

export function useCoupon(): CouponContextValue {
  const ctx = useContext(CouponContext);
  if (!ctx) throw new Error('useCoupon debe usarse dentro de <CouponProvider>');
  return ctx;
}
