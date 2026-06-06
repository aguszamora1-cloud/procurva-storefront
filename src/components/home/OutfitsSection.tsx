import { useEffect, useMemo, useState } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import { useOutfits, type OutfitWithProducts } from '@/hooks/useOutfits';
import { useStore } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { colorToHex, formatPrice, getPriceInfo, mainImage, sortSizes } from '@/lib/utils';
import type { Product, Variant } from '@/lib/types';

/**
 * Precios del outfit (suma de los productos):
 *  - card  = precio con tarjeta (precio principal de cada producto)
 *  - cash  = precio efectivo/transferencia (si difiere; si no, igual a tarjeta)
 * Si ambos coinciden, no hay descuento de efectivo y se muestra un solo precio.
 */
function outfitPricing(o: OutfitWithProducts): { card: number; cash: number } {
  let card = 0;
  let cash = 0;
  for (const p of o.products) {
    const info = getPriceInfo(p);
    card += info.mainPrice; // principal = tarjeta (o transferencia/base si no hay tarjeta)
    cash += info.cashPrice ?? info.mainPrice; // efectivo si es más barato; si no, el principal
  }
  return { card, cash };
}

function OutfitCard({ outfit, onOpen }: { outfit: OutfitWithProducts; onOpen: () => void }) {
  const { products } = outfit;
  const { card, cash } = outfitPricing(outfit);
  const hasDual = cash > 0 && cash < card;

  return (
    <article className="flex flex-col border border-line bg-[var(--color-background)]">
      <button onClick={onOpen} className="group relative block aspect-[3/4] overflow-hidden bg-secondary">
        {outfit.image_url ? (
          <img src={outfit.image_url} alt={outfit.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="grid h-full w-full grid-cols-2">
            {products.slice(0, 4).map((p) => (
              <img key={p.id} src={mainImage(p) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover" />
            ))}
          </div>
        )}
      </button>
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
                <span className="text-[15px] font-bold text-[#333]">{formatPrice(card)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#27ae60]">Efectivo</span>
                <span className="text-[15px] font-bold text-[#27ae60]">{formatPrice(cash)}</span>
              </div>
            </div>
          ) : (
            <span className="text-[16px] font-semibold text-text">{formatPrice(card)}</span>
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

  // Las variantes (color/talle) no vienen en la carga del outfit; las traemos acá
  // sin tocar la lógica de carga de outfits. `enriched` = productos con variantes.
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, Variant[]>>({});
  const [loadingVariants, setLoadingVariants] = useState(true);

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  // Talle elegido POR producto: cada prenda del outfit puede llevar un talle distinto.
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string | null>>({});
  const [qty, setQty] = useState(1);
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

  const colors = useMemo(() => {
    const set = new Set<string>();
    for (const p of enriched) for (const v of p.product_variants) if (v.color) set.add(v.color);
    return Array.from(set);
  }, [enriched]);

  // Talles disponibles POR producto, filtrados por el color seleccionado.
  const sizesByProduct = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const p of enriched) {
      const set = new Set<string>();
      for (const v of p.product_variants) {
        if (!v.size) continue;
        const colorOk = !selectedColor || !v.color || v.color === selectedColor;
        if (colorOk) set.add(v.size);
      }
      map[p.id] = sortSizes(Array.from(set));
    }
    return map;
  }, [enriched, selectedColor]);

  // Color por defecto: el primero disponible.
  useEffect(() => {
    if (selectedColor === null && colors.length > 0) setSelectedColor(colors[0]);
  }, [colors, selectedColor]);

  const { card, cash } = outfitPricing(outfit);
  const hasDual = cash > 0 && cash < card;
  const cashOffPct = hasDual ? Math.round((1 - cash / card) * 100) : 0;
  const installments = config.installmentsCount || 3;

  // Cada producto que tenga talles debe tener uno elegido para poder agregar.
  const anyNeedsSize = enriched.some((p) => (sizesByProduct[p.id]?.length ?? 0) > 0);
  const allSizesChosen = enriched.every(
    (p) => (sizesByProduct[p.id]?.length ?? 0) === 0 || Boolean(selectedSizes[p.id]),
  );
  const canAdd = allSizesChosen;

  const handleAdd = () => {
    if (!canAdd) return;
    for (const p of enriched) {
      const size = selectedSizes[p.id] ?? null;
      const v = resolveVariant(p, selectedColor, size);
      const info = getPriceInfo(p);
      addItem({
        product_id: p.id,
        variant_id: v?.id ?? p.id,
        name: p.name,
        size: v?.size ?? size ?? null,
        color: v?.color ?? selectedColor ?? null,
        unit_price: info.mainPrice,
        qty,
        image_url: v?.image_url ?? mainImage(p),
      });
    }
    setAdded(true);
    window.setTimeout(() => onClose(), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-y-auto text-white"
        style={{ background: '#1a1a1a', borderRadius: '12px', maxWidth: '440px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5">
          <div>
            <h2 className="text-[20px] font-bold uppercase" style={{ letterSpacing: '2px' }}>{outfit.name}</h2>
            {outfit.description && <p className="mt-1 text-[13px] text-[#999]">{outfit.description}</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="-mr-1 text-[26px] leading-none text-[#999] hover:text-white">
            &times;
          </button>
        </div>

        {/* Precios */}
        <div className="grid grid-cols-2 gap-3 px-5">
          <div style={{ background: '#222', borderRadius: '8px', padding: '14px 16px' }}>
            <p className="text-[11px] text-[#999]">💳 Tarjeta</p>
            <p className="mt-1 text-[22px] font-bold text-white">{formatPrice(card)}</p>
            <p className="mt-0.5 text-[11px] text-[#999]">Hasta {installments} cuotas sin interés</p>
          </div>
          <div style={{ background: '#222', borderRadius: '8px', padding: '14px 16px' }}>
            <p className="text-[11px] text-[#999]">💵 Efectivo / Transferencia</p>
            <p className="mt-1 text-[22px] font-bold" style={{ color: '#2ecc71' }}>{formatPrice(hasDual ? cash : card)}</p>
            {hasDual && <p className="mt-0.5 text-[11px]" style={{ color: '#2ecc71' }}>{cashOffPct}% OFF</p>}
          </div>
        </div>

        {/* Selector de color */}
        {colors.length > 0 && (
          <div className="px-5 pt-5">
            <p className="text-[12px] uppercase text-[#999]" style={{ letterSpacing: '1px' }}>Color</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {colors.map((c) => {
                const selected = c === selectedColor;
                return (
                  <button
                    key={c}
                    onClick={() => {
                      setSelectedColor(c);
                      setSelectedSizes({});
                    }}
                    className="flex items-center gap-2"
                    style={{
                      background: '#2a2a2a',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      border: selected ? '2px solid #fff' : '2px solid transparent',
                    }}
                  >
                    <span style={{ width: '16px', height: '16px', borderRadius: '9999px', background: colorToHex(c), border: '1px solid rgba(255,255,255,0.25)' }} />
                    <span className="text-[12px] text-white">{c}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selector de talle — un bloque por cada producto del outfit */}
        {anyNeedsSize && (
          <div className="px-5 pt-5">
            <p className="text-[12px] uppercase text-[#999]" style={{ letterSpacing: '1px' }}>Talle</p>
            <div className="mt-3 flex flex-col gap-4">
              {enriched.map((p) => {
                const productSizes = sizesByProduct[p.id] ?? [];
                if (productSizes.length === 0) return null;
                return (
                  <div key={p.id}>
                    <p className="text-[14px] font-bold text-white">{p.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {productSizes.map((s) => {
                        const selected = selectedSizes[p.id] === s;
                        return (
                          <button
                            key={s}
                            onClick={() => setSelectedSizes((prev) => ({ ...prev, [p.id]: s }))}
                            className="text-[13px] font-semibold"
                            style={{
                              minWidth: '48px',
                              height: '42px',
                              borderRadius: '6px',
                              background: selected ? '#fff' : 'transparent',
                              color: selected ? '#000' : '#ccc',
                              border: `1px solid ${selected ? '#fff' : '#555'}`,
                            }}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {!allSizesChosen && (
              <p className="mt-3 text-[12px]" style={{ color: '#e74c3c' }}>Seleccioná un talle para cada prenda</p>
            )}
          </div>
        )}

        {/* Selector de cantidad */}
        <div className="px-5 pt-5">
          <p className="text-[12px] uppercase text-[#999]" style={{ letterSpacing: '1px' }}>Cantidad</p>
          <div className="mt-2 inline-flex items-center gap-3" style={{ background: '#2a2a2a', borderRadius: '8px', padding: '6px 10px' }}>
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-8 w-8 items-center justify-center text-[18px] font-bold text-white disabled:opacity-30" disabled={qty <= 1} aria-label="Quitar uno">−</button>
            <span className="w-6 text-center text-[15px] font-semibold text-white">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className="flex h-8 w-8 items-center justify-center text-[18px] font-bold text-white" aria-label="Agregar uno">+</button>
          </div>
        </div>

        {/* Botón de acción */}
        <div className="p-5 pt-6">
          <button
            onClick={handleAdd}
            disabled={!canAdd || loadingVariants}
            className="w-full text-[14px] font-bold uppercase transition-colors"
            style={{
              background: added ? '#27ae60' : '#fff',
              color: added ? '#fff' : '#000',
              letterSpacing: '2px',
              padding: '16px',
              borderRadius: '8px',
              opacity: !canAdd || loadingVariants ? 0.4 : 1,
              cursor: !canAdd || loadingVariants ? 'not-allowed' : 'pointer',
            }}
          >
            {added ? '✓ Agregado al pedido' : 'Agregar al pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Sección de outfits / looks (Extra PRO). */
export function OutfitsSection() {
  const { outfits } = useOutfits();
  const [openId, setOpenId] = useState<string | null>(null);

  // Mostramos solo los outfits que tienen al menos un producto resoluble.
  const visible = useMemo(() => outfits.filter((o) => o.products.length > 0), [outfits]);
  if (visible.length === 0) return null;

  const open = visible.find((o) => o.id === openId) ?? null;

  return (
    <section className="mx-auto w-full px-6 py-16 md:py-24">
      <SectionHeader label="Combiná tu look" title="Outfits" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {visible.map((o) => (
          <OutfitCard key={o.id} outfit={o} onOpen={() => setOpenId(o.id)} />
        ))}
      </div>
      {open && <OutfitBuyModal outfit={open} onClose={() => setOpenId(null)} />}
    </section>
  );
}
