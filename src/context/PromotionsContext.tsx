import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useStoreStatus } from '@/context/StoreProvider';
import {
  bestPromoForProduct,
  getPromotionalPrice,
  quantityPromoForProduct,
  quantityPromoMessage,
  type Promotion,
  type PromoResult,
} from '@/lib/promotions';
import type { Product, StoreType } from '@/lib/types';

/**
 * Promociones automáticas activas de la tienda (ecommerce_promotions). Se cargan
 * UNA sola vez por empresa (igual que WholesalePricing) y se aplican client-side,
 * en vez de una query por producto. Los helpers son storeType-aware: usan el
 * descuento minorista o mayorista según el modo de la tienda resuelto.
 */
interface PromotionsValue {
  promotions: Promotion[];
  loading: boolean;
  /** Mejor promo aplicable a un producto (para badge/countdown). */
  promoForProduct: (product: Pick<Product, 'id' | 'categories'>) => Promotion | null;
  /** Precio promocional de un precio de referencia para un producto (storeType-aware). */
  priceFor: (originalPrice: number, product: Pick<Product, 'id' | 'categories'>) => PromoResult;
  /** Mejor promo POR CANTIDAD aplicable a un producto (badge/banner condicional). */
  quantityPromoFor: (product: Pick<Product, 'id' | 'categories'>) => Promotion | null;
  /** Mensaje de la promo por cantidad de un producto (o null si no tiene). */
  quantityMessageFor: (product: Pick<Product, 'id' | 'categories'>) => string | null;
  /** Promos con banner de tienda completa (scope 'all' + banner_image_url). */
  bannerPromotions: Promotion[];
}

const PromotionsContext = createContext<PromotionsValue>({
  promotions: [],
  loading: false,
  promoForProduct: () => null,
  priceFor: (p) => ({ finalPrice: p, promo: null, savings: 0, discountPct: 0 }),
  quantityPromoFor: () => null,
  quantityMessageFor: () => null,
  bannerPromotions: [],
});

export function PromotionsProvider({ children }: { children: ReactNode }) {
  const { companyId, storeType } = useStoreStatus();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setPromotions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const nowIso = new Date().toISOString();
      // anon lee solo promos activas de catálogos habilitados (policy
      // anon_read_active_promotions). Filtramos además por vigencia.
      const { data, error } = await supabase
        .from('ecommerce_promotions')
        .select('*, ecommerce_promotion_items(item_type, item_id)')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .lte('starts_at', nowIso)
        .gte('ends_at', nowIso);
      if (cancelled) return;
      if (error) {
        console.error('[Promotions] error cargando promociones', error);
        setPromotions([]);
      } else {
        setPromotions((data ?? []) as Promotion[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const effectiveStoreType: StoreType = storeType ?? 'retail';

  const promoForProduct = useCallback(
    (product: Pick<Product, 'id' | 'categories'>) => bestPromoForProduct(product, promotions, effectiveStoreType),
    [promotions, effectiveStoreType],
  );

  const priceFor = useCallback(
    (originalPrice: number, product: Pick<Product, 'id' | 'categories'>) =>
      getPromotionalPrice(originalPrice, product, promotions, effectiveStoreType),
    [promotions, effectiveStoreType],
  );

  const quantityPromoFor = useCallback(
    (product: Pick<Product, 'id' | 'categories'>) => quantityPromoForProduct(product, promotions, effectiveStoreType),
    [promotions, effectiveStoreType],
  );

  const quantityMessageFor = useCallback(
    (product: Pick<Product, 'id' | 'categories'>) => {
      const promo = quantityPromoForProduct(product, promotions, effectiveStoreType);
      return promo ? quantityPromoMessage(promo, effectiveStoreType) : null;
    },
    [promotions, effectiveStoreType],
  );

  const bannerPromotions = useMemo(
    // Solo banners de promos AUTOMÁTICAS (las de cantidad no muestran banner de tienda completa).
    () => promotions.filter((p) => p.promo_type !== 'quantity' && p.scope === 'all' && (p.banner_image_url ?? '').trim().length > 0),
    [promotions],
  );

  const value = useMemo<PromotionsValue>(
    () => ({ promotions, loading, promoForProduct, priceFor, quantityPromoFor, quantityMessageFor, bannerPromotions }),
    [promotions, loading, promoForProduct, priceFor, quantityPromoFor, quantityMessageFor, bannerPromotions],
  );

  return <PromotionsContext.Provider value={value}>{children}</PromotionsContext.Provider>;
}

export function usePromotions(): PromotionsValue {
  return useContext(PromotionsContext);
}
