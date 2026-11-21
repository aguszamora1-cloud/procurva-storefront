/**
 * Lógica comercial compartida por las plantillas de la vista previa (P1.1).
 *
 * No hay reglas nuevas: todo sale de los mismos helpers que usa Classic
 * (getPriceInfo/listPriceInfo, resolvePricePair, promos, variantes, carrito), así
 * una plantilla nunca muestra un precio distinto del que cobra el checkout.
 * Las plantillas sólo deciden cómo se ve.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { usePromotions } from '@/context/PromotionsContext';
import { useCart } from '@/context/CartContext';
import { useProducts } from '@/hooks/useProducts';
import { useCategories, type CategoryInfo } from '@/hooks/useCategories';
import {
  getPriceInfo,
  installmentsLabel,
  listPriceInfo,
  productCategories,
  productImages,
  resolvePricePair,
  sortSizes,
  toCatalogCards,
  hasStock,
  mainImage,
} from '@/lib/utils';
import { contrastRatio, parseHex } from '@/lib/contrast';
import type { CartItem, Product, Variant } from '@/lib/types';

// ── Precio ────────────────────────────────────────────────────────────────────
export interface TplPrice {
  big: number;
  bigLabel: string;
  small: number | null;
  smallLabel: string;
  /** Precio anterior tachado (promo o precio de lista), sólo si es mayor al grande. */
  strike: number | null;
  offPct: number;
  /** Con precio por talle: el más barato, con "Desde". */
  from: boolean;
  installments: string;
}

type PriceInput = Parameters<typeof listPriceInfo>[0] &
  Pick<Product, 'id' | 'categories'> & { variant_color?: string | null };

/** Mismo cálculo que PriceStack (grilla y ficha). null = "Consultar precio". */
export function useTplPrice(product: PriceInput, opts: { color?: string | null; size?: string | null } = {}): TplPrice | null {
  const config = useStore();
  const { priceFor } = usePromotions();
  const info = opts.size ? { ...getPriceInfo(product, opts.size), fromPrice: false } : listPriceInfo(product);
  if (info.mainPrice <= 0) return null;
  const promo = priceFor(info.mainPrice, product as Product, opts.color);
  const onPromo = Boolean(promo.promo);
  const card = onPromo ? promo.finalPrice : info.mainPrice;
  const cash = info.cashPrice != null ? (onPromo ? priceFor(info.cashPrice, product as Product, opts.color).finalPrice : info.cashPrice) : null;
  const pair = resolvePricePair(config, cash != null && cash < card && info.cashDiscountPct > 0 ? cash : null, card);
  const rawStrike = onPromo ? info.mainPrice : info.comparePrice;
  const strike = rawStrike && rawStrike > pair.big ? rawStrike : null;
  return {
    big: pair.big,
    bigLabel: pair.bigLabel,
    small: pair.small,
    smallLabel: pair.smallLabel,
    strike,
    offPct: strike ? Math.round(((strike - pair.big) / strike) * 100) : 0,
    from: info.fromPrice,
    installments: info.hasCard ? installmentsLabel(config, info.cardPrice) : '',
  };
}

// ── Tarjeta ───────────────────────────────────────────────────────────────────
export function cardHref(p: Product): string {
  return p.variant_color ? `/producto/${p.id}?color=${encodeURIComponent(p.variant_color)}` : `/producto/${p.id}`;
}

/** Segunda foto del producto (para el cambio al pasar el mouse). */
export function secondImage(p: Product): string | null {
  const imgs = productImages(p);
  return imgs[1] ?? null;
}

/** Talles con stock, en orden canónico (lo que la tarjeta puede prometer). */
export function sizesInStock(p: Product): string[] {
  const vs = (p.product_variants ?? []).filter(
    (v) => v.size && (v.stock ?? 0) > 0 && (!p.variant_color || v.color === p.variant_color),
  );
  return sortSizes(Array.from(new Set(vs.map((v) => v.size as string))));
}

export function isSoldOut(p: Product): boolean {
  return (p.product_variants?.length ?? 0) > 0 && !hasStock(p);
}

export function categoryHref(name: string): string {
  return `/categoria/${encodeURIComponent(name)}`;
}

// ── Catálogo ──────────────────────────────────────────────────────────────────
export type SortKey = 'relevancia' | 'nuevos' | 'menor' | 'mayor';
export const SORT_LABELS: Record<SortKey, string> = {
  relevancia: 'Destacados',
  nuevos: 'Más nuevos',
  menor: 'Menor precio',
  mayor: 'Mayor precio',
};

