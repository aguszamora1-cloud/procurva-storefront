import { useMemo } from 'react';
import { useStore } from '@/context/StoreProvider';
import { usePromotions } from '@/context/PromotionsContext';
import { useFeaturedSections } from '@/hooks/useFeaturedSections';
import { useTopSelling } from '@/hooks/useTopSelling';
import { buildSectionProducts, type HomeSectionKey } from '@/lib/homeSections';
import type { Product } from '@/lib/types';

/**
 * Las tres secciones de productos del home, armadas UNA sola vez y consumidas
 * por el home (que las corta) y por el listado (que las muestra completas
 * cuando llega con ?seccion=). Es la garantía de que el "Ver más productos" no
 * lleve a un conjunto distinto del que se venía viendo.
 *
 * Las listas vienen SIN LÍMITE: el corte es responsabilidad de quien renderiza
 * (ProductsSection), y se hace sobre las cards ya expandidas por color.
 *
 * `products` entra por parámetro y no se pide adentro a propósito: useProducts
 * tiene estado propio por llamada, así que invocarlo acá dispararía una segunda
 * query del catálogo en cada página que use este hook.
 */
export interface HomeSections {
  /** Pins + todo el catálogo por más vendidos. NO es un subconjunto: es un orden. */
  featured: Product[];
  /** Pins + todo el catálogo por recencia. NO es un subconjunto: es un orden. */
  newArrivals: Product[];
  /** Sólo los productos con promoción vigente para el canal. Este SÍ recorta. */
  offers: Product[];
  /** Ids fijados por sección, tal como los devuelve la RPC (para reusar el orden). */
  pins: { featured: string[]; newArrivals: string[]; offersOrder: string[] };
  loading: boolean;
}

/** Lista de una sección por su key (para resolver un ?seccion= sin repetir el switch). */
export function sectionProducts(sections: HomeSections, key: HomeSectionKey): Product[] {
  if (key === 'featured') return sections.featured;
  if (key === 'new_arrivals') return sections.newArrivals;
  return sections.offers;
}

export function useHomeSections(
  products: Product[],
  opts: { enabled?: boolean } = {},
): HomeSections {
  const { enabled = true } = opts;
  const config = useStore();
  // Pins (productos fijados) por canal, desde storefront_featured_products.
  const fs = useFeaturedSections();
  // Ranking de ventas para la regla automática de Destacados.
  const top = useTopSelling({ enabled });
  const { promoForProduct, priceFor } = usePromotions();

  // Destacados: pins arriba + resto por MÁS VENDIDOS (rank de unidades; los sin
  // ventas caen por recencia, que es el orden base de `products`).
  const featured = useMemo(() => {
    const auto = products.slice().sort((a, b) => {
      const ra = top.rank.has(a.id) ? (top.rank.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
      const rb = top.rank.has(b.id) ? (top.rank.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
    return buildSectionProducts(products, fs.featured, auto);
  }, [products, fs.featured, top.rank]);

  // Nuevos ingresos: pins arriba + resto por created_at DESC (orden base de `products`).
  const newArrivals = useMemo(
    () => buildSectionProducts(products, fs.newArrivals, products),
    [products, fs.newArrivals],
  );

  // Ofertas: la membresía se DERIVA de las promos vigentes (fuente única). Los
  // pins sólo cuentan si el producto SIGUE en promoción (el pin no fuerza oferta).
  // Resto por mayor descuento %.
  const offers = useMemo(() => {
    const refPrice = (p: Product) =>
      config.storeType === 'wholesale' ? p.wholesale_price ?? 0 : p.retail_price ?? 0;
    const discPct = (p: Product) => priceFor(refPrice(p), p).discountPct ?? 0;
    const inPromo = products.filter((p) => promoForProduct(p) !== null);
    const inPromoIds = new Set(inPromo.map((p) => p.id));
    const auto = inPromo.slice().sort((a, b) => discPct(b) - discPct(a));
    const pinIds = fs.offersOrder.filter((id) => inPromoIds.has(id));
    return buildSectionProducts(products, pinIds, auto);
  }, [products, fs.offersOrder, promoForProduct, priceFor, config.storeType]);

  const pins = useMemo(
    () => ({ featured: fs.featured, newArrivals: fs.newArrivals, offersOrder: fs.offersOrder }),
    [fs.featured, fs.newArrivals, fs.offersOrder],
  );

  return { featured, newArrivals, offers, pins, loading: fs.loading };
}
