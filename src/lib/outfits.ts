import type { OutfitWithProducts } from '@/hooks/useOutfits';
import { getPriceInfo } from './utils';

export interface OutfitPricing {
  /** Suma de los precios TARJETA de las prendas (sin combo). */
  cardSum: number;
  /** Suma de los precios EFECTIVO de las prendas (sin combo). */
  cashSum: number;
  /** Precio final TARJETA (combo derivado del efectivo, o la suma si no hay combo). */
  comboCard: number;
  /** Precio final EFECTIVO (= combo_price, o la suma si no hay combo). */
  comboCash: number;
  /** El outfit tiene combo_price seteado (>0). */
  hasCombo: boolean;
  /** Ahorro en $ sobre tarjeta (para tachado/badge). */
  cardSaving: number;
  /** Ahorro en $ sobre efectivo (para tachado/badge). */
  cashSaving: number;
}

/**
 * Precios del outfit. Sin combo: suma de las prendas (tarjeta y efectivo).
 * Con combo (catalog_outfits.combo_price): el combo_price es el precio EFECTIVO
 * del look completo; el TARJETA se deriva aplicando el ratio real tarjeta/efectivo
 * de las prendas (mismo recargo que ya tienen sus precios), sin inventar recargo.
 */
export function outfitPricing(o: OutfitWithProducts): OutfitPricing {
  let cardSum = 0;
  let cashSum = 0;
  for (const p of o.products) {
    const info = getPriceInfo(p);
    cardSum += info.mainPrice; // tarjeta (o transferencia/base si no hay tarjeta)
    cashSum += info.cashPrice ?? info.mainPrice; // efectivo si es más barato; si no, el principal
  }
  const combo = o.combo_price ?? null;
  const hasCombo = combo != null && combo > 0;
  const ratio = cashSum > 0 ? cardSum / cashSum : 1; // recargo tarjeta/efectivo del outfit
  const comboCash = hasCombo ? Math.round(combo) : cashSum;
  const comboCard = hasCombo ? Math.round(comboCash * ratio) : cardSum;
  return {
    cardSum,
    cashSum,
    comboCard,
    comboCash,
    hasCombo,
    cardSaving: Math.max(0, cardSum - comboCard),
    cashSaving: Math.max(0, cashSum - comboCash),
  };
}

/** Fotos del look: galería (image_urls) o, si no hay, la foto principal vieja. */
export function outfitImages(o: OutfitWithProducts): string[] {
  if (o.image_urls && o.image_urls.length > 0) return o.image_urls.filter(Boolean);
  return o.image_url ? [o.image_url] : [];
}

/**
 * Outfits que contienen un producto, ordenados por el desempate elegido:
 *  - 'orden_manual': por `order` del outfit (el que el comercio ordenó primero).
 *  - 'mas_vendido': requiere una señal de ventas que el storefront NO expone hoy,
 *    así que CAE a 'orden_manual' (documentado). Cuando exista un contador de ventas
 *    por outfit/producto, se enchufa acá.
 */
export function outfitsContaining(
  outfits: OutfitWithProducts[],
  productId: string,
  _tiebreak: 'orden_manual' | 'mas_vendido',
): OutfitWithProducts[] {
  return outfits
    .filter((o) => o.items?.some((it) => it.product_id === productId) || o.products.some((p) => p.id === productId))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
