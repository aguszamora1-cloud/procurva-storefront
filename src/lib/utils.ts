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

/** Precio de venta minorista efectivo. */
export function retailPrice(product: Pick<Product, 'retail_price'>): number {
  return Number(product.retail_price ?? 0);
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

/** Color del badge de catálogo → hex. */
const BADGE_HEX: Record<string, string> = {
  red: '#dc2626',
  green: '#16a34a',
  amber: '#f59e0b',
  blue: '#2563eb',
  black: '#111111',
};

export function badgeColor(name: string | null | undefined): string {
  return BADGE_HEX[(name ?? 'black').toLowerCase()] ?? '#111111';
}

/** Construye el link de WhatsApp con mensaje prellenado. */
export function whatsappLink(phone: string, message: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
