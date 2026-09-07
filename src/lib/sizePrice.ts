/**
 * Precio por TALLE — ajuste sobre el precio de la ficha.
 *
 * ESPEJO EXACTO de procurva2/lib/sizePrice.ts (el ERP) y de la función SQL
 * public.storefront_size_price (migración 20260907), que es la que usa el
 * detector de precios del checkout. Los tres tienen que cambiar en el mismo
 * deploy: si el precio que arma esta tienda no coincide con el que recalcula el
 * SQL, cada pedido con un talle ajustado queda marcado como discrepancia.
 *
 * El comercio carga en la ficha un AJUSTE por talle, no un precio:
 *
 *   { "XL": { type: 'amount', value: 1500 }, "XXL": { type: 'percent', value: 10 } }
 *
 * DÓNDE ENTRA EN LA CADENA (importa el orden):
 *
 *   precio de la ficha por medio de pago (getPriceInfo)  ->  AJUSTE POR TALLE
 *   ->  promociones  ->  escalón por categoría  ->  cupón
 *
 * Sólo aplica al canal MINORISTA y a la venta suelta: el mayorista se precia por
 * curvas y packs, que traen su propio precio por unidad.
 *
 * El talle es texto libre (product_variants.size), así que la búsqueda es
 * tolerante a mayúsculas y espacios.
 */

export type SizeAdjustmentType = 'amount' | 'percent';

export interface SizePriceAdjustment {
  type: SizeAdjustmentType;
  /** Monto (`amount`) o porcentaje (`percent`). Puede ser negativo. */
  value: number;
}

export type SizePriceAdjustments = Record<string, SizePriceAdjustment>;

/** Lo mínimo que se le pide al producto. */
export interface HasSizeAdjustments {
  size_price_adjustments?: SizePriceAdjustments | Record<string, unknown> | null;
}

/** Redondeo a 2 decimales, para que un porcentaje no deje $22000.000000000004. */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Comparación de talles tolerante: es texto libre del comercio. */
export const normalizeSize = (size?: string | null): string =>
  String(size ?? '').trim().toLocaleUpperCase('es');

/** Valida lo que venga de la base (jsonb: puede traer cualquier cosa). */
export function parseSizeAdjustments(raw: unknown): SizePriceAdjustments {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SizePriceAdjustments = {};
  for (const [size, adj] of Object.entries(raw as Record<string, any>)) {
    if (!size || !adj || typeof adj !== 'object') continue;
    const type: SizeAdjustmentType = adj.type === 'percent' ? 'percent' : 'amount';
    const value = Number(adj.value);
    if (!Number.isFinite(value) || value === 0) continue;
    out[size] = { type, value };
  }
  return out;
}

/** ¿El producto tiene al menos un talle con precio distinto? */
export function hasSizeAdjustments(product?: HasSizeAdjustments | null): boolean {
  return Object.keys(parseSizeAdjustments(product?.size_price_adjustments)).length > 0;
}

/** El ajuste de un talle, o null. */
export function adjustmentForSize(
  product?: HasSizeAdjustments | null,
  size?: string | null,
): SizePriceAdjustment | null {
  if (!product?.size_price_adjustments || !size) return null;
  const adjustments = parseSizeAdjustments(product.size_price_adjustments);
  const direct = adjustments[size];
  if (direct) return direct;
  const target = normalizeSize(size);
  if (!target) return null;
  for (const [key, adj] of Object.entries(adjustments)) {
    if (normalizeSize(key) === target) return adj;
  }
  return null;
}

/** Aplica un ajuste a un precio. Nunca devuelve negativo. */
export function applySizeAdjustment(price: number, adj?: SizePriceAdjustment | null): number {
  const base = Number(price) || 0;
  if (!adj) return base;
  const value = Number(adj.value) || 0;
  const result = adj.type === 'percent' ? base * (1 + value / 100) : base + value;
  return Math.max(0, round2(result));
}

/**
 * El precio de UN talle. `price` ya tiene que venir resuelto por medio de pago.
 * Un precio en 0 o negativo se devuelve tal cual: no se inventa un precio donde
 * el comercio no cargó ninguno.
 */
export function priceForSize(
  price: number,
  product?: HasSizeAdjustments | null,
  size?: string | null,
): number {
  const base = Number(price) || 0;
  if (base <= 0) return base;
  return applySizeAdjustment(base, adjustmentForSize(product, size));
}

/** Igual que priceForSize pero preserva el null (para cashPrice/comparePrice). */
export function priceForSizeOrNull(
  price: number | null,
  product?: HasSizeAdjustments | null,
  size?: string | null,
): number | null {
  if (price == null) return null;
  return priceForSize(price, product, size);
}

/**
 * Rango de precios de un producto, para el "Desde $X" de las cards del listado,
 * donde todavía no se eligió el talle. Sin ajustes devuelve el precio pelado.
 */
export function sizePriceRange(
  price: number,
  product?: HasSizeAdjustments | null,
  sizes?: Array<string | null | undefined>,
): { min: number; max: number; varies: boolean } {
  const base = Number(price) || 0;
  if (base <= 0 || !hasSizeAdjustments(product) || !sizes?.length) {
    return { min: base, max: base, varies: false };
  }
  let min = Infinity;
  let max = -Infinity;
  for (const size of sizes) {
    const p = applySizeAdjustment(base, adjustmentForSize(product, size));
    if (p < min) min = p;
    if (p > max) max = p;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: base, max: base, varies: false };
  return { min, max, varies: min !== max };
}
