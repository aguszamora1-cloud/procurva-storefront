import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { SectionHeader } from '@/components/SectionHeader';
import { useOutfits, type OutfitWithProducts } from '@/hooks/useOutfits';
import { useStore } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { formatPrice, getPriceInfo, mainImage, sortSizes } from '@/lib/utils';
import type { Product, Variant } from '@/lib/types';

interface OutfitPricing {
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
function outfitPricing(o: OutfitWithProducts): OutfitPricing {
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
function outfitImages(o: OutfitWithProducts): string[] {
  if (o.image_urls && o.image_urls.length > 0) return o.image_urls.filter(Boolean);
  return o.image_url ? [o.image_url] : [];
}

/**
 * Reparte `total` entre líneas proporcional a `weights`. La última línea con peso
 * > 0 absorbe el diferencial de redondeo para que Σ resultado = total EXACTO.
 */
function prorate(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const arr = sum > 0 ? weights.map((w) => Math.round((total * w) / sum)) : weights.map(() => Math.round(total / n));
  let idx = -1;
  for (let i = n - 1; i >= 0; i--) if (weights[i] > 0) { idx = i; break; }
  if (idx < 0) idx = n - 1;
  arr[idx] += total - arr.reduce((a, b) => a + b, 0);
  return arr;
}

/** Ajusta `arr` para que su suma sea `total`, cargando el diferencial en la última línea con peso > 0. */
function adjustToTotal(arr: number[], total: number, weights: number[]): number[] {
  const out = arr.slice();
  let idx = -1;
  for (let i = out.length - 1; i >= 0; i--) if (weights[i] > 0) { idx = i; break; }
  if (idx < 0) idx = out.length - 1;
  if (out.length) out[idx] += total - out.reduce((a, b) => a + b, 0);
  return out;
}

function OutfitCard({ outfit, onOpen }: { outfit: OutfitWithProducts; onOpen: () => void }) {
  const { products } = outfit;
  const { comboCard, comboCash, hasCombo, cardSum, cashSum, cardSaving, cashSaving } = outfitPricing(outfit);
  const hasDual = comboCash > 0 && comboCash < comboCard;

  // Galería del look: varias fotos → carrusel con puntos; una → estática; ninguna → collage.
  const images = outfitImages(outfit);
  const [imgIdx, setImgIdx] = useState(0);
  const idx = Math.min(imgIdx, Math.max(0, images.length - 1));
  const go = (i: number) => setImgIdx((images.length ? ((i % images.length) + images.length) % images.length : 0));

  return (
    <article className="flex flex-col border border-line bg-[var(--color-background)]">
      <div className="group relative block aspect-[4/5] overflow-hidden bg-secondary">
        <button onClick={onOpen} className="block h-full w-full">
          {images.length > 0 ? (
            <img src={images[idx]} alt={outfit.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="grid h-full w-full grid-cols-2">
              {products.slice(0, 4).map((p) => (
                <img key={p.id} src={mainImage(p) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover" />
              ))}
            </div>
          )}
        </button>
        {hasCombo && cashSaving > 0 && (
          <span className="pointer-events-none absolute left-3 top-3 rounded bg-[#e74c3c] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            Combo
          </span>
        )}
        {/* Carrusel de fotos del look: flechas (desktop, al hover) + puntos */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={(e) => { e.stopPropagation(); go(idx - 1); }}
              className="absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#111] opacity-0 shadow transition-opacity group-hover:opacity-100 md:flex"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Foto siguiente"
              onClick={(e) => { e.stopPropagation(); go(idx + 1); }}
              className="absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#111] opacity-0 shadow transition-opacity group-hover:opacity-100 md:flex"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
              {images.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  aria-label={`Ver foto ${i + 1}`}
                  aria-current={i === idx}
                  onClick={(e) => { e.stopPropagation(); go(i); }}
                  className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-heading text-[15px] font-semibold uppercase tracking-[0.5px] text-text md:text-[17px]">{outfit.name}</h3>
          {outfit.description && <p className="mt-1 text-[13px] text-muted">{outfit.description}</p>}
        </div>
        <div className="flex -space-x-2">
          {products.slice(0, 5).map((p) => (
            <img key={p.id} src={mainImage(p) ?? undefined} alt="" loading="lazy" className="h-9 w-9 rounded-full border-2 border-[var(--color-background)] object-cover" />
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {hasDual ? (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#888]">Tarjeta</span>
                <span className="text-[15px] font-bold text-[#333]">{formatPrice(comboCard)}</span>
                {cardSaving > 0 && <span className="text-[12px] font-medium text-[#999] line-through">{formatPrice(cardSum)}</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#27ae60]">Efectivo</span>
                <span className="text-[15px] font-bold text-[#27ae60]">{formatPrice(comboCash)}</span>
                {cashSaving > 0 && <span className="text-[12px] font-medium text-[#999] line-through">{formatPrice(cashSum)}</span>}
              </div>
            </div>
          ) : (
            <span className="flex items-baseline gap-2">
              <span className="text-[16px] font-semibold text-text">{formatPrice(comboCard)}</span>
              {cardSaving > 0 && <span className="text-[13px] font-medium text-[#999] line-through">{formatPrice(cardSum)}</span>}
            </span>
          )}
          <button
            onClick={onOpen}
            className="text-[12px] font-semibold uppercase text-white"
            style={{ background: '#111', letterSpacing: '2px', padding: '12px 28px', borderRadius: '4px' }}
          >
            Comprar
          </button>
        </div>
      </div>
    </article>
  );
}

/** Resuelve la variante de un producto que mejor matchea color+talle (prioriza stock). */
function resolveVariant(p: Product, color: string | null, size: string | null): Variant | null {
  const vs = p.product_variants ?? [];
  const find = (pred: (v: Variant) => boolean) => vs.find(pred) ?? null;
  return (
    find((v) => v.color === color && v.size === size && (v.stock ?? 0) > 0) ||
    find((v) => v.color === color && v.size === size) ||
    find((v) => v.size === size && (v.stock ?? 0) > 0) ||
    find((v) => v.size === size) ||
    find((v) => v.color === color && (v.stock ?? 0) > 0) ||
    find((v) => v.color === color) ||
    find((v) => (v.stock ?? 0) > 0) ||
    vs[0] ||
    null
  );
}

function OutfitBuyModal({ outfit, onClose }: { outfit: OutfitWithProducts; onClose: () => void }) {
  const config = useStore();
  const { addItem } = useCart();

  // Color fijado por prenda (catalog_outfit_items.variant_color). Si está seteado,
  // el look va con ESE color: se pre-selecciona y se bloquea (el cliente no lo cambia).
  const pinnedColorByProduct = useMemo(() => {
    const m: Record<string, string> = {};
    for (const it of outfit.items) if (it.variant_color) m[it.product_id] = it.variant_color;
    return m;
  }, [outfit.items]);

  // Las variantes (color/talle) no vienen en la carga del outfit; las traemos acá
  // sin tocar la lógica de carga de outfits. `enriched` = productos con variantes.
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, Variant[]>>({});
  const [loadingVariants, setLoadingVariants] = useState(true);

  // Talle y color elegidos POR producto: cada prenda lleva su propia combinación.
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string | null>>({});
  const [selectedColors, setSelectedColors] = useState<Record<string, string | null>>({});
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingVariants(true);
    const productIds = outfit.products.map((p) => p.id);
    if (productIds.length === 0) {
      setVariantsByProduct({});
      setLoadingVariants(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, product_id, company_id, size, color, stock, price, sku, image_url')
        .eq('company_id', config.companyId)
        .in('product_id', productIds);
      if (cancelled) return;
      if (error) console.error('[OutfitBuyModal] error cargando variantes:', error);
      const map: Record<string, Variant[]> = {};
      for (const v of ((data ?? []) as Variant[])) {
        (map[v.product_id] ??= []).push(v);
      }
      setVariantsByProduct(map);
      setLoadingVariants(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [outfit.products, config.companyId]);

  // Productos con sus variantes resueltas (para resolver al agregar al carrito).
  const enriched = useMemo<Product[]>(
    () => outfit.products.map((p) => ({ ...p, product_variants: variantsByProduct[p.id] ?? [] })),
    [outfit.products, variantsByProduct],
  );

  // Talles y colores disponibles POR producto (lista completa; el stock se evalúa aparte).
  const sizesByProduct = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const p of enriched) {
      const set = new Set<string>();
      for (const v of p.product_variants) if (v.size) set.add(v.size);
      map[p.id] = sortSizes(Array.from(set));
    }
    return map;
  }, [enriched]);

  const colorsByProduct = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const p of enriched) {
      const set = new Set<string>();
      for (const v of p.product_variants) if (v.color) set.add(v.color);
      map[p.id] = Array.from(set);
    }
    return map;
  }, [enriched]);

  // Pre-selección de color: color FIJADO del look (gana siempre) o, si la prenda
  // tiene un solo color, ese único. El fijado solo se aplica si sigue existiendo
  // entre las variantes cargadas (si el color se renombró/borró, cae a elección libre).
  useEffect(() => {
    setSelectedColors((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const p of enriched) {
        const cs = colorsByProduct[p.id] ?? [];
        const pinned = pinnedColorByProduct[p.id];
        const pinnedValid = pinned && (cs.length === 0 || cs.includes(pinned));
        if (pinnedValid && next[p.id] !== pinned) {
          next[p.id] = pinned;
          changed = true;
        } else if (!pinned && cs.length === 1 && !next[p.id]) {
          next[p.id] = cs[0];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [colorsByProduct, enriched, pinnedColorByProduct]);

  // Cerrar con Escape y bloquear el scroll de fondo mientras el modal está abierto.
  // En iOS / navegadores embebidos (Instagram, in-app webview) poner solo
  // `overflow: hidden` NO alcanza: el fondo sigue haciendo rubber-band y, como el
  // modal es `position: fixed` centrado, se reposiciona y "pega saltos". El patrón
  // robusto es fijar el body con la posición de scroll congelada y restaurarla al
  // cerrar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    return () => {
      document.removeEventListener('keydown', onKey);
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [onClose]);

  const pricing = outfitPricing(outfit);
  const { comboCard, comboCash, hasCombo, cardSum, cashSum, cardSaving, cashSaving } = pricing;
  const hasDual = comboCash > 0 && comboCash < comboCard;

  // ¿Hay stock para una combinación (talle, color) dentro de un producto?
  const inStock = (p: Product, size: string | null, color: string | null): boolean =>
    p.product_variants.some(
      (v) => (!size || v.size === size) && (!color || v.color === color) && (v.stock ?? 0) > 0,
    );

  // Un talle está deshabilitado si no hay stock para ese talle con el color elegido del producto.
  const sizeDisabled = (p: Product, size: string): boolean => {
    const color = selectedColors[p.id] ?? null;
    return !inStock(p, size, color);
  };

  // La combinación elegida del producto quedó sin stock (talle+color seleccionados pero agotados).
  const comboOutOfStock = (p: Product): boolean => {
    const size = selectedSizes[p.id] ?? null;
    const color = selectedColors[p.id] ?? null;
    const needSize = (sizesByProduct[p.id]?.length ?? 0) > 0;
    const needColor = (colorsByProduct[p.id]?.length ?? 0) > 0;
    if ((needSize && !size) || (needColor && !color)) return false; // todavía falta elegir
    return !inStock(p, size, color);
  };

  // Cada producto tiene elegido lo que necesita (talle si tiene talles, color si tiene colores).
  const allSelected = enriched.every((p) => {
    const needSize = (sizesByProduct[p.id]?.length ?? 0) > 0;
    const needColor = (colorsByProduct[p.id]?.length ?? 0) > 0;
    return (!needSize || selectedSizes[p.id]) && (!needColor || selectedColors[p.id]);
  });

  // Listo para agregar: todo elegido y con stock real.
  const allReady = enriched.every((p) => {
    const size = selectedSizes[p.id] ?? null;
    const color = selectedColors[p.id] ?? null;
    const needSize = (sizesByProduct[p.id]?.length ?? 0) > 0;
    const needColor = (colorsByProduct[p.id]?.length ?? 0) > 0;
    if (needSize && !size) return false;
    if (needColor && !color) return false;
    return inStock(p, size, color);
  });

  const canAdd = allReady && !loadingVariants && !added;

  const handleAdd = () => {
    if (!canAdd) return;

    // Precios sueltos por prenda (en el mismo orden que `enriched`).
    const infos = enriched.map((p) => getPriceInfo(p));
    const cardPrices = infos.map((i) => i.mainPrice);
    const cashPrices = infos.map((i) => i.cashPrice ?? i.mainPrice);

    // Con combo: prorrateamos el combo (efectivo) sobre el precio efectivo de cada
    // prenda → Σ unit_price_cash = combo_price exacto. La tarjeta de cada línea se
    // deriva del efectivo prorrateado con el recargo de esa prenda, y se ajusta la
    // última línea para que Σ unit_price = comboCard exacto. Sin combo: precio suelto.
    let unitCash: number[];
    let unitCard: number[];
    if (hasCombo) {
      unitCash = prorate(comboCash, cashPrices);
      const rawCard = unitCash.map((c, i) => (cashPrices[i] > 0 ? Math.round((c * cardPrices[i]) / cashPrices[i]) : c));
      unitCard = adjustToTotal(rawCard, comboCard, cashPrices);
    } else {
      unitCash = cashPrices;
      unitCard = cardPrices;
    }

    enriched.forEach((p, idx) => {
      const size = selectedSizes[p.id] ?? null;
      const color = selectedColors[p.id] ?? null;
      const v = resolveVariant(p, color, size);
      // Con combo: siempre seteamos unit_price_cash (para que el total de contado dé
      // combo_price). Sin combo: solo si esa prenda tiene descuento por contado.
      const setCash = hasCombo || (infos[idx].cashPrice != null && (infos[idx].cashPrice as number) < cardPrices[idx]);
      addItem({
        product_id: p.id,
        variant_id: v?.id ?? p.id,
        name: p.name,
        size: v?.size ?? size ?? null,
        color: v?.color ?? color ?? null,
        unit_price: unitCard[idx],
        ...(setCash ? { unit_price_cash: unitCash[idx] } : {}),
        // Con combo, el precio suelto de tarjeta queda como "original" para el tachado.
        ...(hasCombo ? { unit_price_original: cardPrices[idx] } : {}),
        outfit_id: outfit.id,
        qty: 1,
        image_url: v?.image_url ?? mainImage(p),
      });
    });
    setAdded(true);
    window.setTimeout(() => onClose(), 1500);
  };

  const actionLabel = added
    ? '✓ Agregado al pedido'
    : allSelected
      ? 'Agregar al pedido'
      : 'Elegí talle y color de cada prenda';
  const actionBg = added ? '#27ae60' : allReady ? '#111' : '#999';

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4"
      // `height: 100dvh` (dvh = viewport visible real) evita que en navegadores
      // embebidos el área de centrado sea más alta que lo visible y empuje el
      // header fuera de pantalla. Si el browser no entiende dvh, cae a `inset-0`.
      style={{ background: 'rgba(0,0,0,0.6)', height: '100dvh' }}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[88vh] w-full flex-col overflow-hidden shadow-2xl"
        // maxHeight en dvh: en Instagram/webview `vh` mide contra el viewport más
        // alto (toolbar oculta) y el modal queda más alto que lo visible, dejando
        // el header (y la cruz) por encima del borde superior. dvh usa el alto
        // visible real; la clase `max-h-[88vh]` queda de fallback si no hay dvh.
        style={{ background: '#fff', borderRadius: '14px', maxWidth: '440px', color: '#111', maxHeight: '88dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header sticky: siempre visible, con la cruz para cerrar */}
        <div
          className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#eee] bg-white"
          style={{ padding: '14px 14px 12px 20px' }}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase text-[#999]" style={{ letterSpacing: '1px' }}>Configurar outfit</p>
            <h2 className="mt-0.5 truncate text-[18px] font-bold leading-tight text-[#111]">{outfit.name}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#666] transition-colors hover:bg-[#f2f2f2] hover:text-[#111]"
            style={{ cursor: 'pointer' }}
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Cuerpo scrolleable: un bloque por prenda (sin la foto grande del look;
            cada prenda ya trae su propia miniatura). */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '0 20px' }}>
          {loadingVariants ? (
            <p className="py-8 text-center text-[13px] text-[#888]">Cargando opciones…</p>
          ) : (
            enriched.map((p) => {
              const sizes = sizesByProduct[p.id] ?? [];
              const colors = colorsByProduct[p.id] ?? [];
              const info = getPriceInfo(p);
              return (
                <div key={p.id} style={{ borderBottom: '1px solid #eee', padding: '14px 0' }}>
                  {/* Fila superior: thumb + nombre + precio */}
                  <div className="flex items-center gap-3">
                    <img
                      src={mainImage(p) ?? undefined}
                      alt={p.name}
                      style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '8px' }}
                      className="shrink-0 bg-[#f3f3f3]"
                    />
                    <p className="flex-1 text-[13px] font-bold uppercase leading-tight text-[#111]">{p.name}</p>
                    <p className="text-[15px] font-bold text-[#111]">{formatPrice(info.mainPrice)}</p>
                  </div>

                  {/* Color fijado del look: no editable */}
                  {colors.length > 0 && pinnedColorByProduct[p.id] && colors.includes(pinnedColorByProduct[p.id]) && (
                    <div className="mt-3">
                      <p className="text-[11px] font-semibold uppercase text-[#888]" style={{ letterSpacing: '1px' }}>Color</p>
                      <p className="mt-1 text-[13px] font-bold uppercase text-[#111]">{pinnedColorByProduct[p.id]}</p>
                    </div>
                  )}

                  {/* Color a elección del cliente */}
                  {colors.length > 0 && !(pinnedColorByProduct[p.id] && colors.includes(pinnedColorByProduct[p.id])) && (
                    <div className="mt-3">
                      <p className="text-[11px] font-semibold uppercase text-[#888]" style={{ letterSpacing: '1px' }}>Color</p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {colors.map((c) => {
                          const selected = selectedColors[p.id] === c;
                          return (
                            <button
                              key={c}
                              onClick={() => setSelectedColors((prev) => ({ ...prev, [p.id]: c }))}
                              className="text-[12px] font-semibold uppercase"
                              style={{
                                padding: '6px 16px',
                                borderRadius: '6px',
                                background: selected ? '#111' : '#fff',
                                color: selected ? '#fff' : '#666',
                                border: `1px solid ${selected ? '#111' : '#ddd'}`,
                                cursor: 'pointer',
                              }}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Talle */}
                  {sizes.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] font-semibold uppercase text-[#888]" style={{ letterSpacing: '1px' }}>Talle</p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {sizes.map((s) => {
                          const selected = selectedSizes[p.id] === s;
                          const disabled = sizeDisabled(p, s);
                          return (
                            <button
                              key={s}
                              onClick={() => !disabled && setSelectedSizes((prev) => ({ ...prev, [p.id]: s }))}
                              disabled={disabled}
                              className="text-[13px] font-semibold"
                              style={{
                                minWidth: '44px',
                                height: '38px',
                                borderRadius: '6px',
                                background: selected && !disabled ? '#111' : '#fff',
                                color: disabled ? '#ccc' : selected ? '#fff' : '#666',
                                border: `1px solid ${disabled ? '#eee' : selected ? '#111' : '#ddd'}`,
                                textDecoration: disabled ? 'line-through' : 'none',
                                cursor: disabled ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {comboOutOfStock(p) && (
                    <p className="mt-2 text-[12px] font-semibold" style={{ color: '#e74c3c' }}>SIN STOCK en esa variante</p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer sticky: totales + acción */}
        <div style={{ borderTop: '1px solid #eee', padding: '14px 20px 18px' }}>
          {hasCombo && cashSaving > 0 && (
            <div className="mb-2 flex items-center justify-between text-[12px] font-semibold" style={{ color: '#27ae60' }}>
              <span className="uppercase">Precio combo — ahorrás</span>
              <span>{formatPrice(cashSaving)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-[#888]">Total tarjeta</span>
            <span className="flex items-baseline gap-2">
              {cardSaving > 0 && <span className="text-[13px] font-medium text-[#999] line-through">{formatPrice(cardSum)}</span>}
              <span className="text-[18px] font-bold text-[#111]">{formatPrice(comboCard)}</span>
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase" style={{ color: '#27ae60' }}>Total efectivo / transferencia</span>
            <span className="flex items-baseline gap-2">
              {cashSaving > 0 && <span className="text-[13px] font-medium text-[#999] line-through">{formatPrice(cashSum)}</span>}
              <span className="text-[18px] font-bold" style={{ color: '#27ae60' }}>{formatPrice(hasDual ? comboCash : comboCard)}</span>
            </span>
          </div>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="mt-3 w-full text-[13px] font-bold uppercase transition-colors"
            style={{
              background: actionBg,
              color: '#fff',
              letterSpacing: '1.5px',
              padding: '14px',
              borderRadius: '8px',
              cursor: canAdd ? 'pointer' : 'not-allowed',
            }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Sección de outfits / looks (Extra PRO). */
export function OutfitsSection() {
  const { outfits } = useOutfits();
  const [openId, setOpenId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Índice de la card más centrada — para resaltar el dot activo en mobile.
  const [activeIndex, setActiveIndex] = useState(0);

  // Mostramos solo los outfits que tienen al menos un producto resoluble.
  const visible = useMemo(() => outfits.filter((o) => o.products.length > 0), [outfits]);
  const visibleCount = visible.length;

  // Auto-scroll SOLO en mobile: el carrusel avanza solo cada ~3.5s y vuelve al
  // inicio al llegar al final. Se pausa al interactuar (touch/swipe) y reanuda
  // tras unos segundos; no corre con el modal abierto ni con reduce-motion.
  // Debe declararse ANTES de cualquier return condicional (Rules of Hooks).
  useEffect(() => {
    if (visibleCount <= 1 || openId) return;
    const el = scrollerRef.current;
    if (!el) return;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isMobile || reduce) return;

    // Paso de scroll (ancho de una card + gap), medido del primer hijo.
    const stepWidth = (): number => {
      const first = el.firstElementChild as HTMLElement | null;
      if (!first) return el.clientWidth;
      const styles = window.getComputedStyle(el);
      const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
      return first.offsetWidth + gap;
    };

    let paused = false;
    let resumeTimer: number | undefined;
    const pause = () => {
      paused = true;
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => { paused = false; }, 6000);
    };
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('pointerdown', pause, { passive: true });

    const id = window.setInterval(() => {
      if (paused) return;
      const step = stepWidth();
      const cur = Math.round(el.scrollLeft / step);
      const next = cur >= visibleCount - 1 ? 0 : cur + 1;
      el.scrollTo({ left: next * step, behavior: 'smooth' });
    }, 2000);

    return () => {
      window.clearInterval(id);
      window.clearTimeout(resumeTimer);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('pointerdown', pause);
    };
  }, [visibleCount, openId]);

  if (visible.length === 0) return null;

  const open = visible.find((o) => o.id === openId) ?? null;
  // Con 3 o menos entran en pantalla (desktop): se centran y no hace falta navegar.
  const hasArrows = visible.length > 3;
  // Hay más de uno: en mobile el carrusel es swipeable y mostramos dots.
  const isCarousel = visible.length > 1;

  // Paso de scroll (ancho de una card + gap), medido del primer hijo.
  const stepWidth = (el: HTMLDivElement): number => {
    const first = el.firstElementChild as HTMLElement | null;
    if (!first) return el.clientWidth;
    const styles = window.getComputedStyle(el);
    const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
    return first.offsetWidth + gap;
  };

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / stepWidth(el));
    setActiveIndex(Math.max(0, Math.min(visible.length - 1, idx)));
  };

  const scrollToIndex = (i: number) => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ left: i * stepWidth(el), behavior: 'smooth' });
  };

  const scrollByDir = (dir: number) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section id="outfits" className="mx-auto w-full scroll-mt-24 px-6 py-8 md:py-16">
      <SectionHeader label="Combiná tu look" title="Outfits" />
      <div className="relative">
        {/* Carrusel horizontal swipeable: 85vw en mobile (con peek + snap), 2 en tablet, 3 en desktop.
            touchAction 'pan-x pan-y': el navegador enruta el gesto por su dirección
            (horizontal → swipe del carrusel; vertical → scroll de la página). Con
            solo 'pan-x' el vertical quedaba bloqueado al tocar una foto. */}
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          style={{ touchAction: 'pan-x pan-y' }}
          className={`flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            hasArrows ? '' : 'md:justify-center'
          }`}
        >
          {visible.map((o) => (
            <div
              key={o.id}
              className="shrink-0 snap-center sm:snap-start basis-[85vw] sm:basis-[calc((100%-1.25rem)/2)] lg:basis-[calc((100%-2.5rem)/3)]"
            >
              <OutfitCard outfit={o} onOpen={() => setOpenId(o.id)} />
            </div>
          ))}
        </div>

        {/* Flechas — sólo si hay más de 3 (scrolleable) y en desktop (en mobile: dots + swipe). */}
        {hasArrows && (
          <>
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => scrollByDir(-1)}
              className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-background text-on-surface shadow-card-hover transition-colors hover:text-accent md:flex"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Siguiente"
              onClick={() => scrollByDir(1)}
              className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-background text-on-surface shadow-card-hover transition-colors hover:text-accent md:flex"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Indicadores de paginación (dots) — sólo mobile, para señalar que hay más outfits. */}
      {isCarousel && (
        <div className="mt-5 flex justify-center gap-2 md:hidden">
          {visible.map((o, i) => (
            <button
              key={o.id}
              type="button"
              aria-label={`Ir al outfit ${i + 1}`}
              aria-current={i === activeIndex}
              onClick={() => scrollToIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === activeIndex ? 'w-5 bg-text' : 'w-2 bg-line'
              }`}
            />
          ))}
        </div>
      )}
      {open && <OutfitBuyModal outfit={open} onClose={() => setOpenId(null)} />}
    </section>
  );
}
