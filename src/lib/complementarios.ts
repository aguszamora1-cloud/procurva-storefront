import type { CartItem, CurveDist, CurvePriceTier, Product, ProductPack, Variant } from './types';
import { getPriceInfo, sortSizes } from './utils';
import { expandCurve, maxCurvesAvailable, sortedTiers } from './wholesale';
import { activePacks, packCartLines, pickPackTier } from './packs';

/**
 * Helpers para el "quick-add" del bloque de complementarios: construyen las líneas
 * de carrito de la UNIDAD MÍNIMA de venta (unidad / curva / pack) reusando la misma
 * lógica del panel mayorista. Puras (sin hooks): la data mayorista (tiers/dist/packs)
 * se pasa como argumento.
 */

export const variantsOf = (p: Product): Variant[] => p.product_variants ?? [];

export const colorsOf = (p: Product): string[] =>
  Array.from(new Set(variantsOf(p).filter((v) => v.color).map((v) => v.color as string)));

export const sizesOf = (p: Product, color?: string | null): string[] =>
  sortSizes(
    Array.from(
      new Set(
        variantsOf(p)
          .filter((v) => (!color || v.color === color) && v.size)
          .map((v) => v.size as string),
      ),
    ),
  );

/** Resuelve la variante (fila) por color+talle, tolerando productos sin color/talle. */
export function findVariant(p: Product, color: string | null, size: string | null): Variant | null {
  const vs = variantsOf(p);
  const hasColors = colorsOf(p).length > 0;
  const hasSizes = sizesOf(p).length > 0;
  return vs.find((v) => (!hasColors || v.color === color) && (!hasSizes || v.size === size)) ?? null;
}

/** true si la variante existe y tiene stock. */
export const variantHasStock = (v: Variant | null): boolean => !!v && (v.stock ?? 0) > 0;

/** Talle disponible (con stock) para un color puntual. */
export const sizeInStock = (p: Product, color: string | null, size: string): boolean =>
  variantsOf(p).some((v) => v.size === size && (!color || v.color === color) && (v.stock ?? 0) > 0);

// ── Retail: una unidad suelta ────────────────────────────────────────────────
export function retailUnitLine(p: Product, variant: Variant, fallbackImg: string | null): CartItem {
  const info = getPriceInfo(p);
  const cash = info.cashPrice != null && info.cashPrice < info.mainPrice ? info.cashPrice : undefined;
  return {
    product_id: p.id,
    variant_id: variant.id,
    name: p.name,
    categories: Array.isArray(p.categories) ? p.categories.filter(Boolean) : null,
    size: variant.size,
    color: variant.color,
    unit_price: info.mainPrice,
    ...(cash != null ? { unit_price_cash: cash } : {}),
    qty: 1,
    image_url: variant.image_url ?? fallbackImg ?? null,
  };
}

// ── Mayorista: unidad mínima (pack / curva / unidad) ─────────────────────────
export interface WholesaleData {
  tiers: CurvePriceTier[];
  dist: CurveDist[];
  packs: ProductPack[];
}

export type MinUnitKind = 'pack' | 'curva' | 'unit';

/** Qué unidad mínima corresponde al producto en mayorista. */
export function minUnitKind(p: Product, w: WholesaleData): MinUnitKind {
  if (p.pack_only_sale || activePacks(w.packs).length > 0) return 'pack';
  if (sortedTiers(w.tiers).length > 0) return 'curva';
  return 'unit';
}

/** Líneas de UN pack (el de menor volumen). */
export function packLinesFor(p: Product, w: WholesaleData, fallbackImg: string | null): CartItem[] {
  const packs = activePacks(w.packs);
  const pack = packs[0];
  if (!pack) return [];
  const price = pickPackTier(pack.price_tiers, 1)?.price_per_unit ?? 0;
  if (price <= 0) return [];
  return packCartLines(p, pack, 1, price, fallbackImg ?? '');
}

/** Líneas de UNA curva del color indicado, al escalón base. */
export function curvaLinesFor(p: Product, color: string, w: WholesaleData, fallbackImg: string | null): CartItem[] {
  const tiers = sortedTiers(w.tiers);
  if (tiers.length === 0) return [];
  if (maxCurvesAvailable(p, color, w.dist) < 1) return [];
  const price = (tiers.find((t) => t.curve_quantity === 1) ?? tiers[0])?.price_per_unit ?? p.wholesale_price ?? 0;
  if (price <= 0) return [];
  return expandCurve(p, color, 1, w.dist).map(({ variant, qty }) => ({
    product_id: p.id,
    variant_id: variant.id,
    name: p.name,
    size: variant.size,
    color: variant.color,
    unit_price: price,
    qty,
    image_url: variant.image_url ?? fallbackImg ?? null,
    source: 'curva' as const,
    curves: 1,
  }));
}

/** Una unidad suelta mayorista. */
export function wholesaleUnitLine(p: Product, variant: Variant, fallbackImg: string | null): CartItem {
  return {
    product_id: p.id,
    variant_id: variant.id,
    name: p.name,
    size: variant.size,
    color: variant.color,
    unit_price: variant.price ?? p.wholesale_price ?? 0,
    qty: 1,
    image_url: variant.image_url ?? fallbackImg ?? null,
    source: 'suelto',
  };
}
