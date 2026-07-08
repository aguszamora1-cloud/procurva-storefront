// Lógica de compra por PACK (media docena / docena / bulto), portada de
// procurva2/PublicCatalog.tsx. Funciones puras: la UI vive en WholesalePriceTable
// (tabla de la card) y WholesalePurchasePanel (tab "Por pack" del detalle).
import type { CartItem, CurvePriceTier, PackPriceTier, Product, ProductPack } from './types';
import { sortSizes } from './utils';
import { priceRows as curvePriceRows, sortedTiers, type PriceRow } from './wholesale';

export type PackCategory = 'half_dozen' | 'dozen' | 'bulto';

/** Categoría (volumen) del pack, inferida de total_units (6 / 12 / resto). */
export function packCategory(pack: ProductPack): PackCategory {
  if (pack.total_units === 6) return 'half_dozen';
  if (pack.total_units === 12) return 'dozen';
  return 'bulto';
}

/** Sustantivo (singular/plural) para etiquetar los escalones de un pack. */
function packNoun(pack: ProductPack): { one: string; many: string } {
  switch (packCategory(pack)) {
    case 'half_dozen':
      return { one: 'media docena', many: 'medias docenas' };
    case 'dozen':
      return { one: 'docena', many: 'docenas' };
    default:
      return { one: 'bulto', many: 'bultos' };
  }
}

const CAT_ORDER: Record<PackCategory, number> = { half_dozen: 0, dozen: 1, bulto: 2 };

/** Packs ordenados de menor a mayor volumen (media docena → docena → bulto). */
export function sortedPacks(packs: ProductPack[]): ProductPack[] {
  return [...packs].sort((a, b) => {
    const ca = CAT_ORDER[packCategory(a)];
    const cb = CAT_ORDER[packCategory(b)];
    if (ca !== cb) return ca - cb;
    return a.total_units - b.total_units;
  });
}

/** Escalones del pack con precio (>0), ordenados ascendente por min_packs. */
export function sortedPackTiers(tiers: PackPriceTier[]): PackPriceTier[] {
  return [...tiers].filter((t) => t.price_per_unit > 0).sort((a, b) => a.min_packs - b.min_packs);
}

/** ¿El pack tiene al menos un escalón con precio cargado (>0)? */
export function packHasPrice(pack: ProductPack): boolean {
  return pack.price_tiers.some((t) => t.price_per_unit > 0);
}

/** Packs habilitados (is_active) y con precio, ordenados por volumen. */
export function activePacks(packs: ProductPack[]): ProductPack[] {
  return sortedPacks(packs.filter((p) => p.is_active && packHasPrice(p)));
}

/** Escalón aplicable para `numPacks` packs (el de mayor min_packs que sea <=). */
export function pickPackTier(tiers: PackPriceTier[], numPacks: number): PackPriceTier | null {
  const sorted = sortedPackTiers(tiers);
  if (sorted.length === 0) return null;
  let active = sorted[0];
  for (const t of sorted) {
    if (numPacks >= t.min_packs) active = t;
    else break;
  }
  return active;
}

/** Precio por unidad más bajo (mejor escalón) de un pack. */
export function packBestUnitPrice(pack: ProductPack): number {
  const prices = pack.price_tiers.map((t) => t.price_per_unit).filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : 0;
}

/** Etiqueta de un escalón en la tabla de precios (ej: "1 docena", "2+ docenas"). */
export function packTierLabel(pack: ProductPack, tier: PackPriceTier): string {
  const { one, many } = packNoun(pack);
  // Singular si la cantidad mínima es 1 ("1+ docena"), plural si es 2+ ("2+ docenas").
  if (tier.max_packs == null) return `${tier.min_packs}+ ${tier.min_packs === 1 ? one : many}`;
  if (tier.min_packs === tier.max_packs) return `${tier.min_packs} ${tier.min_packs === 1 ? one : many}`;
  return `${tier.min_packs}–${tier.max_packs} ${many}`;
}

/** Etiqueta corta de cantidad de packs (ej: "2 docenas", "1 bulto"). */
export function packCountLabel(pack: ProductPack, count: number): string {
  const { one, many } = packNoun(pack);
  return `${count} ${count === 1 ? one : many}`;
}

export interface PackSizeRow {
  size: string;
  quantity: number;
}

/** Distribución de talles del pack (agregada por talle, ordenada). */
export function packSizeDistribution(pack: ProductPack): PackSizeRow[] {
  const map = new Map<string, number>();
  for (const it of pack.items) map.set(it.size, (map.get(it.size) ?? 0) + it.quantity);
  return sortSizes(Array.from(map.keys())).map((size) => ({ size, quantity: map.get(size) ?? 0 }));
}

