import type { ReactNode } from 'react';
import { Zap, Truck, Sparkles } from 'lucide-react';
import { useStore, useStoreType } from '@/context/StoreProvider';
import { usePromotions } from '@/context/PromotionsContext';
import { contrastColor } from '@/lib/theme';
import { badgeColor, getPriceInfo, totalStock } from '@/lib/utils';
import type { Product } from '@/lib/types';

export type BadgeStyle = 'solid' | 'glass' | 'outline';
export type BadgePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface BadgeView {
  key: string;
  bg: string;
  color: string;
  label: string;
  icon?: ReactNode;
}

export interface ProductBadges {
  outOfStock: boolean;
  /** Badges candidatos ya ordenados por prioridad y cortados a 2. */
  badges: BadgeView[];
  style: BadgeStyle;
  position: BadgePosition;
  showIcons: boolean;
}

export interface ProductBadgesOptions {
  /**
   * Incluir el badge de promo por cantidad ("LLEVANDO 2 = 10% OFF"). Por defecto
   * true (ficha de producto). La grilla (ProductCard) lo pasa en false: esa promo
   * solo se muestra en el detalle, no en las cards del listado.
   */
  includeQuantityPromo?: boolean;
}

/** Texto legible sobre `bg`: contraste si es hex, var de acento si es CSS var. */
const onBg = (bg: string): string => (bg.startsWith('#') ? contrastColor(bg) : 'var(--color-on-accent)');

/**
 * Arma los badges de un producto desde `config.badges` (estilo/posición/íconos
 * globales + on/off/color/label/param por badge). Lo comparten la grilla
 * (ProductCard) y la ficha (ProductDetail) para tener una sola fuente de verdad.
 *
 * Defensa: si `config.badges` viene `undefined` (cache viejo sin el campo), todos
 * los accesos caen a defaults (style 'solid', position 'top-left', íconos on, y
 * los defaults por badge que espeja normalizeStoreConfig) sin reventar.
 *
 * Prioridad: Últimas unidades > Envío gratis > Descuento/Promo > badge del
 * comercio > Nuevo. "Sin stock" es excluyente (lo maneja el consumidor).
 */
export function useProductBadges(
  product: Product | null | undefined,
  options: ProductBadgesOptions = {},
): ProductBadges {
  const { includeQuantityPromo = true } = options;
  // TS lo tipa como siempre presente, pero defensivamente lo tratamos como
  // opcional: un cache normalizado viejo (pre-badges) podría no traer el campo.
  const storeBadges = useStore().badges;
  const cfg = storeBadges as typeof storeBadges | undefined;
  const isWholesale = useStoreType() === 'wholesale';
  const { promoForProduct, quantityPromoFor } = usePromotions();

  // Globales con defaults defensivos.
  const style: BadgeStyle = cfg?.style ?? 'solid';
  const position: BadgePosition = cfg?.position ?? 'top-left';
  const showIcons: boolean = cfg?.showIcons ?? true;

  // Sin producto (loading / no encontrado): devolvemos globales + lista vacía.
  // Los hooks de arriba ya corrieron, así que respetamos las reglas de hooks.
  if (!product) return { outOfStock: false, badges: [], style, position, showIcons };

  const promo = promoForProduct(product);
  const qtyPromo = quantityPromoFor(product);
  const { comparePrice, compareDiscountPct } = getPriceInfo(product);
  const onSale = Boolean(comparePrice && compareDiscountPct > 0);

  const lowStockThreshold = cfg?.lowStock?.threshold ?? 5;
  const newWindowDays = cfg?.new?.windowDays ?? 14;

  const stock = totalStock(product);
  const outOfStock = stock <= 0;
  const lowStock = stock > 0 && stock <= lowStockThreshold;
  const showCustom = product.catalog_badge_visible && product.catalog_badge_text;

  // Producto "nuevo": dado de alta dentro de la ventana configurada (en días).
  const isNew = (() => {
    if (!product.created_at) return false;
    const days = (Date.now() - new Date(product.created_at).getTime()) / 86_400_000;
    return days >= 0 && days <= newWindowDays;
  })();

  const badges: BadgeView[] = [];

  if ((cfg?.lowStock?.enabled ?? true) && lowStock) {
    const color = cfg?.lowStock?.color || '#EF4444';
    badges.push({ key: 'low_stock', bg: color, color: contrastColor(color), label: cfg?.lowStock?.label || 'Últimas unidades', icon: <Zap className="h-3 w-3" fill="currentColor" /> });
  }
  if ((cfg?.freeShipping?.enabled ?? true) && product.free_shipping) {
    const color = cfg?.freeShipping?.color || '#16A34A';
    badges.push({ key: 'free_shipping', bg: color, color: contrastColor(color), label: cfg?.freeShipping?.label || 'Envío gratis', icon: <Truck className="h-3 w-3" /> });
  }
  // Grupo "descuento": una sola insignia (promo del comercio > promo por cantidad
  // > -X% automático). Las promos no dependen del toggle de descuento; el -X% sí.
  if (promo) {
    const bg = promo.badge_color || 'var(--color-accent)';
    badges.push({ key: 'promo', bg, color: onBg(bg), label: promo.badge_text || 'PROMO' });
  } else if (qtyPromo && includeQuantityPromo) {
    const bg = qtyPromo.badge_color || 'var(--color-accent)';
    badges.push({ key: 'qty_promo', bg, color: onBg(bg), label: qtyPromo.badge_text || 'PROMO' });
  } else if ((cfg?.discount?.enabled ?? true) && onSale && !isWholesale) {
    const dc = cfg?.discount?.color || ''; // vacío → cae al acento
    badges.push({ key: 'discount', bg: dc || 'var(--color-accent)', color: dc ? contrastColor(dc) : 'var(--color-on-accent)', label: `-${compareDiscountPct}%` });
  }
  if (showCustom) {
    const bg = badgeColor(product.catalog_badge_color);
    badges.push({ key: 'custom', bg, color: onBg(bg), label: product.catalog_badge_text! });
  }
  if ((cfg?.new?.enabled ?? false) && isNew) {
    const color = cfg?.new?.color || '#2563EB';
    badges.push({ key: 'new', bg: color, color: contrastColor(color), label: cfg?.new?.label || 'Nuevo', icon: <Sparkles className="h-3 w-3" /> });
  }

  // Dedup por label: si el comercio cargó un badge manual con el mismo texto que
  // uno automático (ej: "ÚLTIMAS UNIDADES" a mano + "Últimas unidades" por stock
  // bajo), no lo mostramos dos veces. Normalizamos a minúsculas/sin acentos/espacios
  // colapsados y conservamos el primero (la lista ya viene ordenada por prioridad).
  const normLabel = (s: string): string =>
    s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();
  const seen = new Set<string>();
  const deduped = badges.filter((b) => {
    const key = normLabel(b.label);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { outOfStock, badges: deduped.slice(0, 2), style, position, showIcons };
}
