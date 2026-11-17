import type { StoreMenuItem } from '@/lib/types';
import type { HeaderNav } from './useHeaderNav';

type TrackingItem = Extract<StoreMenuItem, { kind: 'tracking' }>;

/**
 * Entrada de la navegación horizontal de escritorio. Sale de los MISMOS datos
 * que el menú lateral (useHeaderNav), en el mismo orden, sin consultas nuevas.
 * INICIO no va: en una barra con el logo a la izquierda, el logo ya lleva al inicio.
 */
export type NavEntry =
  | { key: string; kind: 'route'; label: string; to: string; end: boolean }
  | { key: 'categorias'; kind: 'categories'; label: string; categories: string[] }
  | { key: 'promociones'; kind: 'promos'; label: string; promos: { id: string; name: string; to: string }[] }
  | { key: 'outfits'; kind: 'outfits'; label: string }
  | { key: string; kind: 'external'; label: string; url: string; newTab: boolean }
  | { key: string; kind: 'tracking'; label: string; item: TrackingItem };

/**
 * Navegación principal (las entradas fijas: productos, categorías, promociones,
 * outfits). El resto (páginas, links y seguimiento del comercio) es secundario
 * y va siempre después: desktopNavEntries las ordena así.
 */
export const PRIMARY_NAV_KEYS: readonly string[] = ['productos', 'categorias', 'promociones', 'outfits'];
export const isPrimaryEntry = (e: NavEntry): boolean => PRIMARY_NAV_KEYS.includes(e.key);

/** Las entradas que se despliegan (abren un panel) en vez de navegar. */
export const isDisclosure = (e: NavEntry): boolean =>
  e.kind === 'categories' || e.kind === 'promos' || e.kind === 'tracking';

export function desktopNavEntries(
  nav: Pick<HeaderNav, 'categories' | 'menuPromos' | 'showOutfitsLink' | 'menuItems'>,
  promoTo: (p: { id: string; name: string }) => string,
): NavEntry[] {
  const out: NavEntry[] = [{ key: 'productos', kind: 'route', label: 'Productos', to: '/productos', end: false }];

  // Sin categorías no hay nada que desplegar: es el link al índice, como en el menú lateral.
  out.push(
    nav.categories.length > 0
      ? { key: 'categorias', kind: 'categories', label: 'Categorías', categories: nav.categories }
      : { key: 'categorias', kind: 'route', label: 'Categorías', to: '/categorias', end: false },
  );

  if (nav.menuPromos.length > 0) {
    out.push({
      key: 'promociones',
      kind: 'promos',
      label: 'Promociones',
      promos: nav.menuPromos.map((p) => ({ id: p.id, name: p.name, to: promoTo(p) })),
    });
  }

  if (nav.showOutfitsLink) out.push({ key: 'outfits', kind: 'outfits', label: 'Outfits' });

  // Ítems del comercio, en su orden (van después de los fijos, como en el menú lateral).
  for (const item of nav.menuItems) {
    const key = `item:${item.id}`;
    if (item.kind === 'tracking') out.push({ key, kind: 'tracking', label: item.label, item });
    else if (item.kind === 'page') out.push({ key, kind: 'route', label: item.label, to: `/pagina/${item.slug}`, end: false });
    else if (item.external) out.push({ key, kind: 'external', label: item.label, url: item.url, newTab: item.newTab });
    else out.push({ key, kind: 'route', label: item.label, to: item.url, end: false });
  }
  return out;
}
