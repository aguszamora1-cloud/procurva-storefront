// Lógica de compra MAYORISTA (suelto / curva), portada de procurva2/PublicCatalog.tsx
// y adaptada a la arquitectura del storefront. Funciones puras: la UI vive en los
// componentes WholesalePriceTable / WholesalePurchasePanel.
import type { CurveDist, CurvePriceTier, Product, Variant } from './types';
import { sortSizes } from './utils';

/** Colores únicos (no vacíos) de un producto. */
export function colorsOf(p: Product): string[] {
  const set = new Set<string>();
  for (const v of p.product_variants) if (v.color) set.add(v.color);
  return Array.from(set);
}

/** Variantes de un producto para un color dado. */
export function variantsOfColor(p: Product, color: string | null): Variant[] {
  return p.product_variants.filter((v) => v.color === color);
}

/** Talles (ordenados) que existen para un color dado. */
export function sizesOfColor(p: Product, color: string | null): string[] {
  const set = new Set<string>();
  for (const v of p.product_variants) {
    if (v.color === color && v.size) set.add(v.size);
  }
  return sortSizes(Array.from(set));
}

/** Stock de la combinación talle+color (0 si no existe). */
export function sizeStock(p: Product, size: string, color: string | null): number {
  const v = p.product_variants.find((vv) => vv.size === size && vv.color === color);
  return v?.stock ?? 0;
}

/** Tiers de curva ordenados ascendente por cantidad. */
export function sortedTiers(tiers: CurvePriceTier[]): CurvePriceTier[] {
  return [...tiers].sort((a, b) => a.curve_quantity - b.curve_quantity);
}

/**
 * Tier aplicable para una cantidad de curvas: el de mayor curve_quantity que sea
 * <= curves; si la cantidad es menor al tier más chico, cae al más chico definido.
 */
export function pickCurveTier(tiers: CurvePriceTier[], curves: number): CurvePriceTier | null {
  const sorted = sortedTiers(tiers);
  if (sorted.length === 0) return null;
  let active: CurvePriceTier | null = null;
  for (const t of sorted) {
    if (t.curve_quantity <= curves) active = t;
    else break;
  }
  return active ?? sorted[0];
}

/** Unidades que incluye UNA curva (según composición, o nº de talles del color como fallback). */
export function itemsPerCurve(dist: CurveDist[], p: Product, color: string | null): number {
  if (dist.length > 0) return dist.reduce((sum, d) => sum + (d.quantity || 1), 0);
  return sizesOfColor(p, color).length;
}

/** Expande una cantidad de curvas (de un color) en {variante, cantidad} por talle. */
export function expandCurve(
  p: Product,
  color: string | null,
  curves: number,
  dist: CurveDist[],
): Array<{ variant: Variant; qty: number }> {
  const out: Array<{ variant: Variant; qty: number }> = [];
  if (dist.length > 0) {
    for (const d of dist) {
      const v = p.product_variants.find((vv) => vv.size === d.size && vv.color === color);
      if (v) out.push({ variant: v, qty: (d.quantity || 1) * curves });
    }
  } else {
    for (const v of variantsOfColor(p, color)) {
      out.push({ variant: v, qty: curves });
    }
  }
  return out;
}

/** Texto de composición de la curva (ej: "1 curva = S×1, M×2, L×2"). */
export function curveCompositionText(dist: CurveDist[], p: Product, color: string | null): string {
  if (dist.length > 0) {
    const sorted = [...dist].sort(
      (a, b) => sortSizes([a.size, b.size]).indexOf(a.size) - sortSizes([a.size, b.size]).indexOf(b.size),
    );
    return `1 curva = ${sorted.map((d) => `${d.size}×${d.quantity}`).join(', ')}`;
  }
  const sizes = sizesOfColor(p, color);
  if (sizes.length > 0) return `1 curva = ${sizes.map((s) => `${s}×1`).join(', ')}`;
  return 'Cada curva incluye 1 unidad de cada talle';
}

/**
 * ¿Se puede ofrecer compra por curva para ese color? (replica canOfferCurveByColor).
 * Requiere tiers definidos y stock suficiente en al menos 2 talles del color.
 */
export function canOfferCurve(
  p: Product,
  color: string | null,
  tiers: CurvePriceTier[],
  dist: CurveDist[],
): boolean {
  if (!color || tiers.length === 0) return false;
  const vsColor = variantsOfColor(p, color);
  if (dist.length > 0) {
    if (dist.length < 2) return false;
    return dist.every((d) => {
      const v = vsColor.find((vv) => vv.size === d.size);
      return !!v && (v.stock ?? 0) >= (d.quantity || 1);
    });
  }
  const sizesWithStock = new Set(vsColor.filter((v) => (v.stock ?? 0) >= 1).map((v) => v.size));
  return sizesWithStock.size >= 2;
}

/** ¿Hay stock suficiente para la curva en el color elegido? (para el aviso "sin stock"). */
export function curveHasStock(
  p: Product,
  color: string | null,
  curves: number,
  dist: CurveDist[],
): boolean {
  const expanded = expandCurve(p, color, curves, dist);
  if (expanded.length === 0) return false;
  return expanded.every(({ variant, qty }) => (variant.stock ?? 0) >= qty);
}

export interface PriceRow {
  label: string;
  price: number;
  best: boolean;
}

/**
 * Filas de la tabla de precios escalonados (card y detalle):
 *  "Por talle" (wholesale_price) + una fila por tier de curva. El tier más alto se
 *  marca como "N+ curvas" (mejor precio) solo si hay más de un tier (igual que PublicCatalog).
 */
export function priceRows(wholesalePrice: number, tiers: CurvePriceTier[]): PriceRow[] {
  const sorted = sortedTiers(tiers);
  const rows: PriceRow[] = [{ label: 'Por talle', price: wholesalePrice, best: false }];
  sorted.forEach((t, i) => {
    const isBest = i === sorted.length - 1 && sorted.length > 1;
    const label = isBest
      ? `${t.curve_quantity}+ curvas`
      : `${t.curve_quantity} ${t.curve_quantity === 1 ? 'curva' : 'curvas'}`;
    rows.push({ label, price: t.price_per_unit, best: isBest });
  });
  return rows;
}
