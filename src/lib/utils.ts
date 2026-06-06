import type { Product, ProductImage } from './types';

/** Formatea un precio en pesos argentinos. */
export function formatPrice(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Orden canónico de talles; lo no listado va alfabético al final. */
const SIZE_ORDER = ['Único', 'UNICO', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a);
    const ib = SIZE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, 'es');
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/** Normaliza `products.images` (string | {url}) a un array de URLs. */
export function productImages(product: Pick<Product, 'images' | 'image_url'>): string[] {
  const fromArray = (product.images ?? [])
    .map((img: ProductImage) => (typeof img === 'string' ? img : img?.url))
    .filter((u): u is string => Boolean(u));
  if (fromArray.length > 0) return fromArray;
  return product.image_url ? [product.image_url] : [];
}

/** Imagen principal de un producto (para cards). */
export function mainImage(product: Pick<Product, 'images' | 'image_url'>): string | null {
  return productImages(product)[0] ?? product.image_url ?? null;
}

/** Precio de venta minorista (efectivo/base). */
export function retailPrice(product: Pick<Product, 'retail_price'>): number {
  return Number(product.retail_price ?? 0);
}

export interface PriceInfo {
  /** Precio principal (grande, bold). = tarjeta; o transferencia/base si no hay tarjeta. Va al carrito. */
  mainPrice: number;
  /** Precio de tarjeta real (para calcular cuotas). 0 si no hay. */
  cardPrice: number;
  /** Precio efectivo/transferencia, si hay tarjeta y difiere (más barato). null si no aplica. */
  cashPrice: number | null;
  /** % de descuento de efectivo/transferencia vs tarjeta. */
  cashDiscountPct: number;
  /** Precio de lista anterior (compare_at_price), tachado. null si no aplica (>0 y > principal). */
  comparePrice: number | null;
  /** % de descuento del precio de lista (compare_at) vs principal. */
  compareDiscountPct: number;
  /** Hay un precio de tarjeta real cargado (no es el fallback a transferencia/base). */
  hasCard: boolean;
}

/**
 * Jerarquía de precios leída de los campos reales de ProCurva:
 *   retail_price_card     = precio con tarjeta (el principal; 0/null si no se cargó)
 *   retail_price_transfer = precio efectivo/transferencia (más barato)
 *   retail_price          = precio base (fallback cuando no hay transfer)
 *   compare_at_price      = precio de lista / anterior (tachado en oferta; opcional)
 *
 * Reglas:
 *  - Principal (grande, bold) = retail_price_card. Si no hay tarjeta, retail_price_transfer
 *    (o retail_price como último fallback). Las cuotas se calculan sobre el de tarjeta.
 *  - Tachado = compare_at_price, SOLO si existe, es > 0 y es mayor al precio principal.
 *    Si no existe el campo o es 0/null → sin tachado.
 *  - Línea "$X efectivo/transferencia" + badge "% OFF" = retail_price_transfer, SOLO si
 *    hay tarjeta (retail_price_card > 0) y el de transferencia difiere (es más barato).
 */
export function getPriceInfo(
  product: Pick<Product, 'retail_price' | 'retail_price_card' | 'retail_price_transfer' | 'compare_at_price'>,
): PriceInfo {
  const base = Number(product.retail_price ?? 0);
  const cardRaw = Number(product.retail_price_card ?? 0);
  const transferRaw = Number(product.retail_price_transfer ?? 0);
  const compareRaw = Number(product.compare_at_price ?? 0);

  const hasCard = cardRaw > 0;
  // Principal = tarjeta; si no hay tarjeta, transferencia; si no, base.
  const mainPrice = hasCard ? cardRaw : transferRaw > 0 ? transferRaw : base;
  const cardPrice = hasCard ? cardRaw : 0;

  // Línea efectivo/transferencia: sólo si hay tarjeta y el de transferencia es más barato.
  const cashPrice = hasCard && transferRaw > 0 && transferRaw < cardRaw ? transferRaw : null;
  const cashDiscountPct = cashPrice ? Math.round(((cardRaw - cashPrice) / cardRaw) * 100) : 0;

  // Tachado: precio de lista anterior, sólo si es mayor al principal.
  const comparePrice = compareRaw > 0 && compareRaw > mainPrice ? compareRaw : null;
  const compareDiscountPct = comparePrice ? Math.round(((comparePrice - mainPrice) / comparePrice) * 100) : 0;

  return { mainPrice, cardPrice, cashPrice, cashDiscountPct, comparePrice, compareDiscountPct, hasCard };
}

