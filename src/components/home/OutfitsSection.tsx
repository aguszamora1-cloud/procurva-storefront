import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SectionHeader } from '@/components/SectionHeader';
import { useOutfits, type OutfitWithProducts } from '@/hooks/useOutfits';
import { useStore } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { formatPrice, getPriceInfo, mainImage, sortSizes } from '@/lib/utils';
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
      <button onClick={onOpen} className="group relative block aspect-[4/5] overflow-hidden bg-secondary">
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

  // Si una prenda tiene un solo color, lo pre-seleccionamos automáticamente.
  useEffect(() => {
    setSelectedColors((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const p of enriched) {
        const cs = colorsByProduct[p.id] ?? [];
        if (cs.length === 1 && !next[p.id]) {
          next[p.id] = cs[0];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [colorsByProduct, enriched]);

  const { card, cash } = outfitPricing(outfit);
  const hasDual = cash > 0 && cash < card;

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
    for (const p of enriched) {
      const size = selectedSizes[p.id] ?? null;
      const color = selectedColors[p.id] ?? null;
      const v = resolveVariant(p, color, size);
      const info = getPriceInfo(p);
      addItem({
        product_id: p.id,
        variant_id: v?.id ?? p.id,
        name: p.name,
        size: v?.size ?? size ?? null,
        color: v?.color ?? color ?? null,
        unit_price: info.mainPrice,
        // Precio de contado (efectivo/transferencia) si hay descuento, para que el
        // checkout ajuste el total según el método de pago.
        ...(info.cashPrice && info.cashPrice < info.mainPrice ? { unit_price_cash: info.cashPrice } : {}),
        qty: 1,
        image_url: v?.image_url ?? mainImage(p),
      });
    }
    setAdded(true);
    window.setTimeout(() => onClose(), 1500);
  };

  const actionLabel = added
    ? '✓ Agregado al pedido'
    : allSelected
      ? 'Agregar al pedido'
      : 'Elegí talle y color de cada prenda';
  const actionBg = added ? '#27ae60' : allReady ? '#111' : '#999';

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden"
        style={{ background: '#fff', borderRadius: '12px', maxWidth: '520px', color: '#111' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3" style={{ padding: '24px 28px 16px' }}>
          <div>
            <p className="text-[11px] font-semibold uppercase text-[#888]" style={{ letterSpacing: '1px' }}>Configurar outfit</p>
            <h2 className="mt-0.5 text-[22px] font-bold text-[#111]">{outfit.name}</h2>
          </div>
          <button onClick={onClose} className="text-[12px] font-semibold uppercase text-[#888] hover:text-[#111]" style={{ cursor: 'pointer' }}>
            Cerrar
          </button>
        </div>

        {/* Cuerpo scrolleable: un bloque por producto */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '0 28px' }}>
          {loadingVariants ? (
            <p className="py-8 text-center text-[13px] text-[#888]">Cargando opciones…</p>
          ) : (
            enriched.map((p) => {
              const sizes = sizesByProduct[p.id] ?? [];
              const colors = colorsByProduct[p.id] ?? [];
              const info = getPriceInfo(p);
              return (
                <div key={p.id} style={{ borderBottom: '1px solid #eee', padding: '18px 0' }}>
                  {/* Fila superior: thumb + nombre + precio */}
                  <div className="flex items-center gap-3">
                    <img
                      src={mainImage(p) ?? undefined}
                      alt={p.name}
                      style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px' }}
                      className="shrink-0 bg-[#f3f3f3]"
                    />
                    <p className="flex-1 text-[14px] font-bold uppercase text-[#111]">{p.name}</p>
                    <p className="text-[16px] font-bold text-[#111]">{formatPrice(info.mainPrice)}</p>
                  </div>

                  {/* Color */}
                  {colors.length > 0 && (
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
        <div style={{ borderTop: '1px solid #eee', padding: '16px 28px 24px' }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-[#888]">Total tarjeta</span>
            <span className="text-[18px] font-bold text-[#111]">{formatPrice(card)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase" style={{ color: '#27ae60' }}>Total efectivo / transferencia</span>
            <span className="text-[18px] font-bold" style={{ color: '#27ae60' }}>{formatPrice(hasDual ? cash : card)}</span>
          </div>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="mt-4 w-full text-[14px] font-bold uppercase transition-colors"
            style={{
              background: actionBg,
              color: '#fff',
              letterSpacing: '2px',
              padding: '16px',
              borderRadius: '8px',
              cursor: canAdd ? 'pointer' : 'not-allowed',
            }}
          >
            {actionLabel}
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
    <section className="mx-auto w-full px-6 py-8 md:py-16">
      <SectionHeader label="Combiná tu look" title="Outfits" />
      <div className="relative">
        {/* Carrusel horizontal swipeable: 85vw en mobile (con peek + snap), 2 en tablet, 3 en desktop.
            touch-pan-x asegura que el swipe horizontal funcione en táctiles. */}
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          style={{ touchAction: 'pan-x' }}
          className={`flex touch-pan-x snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
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