/**
 * Filas de la tabla de precios de la card: "Por talle" + escalones de curva +
 * escalones de cada pack habilitado. El badge "Mejor precio" se asigna a la fila
 * con el menor precio por unidad de TODAS (curva + packs). Si no hay packs, se
 * conserva exactamente el comportamiento previo (solo curva).
 */
export function combinedPriceRows(
  wholesalePrice: number,
  curveTiers: CurvePriceTier[],
  packs: ProductPack[],
): PriceRow[] {
  const active = activePacks(packs);
  if (active.length === 0) return curvePriceRows(wholesalePrice, curveTiers);

  // Curva sin marcar (recalculamos el mejor precio de forma global). Ocultamos la
  // fila "Por talle" si no hay precio mayorista (productos pack_only / sin suelto).
  const rows: PriceRow[] = curvePriceRows(wholesalePrice, curveTiers)
    .filter((r) => r.label !== 'Por talle' || r.price > 0)
    .map((r) => ({ ...r, best: false }));

  for (const pack of active) {
    for (const tier of sortedPackTiers(pack.price_tiers)) {
      rows.push({ label: packTierLabel(pack, tier), price: tier.price_per_unit, best: false });
    }
  }

  const priced = rows.filter((r) => r.price > 0);
  if (priced.length > 1) {
    const min = Math.min(...priced.map((r) => r.price));
    // Marcamos la última fila que alcanza el mínimo (mayor volumen ante empates).
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].price === min) {
        rows[i].best = true;
        break;
      }
    }
  }
  return rows;
}

/**
 * Filas de precio de la CURVA SURTIDA (modalidad independiente de la curva de
 * mismo color). Se muestran como líneas sueltas, sin encabezado y SIN participar
 * del ranking "MEJOR PRECIO" (best siempre false). Vacío si no hay tiers.
 */
export function curvaSurtidaRows(tiers: CurvePriceTier[]): PriceRow[] {
  const sorted = sortedTiers(tiers);
  return sorted.map((t, i) => {
    const isLast = i === sorted.length - 1 && sorted.length > 1;
    const label = isLast
      ? `${t.curve_quantity}+ curvas surtidas`
      : `${t.curve_quantity} ${t.curve_quantity === 1 ? 'curva surtida' : 'curvas surtidas'}`;
    return { label, price: t.price_per_unit, best: false };
  });
}

/**
 * Expande un pack a líneas de carrito (mirror de PublicCatalog). Cada item del
 * pack se mapea a su variante real por (color, talle); los modos free_color y
 * no_distribution usan variant_id sintéticos (igual que el catálogo de procurva2).
 */
export function packCartLines(
  product: Product,
  pack: ProductPack,
  numPacks: number,
  unitPrice: number,
  fallbackImg: string | null,
): CartItem[] {
  const base = {
    product_id: product.id,
    name: product.name,
    unit_price: unitPrice,
    source: 'pack' as const,
    packId: pack.id,
    packs: numPacks,
  };

  // no_distribution: una sola línea sintética con el total de unidades.
  if (pack.pack_type === 'no_distribution' || pack.items.length === 0) {
    return [
      {
        ...base,
        variant_id: `nodist-${pack.id}`,
        size: null,
        color: null,
        qty: pack.total_units * numPacks,
        image_url: fallbackImg,
        packLabel: `${pack.name} · sin distribución`,
      },
    ];
  }

  const lines: CartItem[] = [];
  for (const it of pack.items) {
    const qty = it.quantity * numPacks;
    // free_color (o item sin color): variante sintética, color a definir.
    if (pack.pack_type === 'free_color' || !it.color) {
      lines.push({
        ...base,
        variant_id: `free-${pack.id}-${it.size}`,
        size: it.size,
        color: null,
        qty,
        image_url: fallbackImg,
        packLabel: `${pack.name} · color a definir`,
      });
      continue;
    }
    const v = product.product_variants.find((x) => x.size === it.size && x.color === it.color);
    lines.push({
      ...base,
      variant_id: v?.id ?? `pack-${pack.id}-${it.color}-${it.size}`,
      size: it.size,
      color: it.color,
      qty,
      image_url: v?.image_url ?? fallbackImg,
      packLabel: pack.pack_type === 'single_color' ? `${pack.name} · ${it.color}` : pack.name,
    });
  }
  return lines;
}