export interface CatalogView {
  products: Product[];
  /** Productos distintos en la vista (las tarjetas por color no suman). */
  count: number;
  all: Product[];
  categories: CategoryInfo[];
  category: string | null;
  query: string;
  sort: SortKey;
  setSort: (s: SortKey) => void;
  sizes: string[];
  size: string | null;
  setSize: (s: string | null) => void;
  isLoading: boolean;
}

export function useCatalog(): CatalogView {
  const { name } = useParams<{ name?: string }>();
  const [params, setParams] = useSearchParams();
  const { products: raw, isLoading } = useProducts();
  const { categories } = useCategories(raw);
  const category = name ? decodeURIComponent(name) : params.get('cat');
  const query = (params.get('q') ?? '').trim();
  const sort = (['nuevos', 'menor', 'mayor'].includes(params.get('orden') ?? '') ? params.get('orden') : 'relevancia') as SortKey;
  const size = params.get('talle');

  const base = useMemo(() => {
    let list = raw;
    if (category) list = list.filter((p) => productCategories(p).includes(category));
    if (query) {
      const q = query.toLocaleLowerCase('es');
      list = list.filter((p) => p.name.toLocaleLowerCase('es').includes(q) || (p.brand ?? '').toLocaleLowerCase('es').includes(q));
    }
    return toCatalogCards(list);
  }, [raw, category, query]);

  // Filtro de talle: dentro de una categoría, o si el catálogo entero tiene pocos
  // talles. Mezclar calzado, ropa y accesorios en una sola lista no ayuda a elegir.
  const sizes = useMemo(() => {
    const all = sortSizes(Array.from(new Set(base.flatMap((p) => sizesInStock(p)))));
    return category || all.length <= 12 ? all : [];
  }, [base, category]);

  const products = useMemo(() => {
    let list = size ? base.filter((p) => sizesInStock(p).includes(size)) : base;
    const price = (p: Product) => listPriceInfo(p).mainPrice;
    if (sort === 'menor') list = [...list].sort((a, b) => price(a) - price(b));
    if (sort === 'mayor') list = [...list].sort((a, b) => price(b) - price(a));
    if (sort === 'nuevos') list = [...list].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    return list;
  }, [base, size, sort]);

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return {
    products,
    count: new Set(products.map((p) => p.id)).size,
    all: raw,
    categories,
    category,
    query,
    sort,
    setSort: (s) => update('orden', s === 'relevancia' ? null : s),
    sizes,
    size,
    setSize: (s) => update('talle', s),
    isLoading,
  };
}

/** Imagen para una categoría: la propia del admin o la del primer producto con foto. */
export function categoryImage(cat: CategoryInfo, products: Product[]): string | null {
  if (cat.imageUrl) return cat.imageUrl;
  const p = products.find((x) => productCategories(x).includes(cat.name) && mainImage(x));
  return p ? mainImage(p) : null;
}

// ── Ficha ─────────────────────────────────────────────────────────────────────
export interface PdpState {
  colors: string[];
  sizes: string[];
  color: string | null;
  size: string | null;
  setColor: (c: string) => void;
  setSize: (s: string) => void;
  colorDisabled: (c: string) => boolean;
  sizeDisabled: (s: string) => boolean;
  variant: Variant | null;
  images: string[];
  soldOut: boolean;
  canAdd: boolean;
  /** Qué falta elegir ('color' | 'talle' | 'ambos'), o null. */
  missing: 'color' | 'talle' | 'ambos' | null;
  lowStock: number | null;
  add: () => void;
}