/** Talles y colores disponibles (con stock) de un producto. */
export function availableSizes(product: Product): string[] {
  const sizes = product.product_variants
    .filter((v) => (v.stock ?? 0) > 0 && v.size)
    .map((v) => v.size as string);
  return sortSizes(Array.from(new Set(sizes)));
}

export function availableColors(product: Product): string[] {
  const colors = product.product_variants
    .filter((v) => (v.stock ?? 0) > 0 && v.color)
    .map((v) => v.color as string);
  return Array.from(new Set(colors));
}

export function hasStock(product: Product): boolean {
  return product.product_variants.some((v) => (v.stock ?? 0) > 0);
}

/** Stock total de un producto. */
export function totalStock(product: Product): number {
  return product.product_variants.reduce((sum, v) => sum + Math.max(0, v.stock ?? 0), 0);
}

/** Categorías de un producto, defensivo ante datos viejos. */
export function productCategories(product: Pick<Product, 'categories'>): string[] {
  if (Array.isArray(product.categories)) return product.categories.filter(Boolean);
  return [];
}

/** Mapa de nombres de color (es) → hex para los swatches. Fallback gris. */
const COLOR_HEX: Record<string, string> = {
  negro: '#111111',
  blanco: '#ffffff',
  gris: '#9ca3af',
  'gris claro': '#d1d5db',
  'gris oscuro': '#4b5563',
  rojo: '#dc2626',
  bordo: '#7f1d1d',
  azul: '#2563eb',
  'azul marino': '#1e3a8a',
  marino: '#1e3a8a',
  celeste: '#38bdf8',
  verde: '#16a34a',
  'verde militar': '#4d5d3a',
  amarillo: '#facc15',
  naranja: '#f97316',
  rosa: '#f472b6',
  fucsia: '#db2777',
  violeta: '#7c3aed',
  morado: '#7c3aed',
  marron: '#92400e',
  marrón: '#92400e',
  beige: '#e7d8b8',
  crema: '#f5efe0',
  camel: '#c19a6b',
  nude: '#e8c5a8',
  dorado: '#d4af37',
  plateado: '#c0c0c0',
};

export function colorToHex(color: string | null | undefined): string {
  if (!color) return '#9ca3af';
  const key = color.trim().toLowerCase();
  return COLOR_HEX[key] ?? '#9ca3af';
}

/** Color del badge de catálogo → hex. Tonos vibrantes para que resalten. */
const BADGE_HEX: Record<string, string> = {
  red: '#EF4444',
  green: '#10B981',
  amber: '#F59E0B',
  blue: '#2563EB',
  black: '#111111',
};

// Default verde vibrante: el badge más común es "NUEVO".
export function badgeColor(name: string | null | undefined): string {
  return BADGE_HEX[(name ?? 'green').toLowerCase()] ?? '#10B981';
}

/**
 * Columnas de la grilla de categorías según la cantidad, para que pocas
 * categorías ocupen el ancho y no queden pegadas a la izquierda. Clases
 * literales (Tailwind las detecta en build).
 */
export function categoryGridCols(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-2 md:grid-cols-3';
  return 'grid-cols-2 md:grid-cols-4';
}

/** Construye el link de WhatsApp con mensaje prellenado. */
export function whatsappLink(phone: string, message: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
