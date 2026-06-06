import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import type { CurveDist, CurvePriceTier } from '@/lib/types';

/**
 * Precios por curva (escalonados) y composición de curva, por producto, de la
 * tienda mayorista. Se cargan UNA vez por empresa (igual que PublicCatalog), y
 * solo cuando storeType === 'wholesale' (en retail queda vacío, sin fetch).
 */
interface WholesalePricingValue {
  curveTiers: Record<string, CurvePriceTier[]>;
  curveDistributions: Record<string, CurveDist[]>;
  loading: boolean;
}

const WholesalePricingContext = createContext<WholesalePricingValue>({
  curveTiers: {},
  curveDistributions: {},
  loading: false,
});

function groupBy<T extends { product_id: string }>(rows: T[]): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const r of rows) (map[r.product_id] ??= []).push(r);
  return map;
}

export function WholesalePricingProvider({ children }: { children: ReactNode }) {
  const { companyId, storeType } = useStoreStatus();
  const [curveTiers, setCurveTiers] = useState<Record<string, CurvePriceTier[]>>({});
  const [curveDistributions, setCurveDistributions] = useState<Record<string, CurveDist[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (storeType !== 'wholesale' || !companyId) {
      setCurveTiers({});
      setCurveDistributions({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [tiersRes, curvesRes] = await Promise.all([
        supabase
          .from('product_curve_price_tiers')
          .select('product_id, curve_quantity, price_per_unit')
          .eq('company_id', companyId)
          .order('curve_quantity', { ascending: true }),
        supabase
          .from('product_curves')
          .select('product_id, size, quantity')
          .eq('company_id', companyId),
      ]);
      if (cancelled) return;
      if (tiersRes.error) console.error('[WholesalePricing] curve tiers:', tiersRes.error);
      if (curvesRes.error) console.error('[WholesalePricing] curves:', curvesRes.error);
      setCurveTiers(groupBy((tiersRes.data ?? []) as CurvePriceTier[]));
      setCurveDistributions(groupBy((curvesRes.data ?? []) as CurveDist[]));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, storeType]);

  return (
    <WholesalePricingContext.Provider value={{ curveTiers, curveDistributions, loading }}>
      {children}
    </WholesalePricingContext.Provider>
  );
}

export function useWholesalePricing(): WholesalePricingValue {
  return useContext(WholesalePricingContext);
}
