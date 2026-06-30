import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import type { CurveDist, CurvePriceTier, ProductPack } from '@/lib/types';

/**
 * Precios por curva (escalonados), composición de curva y packs (media docena /
 * docena / bulto), por producto, de la tienda mayorista. Se cargan UNA vez por
 * empresa (igual que PublicCatalog), y solo cuando storeType === 'wholesale'
 * (en retail queda vacío, sin fetch).
 */
interface WholesalePricingValue {
  curveTiers: Record<string, CurvePriceTier[]>;
  // Precio propio de la curva surtida (independiente del de mismo color).
  curvaSurtidaTiers: Record<string, CurvePriceTier[]>;
  curveDistributions: Record<string, CurveDist[]>;
  productPacks: Record<string, ProductPack[]>;
  loading: boolean;
}

const WholesalePricingContext = createContext<WholesalePricingValue>({
  curveTiers: {},
  curvaSurtidaTiers: {},
  curveDistributions: {},
  productPacks: {},
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
  const [curvaSurtidaTiers, setCurvaSurtidaTiers] = useState<Record<string, CurvePriceTier[]>>({});
  const [curveDistributions, setCurveDistributions] = useState<Record<string, CurveDist[]>>({});
  const [productPacks, setProductPacks] = useState<Record<string, ProductPack[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (storeType !== 'wholesale' || !companyId) {
      setCurveTiers({});
      setCurvaSurtidaTiers({});
      setCurveDistributions({});
      setProductPacks({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [tiersRes, surtidaTiersRes, curvesRes, packsRes] = await Promise.all([
        supabase
          .from('product_curve_price_tiers')
          .select('product_id, curve_quantity, price_per_unit')
          .eq('company_id', companyId)
          .order('curve_quantity', { ascending: true }),
        supabase
          .from('product_curva_surtida_price_tiers')
          .select('product_id, curve_quantity, price_per_unit')
          .eq('company_id', companyId)
          .order('curve_quantity', { ascending: true }),
        supabase
          .from('product_curves')
          .select('product_id, size, quantity')
          .eq('company_id', companyId),
        supabase
          .from('product_packs')
          .select('id, product_id, pack_type, name, total_units, is_active')
          .eq('company_id', companyId)
          .eq('is_active', true),
      ]);
      if (cancelled) return;
      if (tiersRes.error) console.error('[WholesalePricing] curve tiers:', tiersRes.error);
      if (surtidaTiersRes.error) console.error('[WholesalePricing] surtida tiers:', surtidaTiersRes.error);
      if (curvesRes.error) console.error('[WholesalePricing] curves:', curvesRes.error);
      if (packsRes.error) console.error('[WholesalePricing] packs:', packsRes.error);

      // Segunda ronda: items y escalones de los packs hallados.
      const packMeta = (packsRes.data ?? []) as Array<{
        id: string;
        product_id: string;
        pack_type: ProductPack['pack_type'];
        name: string;
        total_units: number;
        is_active: boolean;
      }>;
      const packIds = packMeta.map((p) => p.id);
      let packItems: Array<{ pack_id: string; color: string; size: string; quantity: number }> = [];
      let packTiers: Array<{ pack_id: string; min_packs: number; max_packs: number | null; price_per_unit: number }> = [];
      if (packIds.length > 0) {
        const [itemsRes, ptiersRes] = await Promise.all([
          supabase.from('product_pack_items').select('pack_id, color, size, quantity').in('pack_id', packIds),
          supabase
            .from('product_pack_price_tiers')
            .select('pack_id, min_packs, max_packs, price_per_unit')
            .in('pack_id', packIds)
            .order('min_packs', { ascending: true }),
        ]);
        if (cancelled) return;
        if (itemsRes.error) console.error('[WholesalePricing] pack items:', itemsRes.error);
        if (ptiersRes.error) console.error('[WholesalePricing] pack tiers:', ptiersRes.error);
        packItems = itemsRes.data ?? [];
        packTiers = ptiersRes.data ?? [];
      }

      const packsByProduct: Record<string, ProductPack[]> = {};
      for (const p of packMeta) {
        const items = packItems
          .filter((i) => i.pack_id === p.id)
          .map((i) => ({ color: i.color, size: i.size, quantity: i.quantity }));
        // Packs con distribución pero sin items cargados se omiten (igual que PublicCatalog).
        if (p.pack_type !== 'no_distribution' && items.length === 0) continue;
        const price_tiers = packTiers
          .filter((t) => t.pack_id === p.id)
          .map((t) => ({ min_packs: t.min_packs, max_packs: t.max_packs, price_per_unit: Number(t.price_per_unit) }));
        (packsByProduct[p.product_id] ??= []).push({
          id: p.id,
          product_id: p.product_id,
          pack_type: p.pack_type,
          name: p.name,
          total_units: p.total_units,
          is_active: p.is_active,
          items,
          price_tiers,
        });
      }

      setCurveTiers(groupBy((tiersRes.data ?? []) as CurvePriceTier[]));
      setCurvaSurtidaTiers(groupBy((surtidaTiersRes.data ?? []) as CurvePriceTier[]));
      setCurveDistributions(groupBy((curvesRes.data ?? []) as CurveDist[]));
      setProductPacks(packsByProduct);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, storeType]);

  return (
    <WholesalePricingContext.Provider value={{ curveTiers, curvaSurtidaTiers, curveDistributions, productPacks, loading }}>
      {children}
    </WholesalePricingContext.Provider>
  );
}

export function useWholesalePricing(): WholesalePricingValue {
  return useContext(WholesalePricingContext);
}
