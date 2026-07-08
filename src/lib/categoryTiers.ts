// Escalones por cantidad A NIVEL DE CATEGORÍA (volume tiers) del storefront retail.
// Fuente: tabla category_volume_tiers de ProCurva (una fila por categoría, con los
// escalones en un array JSONB). Reemplaza el mock hardcodeado del prototipo: los
// escalones, el % de cada uno, la estrella (is_featured) y el toggle "cada unidad
// elige su variante" salen ahora de la DB.
//
// Las categorías en ProCurva son STRINGS (products.categories text[]); la tabla
// referencia la categoría por NOMBRE, scoped por company_id.

import type { Product } from './types';

/** Un escalón de descuento por cantidad (parseado de la fila DB). */
export interface CategoryTier {
  /** Unidades mínimas para el escalón ("Lleva N"). Siempre >= 2. */
  minQuantity: number;
  /** % de descuento del escalón (0 < pct <= 100). */
  discountPct: number;
  /** Escalón destacado (la estrella / "Más elegido"). */
  isFeatured: boolean;
}

/** Config de escalones de una categoría (una fila de category_volume_tiers). */
export interface CategoryTierConfig {
  categoryName: string;
  /** Si cada unidad del escalón elige su propia variante (true) o comparten una (false). */
  variantPerUnit: boolean;
  /** Escalones con descuento (min_quantity >= 2), ordenados por minQuantity asc. */
  tiers: CategoryTier[];
}

/** Fila cruda de category_volume_tiers (solo lo que lee el storefront). */
export interface CategoryTierRow {
  category_name: string;
  is_active: boolean | null;
  variant_per_unit: boolean | null;
  tiers: unknown;
}

/**
 * Parsea/normaliza una fila DB -> config. Descarta escalones inválidos: el mínimo
 * debe ser >= 2 (1 unidad no es "por cantidad") y el % en (0, 100]. Ordena por
 * minQuantity ascendente para que las tarjetas salgan "Lleva 2 / 3 / ...".
 */
export function parseCategoryTierRow(row: CategoryTierRow): CategoryTierConfig {
  const raw = Array.isArray(row.tiers) ? row.tiers : [];
  const tiers: CategoryTier[] = raw
    .map((t): CategoryTier => ({
      minQuantity: Number((t as { min_quantity?: unknown })?.min_quantity ?? 0),
      discountPct: Number((t as { discount_pct?: unknown })?.discount_pct ?? 0),
      isFeatured: Boolean((t as { is_featured?: unknown })?.is_featured),
    }))
    .filter(
      (t) =>
        Number.isFinite(t.minQuantity) &&
        t.minQuantity >= 2 &&
        Number.isFinite(t.discountPct) &&
        t.discountPct > 0 &&
        t.discountPct <= 100,
    )
    .sort((a, b) => a.minQuantity - b.minQuantity);
  return {
    categoryName: row.category_name,
    variantPerUnit: row.variant_per_unit ?? true,
    tiers,
  };
}

/**
 * Config de escalones aplicable a un producto.
 *
 * PRECEDENCIA (decisión del comercio, predecible — NO por mayor descuento):
 * cuando un producto pertenece a VARIAS categorías con escalones, gana la que
 * aparece PRIMERO según el sort_order del catálogo (catalog_category_order). Así
 * el control de qué escalón aplica queda en manos del comercio (ordenando sus
 * categorías) y el resultado es determinístico. Desempate (si dos categorías
 * comparten sort_order, o alguna no está en catalog_category_order) por orden
 * alfabético, para estabilidad. El override por producto es una fase futura.
 */
export function resolveTierConfigForProduct(
  product: Pick<Product, 'categories'>,
  configByCategory: Map<string, CategoryTierConfig>,
  sortOrderByCategory: Map<string, number>,
): CategoryTierConfig | null {
  const cats = Array.isArray(product.categories) ? (product.categories.filter(Boolean) as string[]) : [];
  const candidates = cats
    .map((name) => configByCategory.get(name))
    .filter((c): c is CategoryTierConfig => !!c && c.tiers.length > 0);
  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) =>
      (sortOrderByCategory.get(a.categoryName) ?? Number.POSITIVE_INFINITY) -
        (sortOrderByCategory.get(b.categoryName) ?? Number.POSITIVE_INFINITY) ||
      a.categoryName.localeCompare(b.categoryName, 'es'),
  );
  return candidates[0];
}

/**
 * Precio por unidad de un escalón. El % se aplica sobre CADA base por separado
 * (tarjeta = finalPrice, efectivo = finalCash), NUNCA se suman porcentajes. Las
 * bases ya incluyen la promo automática si la hubiera.
 */
export function tierUnitPrices(
  finalPrice: number,
  finalCash: number | null,
  discountPct: number,
): { card: number; cash: number | null } {
  const factor = 1 - discountPct / 100;
  return {
    card: Math.max(0, Math.round(finalPrice * factor)),
    cash: finalCash != null ? Math.max(0, Math.round(finalCash * factor)) : null,
  };
}
