import type { CartItem } from './types';

/**
 * Clave de línea del carrito. En mayorista, una misma variante puede estar como
 * 'suelto', 'curva' o dentro de distintos packs (precios distintos): por eso la
 * clave incluye el source (y el packId en packs). En retail (source undefined →
 * 'suelto') es idéntico al comportamiento previo.
 */
export function cartLineKey(item: Pick<CartItem, 'variant_id' | 'source' | 'packId'>): string {
  if (item.source === 'pack') return `${item.variant_id}::pack::${item.packId ?? ''}`;
  return `${item.variant_id}::${item.source ?? 'suelto'}`;
}

/** Fila de display del carrito (agrupa las curvas en una sola línea por producto+color). */
export interface CartDisplayRow {
  key: string;
  productId: string;
  name: string;
  image: string | null;
  detail: string;
  source: 'suelto' | 'curva' | 'pack';
  units: number;
  lineTotal: number;
  // lineKeys que componen la fila (para eliminar; una curva agrupa varias variantes).
  removeKeys: string[];
  // qty editable inline (suelto/retail). Las curvas se editan desde el producto.
  editable: boolean;
}

/**
 * Agrupa los items del carrito para mostrarlos. Los 'curva' se agrupan por
 * (producto, color) y los 'pack' por (producto, packId) en una sola fila; el
 * resto queda 1:1.
 */
export function groupCartItems(items: CartItem[]): CartDisplayRow[] {
  const rows: CartDisplayRow[] = [];
  const curveGroups = new Map<string, CartItem[]>();
  const packGroups = new Map<string, CartItem[]>();

  for (const it of items) {
    if (it.source === 'curva') {
      const gk = `${it.product_id}::${it.color ?? ''}`;
      (curveGroups.get(gk) ?? curveGroups.set(gk, []).get(gk)!).push(it);
    } else if (it.source === 'pack') {
      const gk = `${it.product_id}::${it.packId ?? ''}`;
      (packGroups.get(gk) ?? packGroups.set(gk, []).get(gk)!).push(it);
    } else {
      rows.push({
        key: cartLineKey(it),
        productId: it.product_id,
        name: it.name,
        image: it.image_url,
        detail: [it.color, it.size].filter(Boolean).join(' · '),
        source: 'suelto',
        units: it.qty,
        lineTotal: it.unit_price * it.qty,
        removeKeys: [cartLineKey(it)],
        editable: true,
      });
    }
  }

  for (const group of curveGroups.values()) {
    const first = group[0];
    const units = group.reduce((s, i) => s + i.qty, 0);
    const lineTotal = group.reduce((s, i) => s + i.unit_price * i.qty, 0);
    const curves = first.curves ?? 1;
    rows.push({
      key: `curva::${first.product_id}::${first.color ?? ''}`,
      productId: first.product_id,
      name: first.name,
      image: first.image_url,
      detail: `${curves} ${curves === 1 ? 'curva' : 'curvas'}${first.color ? ` × ${first.color}` : ''}`,
      source: 'curva',
      units,
      lineTotal,
      removeKeys: group.map(cartLineKey),
      editable: false,
    });
  }

  for (const group of packGroups.values()) {
    const first = group[0];
    const units = group.reduce((s, i) => s + i.qty, 0);
    const lineTotal = group.reduce((s, i) => s + i.unit_price * i.qty, 0);
    const packs = first.packs ?? 1;
    const label = first.packLabel ?? 'Pack';
    rows.push({
      key: `pack::${first.product_id}::${first.packId ?? ''}`,
      productId: first.product_id,
      name: first.name,
      image: first.image_url,
      detail: packs > 1 ? `${packs} × ${label}` : label,
      source: 'pack',
      units,
      lineTotal,
      removeKeys: group.map(cartLineKey),
      editable: false,
    });
  }

  return rows;
}