export function usePdp(product: Product): PdpState {
  const config = useStore();
  const [params] = useSearchParams();
  const { addItem } = useCart();
  const { priceFor, promoForProduct } = usePromotions();
  const variants = product.product_variants ?? [];
  const hide = config.hideOutOfStockVariants && variants.some((v) => (v.stock ?? 0) > 0);

  const allColors = useMemo(() => Array.from(new Set(variants.filter((v) => v.color).map((v) => v.color as string))), [variants]);
  const allSizes = useMemo(() => sortSizes(Array.from(new Set(variants.filter((v) => v.size).map((v) => v.size as string)))), [variants]);
  const colorOut = (c: string) => !variants.some((v) => v.color === c && (v.stock ?? 0) > 0);
  const colors = hide ? allColors.filter((c) => !colorOut(c)) : allColors;

  const initialColor = () => {
    const fromUrl = params.get('color');
    if (fromUrl && allColors.includes(fromUrl)) return fromUrl;
    return colors.length === 1 ? colors[0] : null;
  };
  const [color, setColor] = useState<string | null>(initialColor);
  const [size, setSize] = useState<string | null>(null);
  useEffect(() => {
    setColor(initialColor());
    setSize(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const sizeOut = (s: string) =>
    !variants.some((v) => v.size === s && (allColors.length === 0 || !color || v.color === color) && (v.stock ?? 0) > 0);
  const sizes = hide ? allSizes.filter((s) => !sizeOut(s)) : allSizes;

  // Talle único con stock: queda elegido (mismo criterio que Classic).
  useEffect(() => {
    if (!size && sizes.length === 1 && !sizeOut(sizes[0])) setSize(sizes[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizes.join('|'), color]);

  const variant =
    variants.find((v) => (allColors.length === 0 || v.color === color) && (allSizes.length === 0 || v.size === size)) ?? null;

  const baseImages = productImages(product);
  const colorImages = color
    ? Array.from(new Set(variants.filter((v) => v.color === color && v.image_url).map((v) => v.image_url as string)))
    : [];
  const images = Array.from(new Set([...colorImages, ...baseImages]));

  const { mainPrice, cashPrice } = getPriceInfo(product, size);
  const finalPrice = priceFor(mainPrice, product, color).finalPrice;
  const finalCash = cashPrice != null ? priceFor(cashPrice, product, color).finalPrice : null;
  const soldOut = variants.length > 0 && variants.every((v) => (v.stock ?? 0) <= 0);
  const canAdd = Boolean(variant && (variant.stock ?? 0) > 0 && finalPrice > 0);
  const missing =
    variant || soldOut
      ? null
      : allColors.length > 0 && !color && allSizes.length > 0 && !size
        ? 'ambos'
        : allColors.length > 0 && !color
          ? 'color'
          : 'talle';
  const threshold = config.badges.lowStock.enabled ? config.badges.lowStock.threshold : 0;
  const lowStock = variant && (variant.stock ?? 0) > 0 && (variant.stock ?? 0) <= threshold ? (variant.stock as number) : null;

  const add = () => {
    if (!variant || !canAdd) return;
    const promo = promoForProduct(product, color);
    const item: CartItem = {
      product_id: product.id,
      variant_id: variant.id,
      name: product.name,
      categories: productCategories(product),
      size: variant.size,
      color: variant.color,
      unit_price: finalPrice,
      ...(finalCash != null && finalCash < finalPrice ? { unit_price_cash: finalCash } : {}),
      ...(promo
        ? {
            promo_id: promo.id,
            promo_name: promo.name,
            unit_price_original: mainPrice,
            promo_stackable: promo.stackable_with_coupons !== false,
          }
        : {}),
      qty: 1,
      image_url: variant.image_url ?? images[0] ?? null,
    };
    addItem(item);
  };

  return {
    colors,
    sizes,
    color,
    size,
    setColor: (c) => {
      setColor(c);
      if (size && !variants.some((v) => v.size === size && v.color === c && (v.stock ?? 0) > 0)) setSize(null);
    },
    setSize,
    colorDisabled: colorOut,
    sizeDisabled: sizeOut,
    variant,
    images,
    soldOut,
    canAdd,
    missing,
    lowStock,
    add,
  };
}

/**
 * Promo por cantidad del producto ("Llevá 3 y…"): el mismo texto que muestra
 * Classic. La aplica el carrito común (useCartPromos); acá sólo se anuncia.
 */
export function useQtyPromoMessage(product: Product, color: string | null): string | null {
  const { quantityMessageFor } = usePromotions();
  return quantityMessageFor(product, color) || null;
}

/** Talles con stock para el color elegido: [disponibles, total]. */
export function sizeAvailability(pdp: PdpState): [number, number] {
  return [pdp.sizes.filter((s) => !pdp.sizeDisabled(s)).length, pdp.sizes.length];
}

// ── Navegación y datos de la tienda ───────────────────────────────────────────
export interface StoreLink {
  label: string;
  to: string;
  external?: boolean;
}

/** Páginas y links que el comercio cargó en su menú (sin inventar ninguno). */
export function useMenuLinks(): StoreLink[] {
  const { menuItems } = useStore();
  return menuItems.flatMap((m): StoreLink[] => {
    if (m.kind === 'page') return [{ label: m.label, to: `/pagina/${m.slug}` }];
    if (m.kind === 'link') return [{ label: m.label, to: m.url, external: m.external }];
    return [];
  });
}

/** Redes y contacto reales de la tienda (vacíos se omiten). */
export function useContact() {
  const c = useStore();
  const wa = c.whatsapp ? `https://wa.me/${c.whatsapp.replace(/\D/g, '')}` : '';
  return [
    c.instagramUrl && { label: 'Instagram', href: c.instagramUrl },
    c.tiktokUrl && { label: 'TikTok', href: c.tiktokUrl },
    c.facebookUrl && { label: 'Facebook', href: c.facebookUrl },
    wa && { label: 'WhatsApp', href: wa },
    c.contactEmail && { label: c.contactEmail, href: `mailto:${c.contactEmail}` },
  ].filter(Boolean) as { label: string; href: string }[];
}

/** Políticas que el comercio escribió (envíos, cambios, pagos). */
export function usePolicies() {
  const c = useStore();
  return [
    { key: 'envios', title: 'Envíos', body: c.policyShipping },
    { key: 'cambios', title: 'Cambios y devoluciones', body: c.policyReturns },
    { key: 'pagos', title: 'Medios de pago', body: c.policyPayments },
  ].filter((p) => p.body && p.body.trim());
}

/** Título de una sección del home: el que escribió el comercio, o uno corto por defecto. */
export function useHeading(key: 'featured' | 'new_arrivals' | 'offers', fallback: string): string {
  const { sectionHeadings } = useStore();
  return sectionHeadings[key]?.title?.trim() || fallback;
}

/** Cambio de ruta: vuelve arriba (las plantillas no montan el ScrollToTop de Classic con su gate). */
export function plainText(html: string | null | undefined): string {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent ?? '').trim();
}

// ── Portada ───────────────────────────────────────────────────────────────────
export interface HeroData {
  /** Imagen de portada que cargó el comercio (o null). */
  image: string | null;
  mobile: string | null;
  /**
   * El comercio escribió un título y no eligió "sólo imagen" (mismo criterio que
   * Classic). Sin texto, la imagen suele traer el texto adentro: las plantillas
   * la muestran ENTERA, en su proporción, sin recortarla ni escribirle encima.
   */
  hasText: boolean;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  ctaExternal: boolean;
}

export function useHero(): HeroData {
  const c = useStore();
  const textAllowed = c.heroMode !== 'image_only';
  const image = c.heroEnabled && c.heroImageUrl ? c.heroImageUrl : null;
  return {
    image,
    mobile: image ? c.heroImageMobileUrl || image : null,
    hasText: textAllowed && Boolean(c.heroTitle),
    title: (textAllowed && c.heroTitle) || c.name,
    subtitle: (textAllowed && c.heroSubtitle) || c.tagline || '',
    ctaText: (textAllowed && c.heroCtaText) || '',
    ctaLink: c.heroCtaLink || '/productos',
    ctaExternal: /^https?:\/\//i.test(c.heroCtaLink || ''),
  };
}

/**
 * Botón de compra: agrega si se puede; si falta elegir color o talle, lleva al
 * selector que falta (en celular el botón queda fijo abajo, lejos del selector).
 */
export function buyAction(pdp: PdpState, root: string) {
  return () => {
    if (pdp.canAdd) return pdp.add();
    const target = document.querySelector<HTMLElement>(`${root} fieldset`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target?.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: true });
  };
}

/**
 * Color de marca del comercio si se lee sobre `surface` (contraste ≥ min); si
 * no, el color propio de la plantilla. Así la plantilla toma la marca sin
 * romper la legibilidad.
 */
export function brandOr(brand: string | null | undefined, surface: string, fallback: string, min = 4.5): string {
  const a = parseHex(brand);
  const b = parseHex(surface);
  if (!a || !b) return fallback;
  return contrastRatio(a, b) >= min ? (brand as string) : fallback;
}

/** Mismo texto sin distinguir mayúsculas, acentos ni espacios de más. */
export function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (s: string | null | undefined) =>
    (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
  return n(a) === n(b);
}

/** Color sin tono (negro, blanco o gris): no sirve como acento de una plantilla. */
export function isNeutralColor(hex: string | null | undefined): boolean {
  const rgb = parseHex(hex);
  if (!rgb) return true;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return s < 0.18 || l < 0.1 || l > 0.94;
}

/** Redes de la tienda (para "Seguinos") separadas del contacto directo. */
export function splitContact(list: { label: string; href: string }[]) {
  const social = list.filter((c) => ['Instagram', 'TikTok', 'Facebook'].includes(c.label));
  const direct = list.filter((c) => !social.includes(c));
  return { social, direct };
}
