import type { CartItem } from './types';

/**
 * Clave de línea del carrito. En mayorista, una misma variante puede estar como
 * 'suelto', 'curva' o dentro de distintos packs (precios distintos): por eso la
 * clave incluye el source (y el packId en packs). En retail (source undefined →
 * 'suelto') es idéntico al comportamiento previo.
 */
export function cartLineKey(
  item: Pick<CartItem, 'variant_id' | 'source' | 'packId' | 'lineId' | 'product_id' | 'tierGroupId'>,
): string {
  if (item.source === 'pack') return `${item.variant_id}::pack::${item.packId ?? ''}`;
  // Curva surtida: sin variant_id; cada línea es única (lineId) y no se fusiona.
  if (item.source === 'curva_surtida') return `surtida::${item.lineId ?? item.product_id}`;
  // Tier (volume tiers retail): la clave incluye el grupo para no fusionar líneas
  // de distintos escalones; dentro del mismo grupo, misma variante suma qty.
  if (item.source === 'tier') return `tier::${item.tierGroupId ?? item.product_id}::${item.variant_id}`;
  return `${item.variant_id}::${item.source ?? 'suelto'}`;
}

/**
 * Resultado de evaluar el mínimo de compra mayorista contra el estado actual del
 * carrito. `active` indica que hay algún mínimo configurado y aplica (tienda
 * mayorista); `ok` que se cumple el criterio elegido. Los `missing*` son cuánto
 * falta de cada dimensión (0 si esa dimensión ya está OK o no se exige).
 */
export interface MinOrderEval {
  active: boolean;
  ok: boolean;
  mode: 'units' | 'amount' | 'both';
  minUnits: number;
  minAmount: number;
  unitsOk: boolean;
  amountOk: boolean;
  missingUnits: number;
  missingAmount: number;
}

/**
 * Evalúa el mínimo de compra de la tienda mayorista. Solo aplica cuando
 * `isWholesale`; retail nunca tiene mínimo. Según `minOrderMode` se exige el
 * mínimo por unidades, por monto, o ambos a la vez. El `amount` es el subtotal
 * de mercadería del carrito (a precio de lista, sin envío). Pura — sin formato.
 */
export function evalMinOrder(
  cfg: { minOrderQuantity: number; minOrderAmount: number; minOrderMode: 'units' | 'amount' | 'both' },
  isWholesale: boolean,
  units: number,
  amount: number,
): MinOrderEval {
  const mode = cfg.minOrderMode || 'units';
  const minUnits = isWholesale && (mode === 'units' || mode === 'both') ? Math.max(0, cfg.minOrderQuantity || 0) : 0;
  const minAmount = isWholesale && (mode === 'amount' || mode === 'both') ? Math.max(0, cfg.minOrderAmount || 0) : 0;
  const unitsOk = minUnits <= 0 || units >= minUnits;
  const amountOk = minAmount <= 0 || amount >= minAmount;
  return {
    active: minUnits > 0 || minAmount > 0,
    ok: unitsOk && amountOk,
    mode,
    minUnits,
    minAmount,
    unitsOk,
    amountOk,
    missingUnits: unitsOk ? 0 : minUnits - units,
    missingAmount: amountOk ? 0 : minAmount - amount,
  };
}

/** Fila de display del carrito (agrupa las curvas en una sola línea por producto+color). */
export interface CartDisplayRow {
  key: string;
  productId: string;
  name: string;
  image: string | null;
  detail: string;
  source: 'suelto' | 'curva' | 'curva_surtida' | 'pack' | 'tier';
  units: number;
  lineTotal: number;
  // Total a precio de lista (sin el descuento del escalón), para el tachado.
  // Solo lo setean las filas 'tier'; undefined en el resto.
  originalTotal?: number;
  // Total equivalente en efectivo/transferencia (ya con el descuento del escalón).
  // Solo filas 'tier' con precio de efectivo; undefined/null si no aplica.
  cashTotal?: number | null;
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
  const tierGroups = new Map<string, CartItem[]>();

  for (const it of items) {
    if (it.source === 'tier') {
      // Volume tiers: agrupa las N unidades del escalón por tierGroupId.
      const gk = it.tierGroupId ?? cartLineKey(it);
      (tierGroups.get(gk) ?? tierGroups.set(gk, []).get(gk)!).push(it);
    } else if (it.source === 'curva') {
      const gk = `${it.product_id}::${it.color ?? ''}`;
      (curveGroups.get(gk) ?? curveGroups.set(gk, []).get(gk)!).push(it);
    } else if (it.source === 'curva_surtida') {
      // Curva surtida: una fila propia por línea (no agrupa). Los colores se
      // asignan al confirmar, así que la fila no es editable inline.
      const curves = it.curves ?? 1;
      rows.push({
        key: cartLineKey(it),
        productId: it.product_id,
        name: it.name,
        image: it.image_url,
        detail: `${curves} ${curves === 1 ? 'curva surtida' : 'curvas surtidas'} · colores a asignar`,
        source: 'curva_surtida',
        units: it.qty,
        lineTotal: it.unit_price * it.qty,
        removeKeys: [cartLineKey(it)],
        editable: false,
      });
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

  for (const group of tierGroups.values()) {
    const first = group[0];
    const units = group.reduce((s, i) => s + i.qty, 0);
    // Total con tarjeta ya con el descuento del escalón (unit_price = descontado).
    const lineTotal = group.reduce((s, i) => s + i.unit_price * i.qty, 0);
    // Total a precio de lista (unit_price_original), para el tachado. Fallback a
    // unit_price si alguna línea no lo trae (escalón sin descuento).
    const originalTotal = group.reduce((s, i) => s + (i.unit_price_original ?? i.unit_price) * i.qty, 0);
    // Total en efectivo/transferencia (unit_price_cash ya descontado), solo si TODAS
    // las líneas del grupo lo tienen y es más barato que la tarjeta.
    const hasCash = group.every((i) => i.unit_price_cash != null);
    const cashTotalRaw = hasCash ? group.reduce((s, i) => s + (i.unit_price_cash as number) * i.qty, 0) : null;
    const cashTotal = cashTotalRaw != null && cashTotalRaw < lineTotal ? cashTotalRaw : null;
    // Sub-detalle de las variantes elegidas ("M/Negro · L/Rojo ×2 · ...").
    const variantSummary = group
      .map((i) => {
        const v = [i.size, i.color].filter(Boolean).join('/') || 'Variante';
        return i.qty > 1 ? `${v} ×${i.qty}` : v;
      })
      .join(' · ');
    rows.push({
      key: `tier::${first.tierGroupId ?? first.product_id}`,
      productId: first.product_id,
      name: first.name,
      image: first.image_url,
      detail: [first.tierLabel, variantSummary].filter(Boolean).join(' — '),
      source: 'tier',
      units,
      lineTotal,
      originalTotal,
      cashTotal,
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
