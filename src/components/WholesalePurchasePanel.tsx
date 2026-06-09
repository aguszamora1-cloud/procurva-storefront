import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronDown, CreditCard, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { useWholesalePricing } from '@/context/WholesalePricingContext';
import { colorToHex, formatPrice, mainImage } from '@/lib/utils';
import {
  canOfferCurve,
  colorsOf,
  curveCompositionText,
  curveMissingSizes,
  expandCurve,
  itemsPerCurve,
  maxCurvesAvailable,
  sizesOfColor,
  sizeStock,
  sortedTiers,
  variantsOfColor,
} from '@/lib/wholesale';
import type { Product } from '@/lib/types';

/**
 * Panel de compra MAYORISTA del detalle (réplica de procurva2/PublicCatalog.tsx):
 *  - Color con dots reales.
 *  - Tabs "Talles sueltos" / "Por curva".
 *  - Suelto: cantidad por talle (− 0 +). Curva: radios por tier + "Más curvas".
 *  - CTAs "Agregar al carrito" (outline) + "Comprar ahora" (accent → checkout).
 *  - Acordeones de políticas (Envío / Cambios / Pagos) del settings mayorista.
 */
export function WholesalePurchasePanel({ product, images }: { product: Product; images: string[] }) {
  const config = useStore();
  const { addItem, close } = useCart();
  const { curveTiers, curveDistributions } = useWholesalePricing();
  const navigate = useNavigate();

  const tiers = useMemo(() => sortedTiers(curveTiers[product.id] ?? []), [curveTiers, product.id]);
  const dist = curveDistributions[product.id] ?? [];
  const wholesalePrice = product.wholesale_price ?? product.retail_price ?? 0;
  const colors = useMemo(() => colorsOf(product), [product]);
  const fallbackImg = images[0] ?? mainImage(product);
  const curveTabAvailable = tiers.length > 0 && !product.pack_only_sale;

  const [tab, setTab] = useState<'sueltos' | 'curva'>('sueltos');
  // Pre-seleccionamos un color (el primero) así el selector de talles aparece de
  // entrada, sin obligar a elegir color antes. El usuario lo cambia con un toque.
  const [color, setColor] = useState<string | null>(colors[0] ?? null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [tierIdx, setTierIdx] = useState<number | null>(null); // -1 = "más curvas" (custom)
  const [customCurves, setCustomCurves] = useState(0);
  const [openPolicy, setOpenPolicy] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (colors.length > 0 && !color) setColor(colors[0]);
  }, [colors, color]);

  const vsColor = useMemo(() => variantsOfColor(product, color), [product, color]);
  const sizes = useMemo(() => sizesOfColor(product, color), [product, color]);
  const itemsPer = itemsPerCurve(dist, product, color);
  const lastTier = tiers.length > 0 ? tiers[tiers.length - 1] : null;
  const customMin = lastTier ? lastTier.curve_quantity + 1 : 2;
  const cheapestIdx = tiers.length > 0
    ? tiers.reduce((best, t, i) => (t.price_per_unit < tiers[best].price_per_unit ? i : best), 0)
    : -1;

  const canCurve = canOfferCurve(product, color, tiers, dist);
  useEffect(() => {
    if (tab === 'curva' && color && !canCurve) setTab('sueltos');
  }, [tab, color, canCurve]);

  const activeTier = tab === 'curva' ? (tierIdx === -1 ? lastTier : tierIdx !== null ? tiers[tierIdx] : null) : null;
  const selectedCurves = tierIdx === -1 ? customCurves : activeTier?.curve_quantity ?? 0;
  const activeTierPrice = activeTier?.price_per_unit ?? 0;
  const totalCurvaUnits = activeTier ? selectedCurves * itemsPer : 0;
  const totalCurvaPrice = totalCurvaUnits * activeTierPrice;

  // Stock real disponible para curvas en el color elegido. Una curva necesita stock
  // de TODOS sus talles; el límite lo marca el más escaso (0 = no se puede armar).
  const maxCurves = useMemo(() => maxCurvesAvailable(product, color, dist), [product, color, dist]);
  const curveStockOk = !!activeTier && selectedCurves > 0 && selectedCurves <= maxCurves;
  const missingSizes = useMemo(
    () => (tab === 'curva' && color && !curveStockOk ? curveMissingSizes(product, color, selectedCurves || 1, dist) : []),
    [tab, color, curveStockOk, product, selectedCurves, dist],
  );

  const totalSueltosUnits = sizes.reduce((acc, size) => {
    const v = vsColor.find((vv) => vv.size === size);
    return acc + (v ? quantities[v.id] || 0 : 0);
  }, 0);

  const changeColor = (c: string) => {
    setColor(c);
    setQuantities({});
    setTierIdx(null);
    setCustomCurves(0);
  };

  const bumpQty = (variantId: string, delta: number, stock: number) => {
    setQuantities((prev) => {
      const next = Math.max(0, Math.min(stock, (prev[variantId] || 0) + delta));
      return { ...prev, [variantId]: next };
    });
  };

  const pickTier = (idx: number) => {
    setTierIdx(idx);
    setCustomCurves(0);
  };
  const pickCustom = () => {
    if (!lastTier) return;
    setTierIdx(-1);
    setCustomCurves(customMin);
  };
  const bumpCustom = (delta: number) => {
    if (!lastTier) return;
    setCustomCurves((c) => Math.max(customMin, c + delta));
  };

  const flashAdded = () => {
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  };

  const goCheckout = () => {
    close();
    navigate('/checkout');
  };

  const submit = (mode: 'cart' | 'buy') => {
    if (tab === 'sueltos') {
      const entries = Object.entries(quantities).filter(([, q]) => q > 0);
      if (entries.length === 0) return;
      for (const [variantId, q] of entries) {
        const v = product.product_variants.find((x) => x.id === variantId);
        if (!v) continue;
        addItem({
          product_id: product.id,
          variant_id: v.id,
          name: product.name,
          size: v.size,
          color: v.color,
          unit_price: wholesalePrice,
          qty: q,
          image_url: v.image_url ?? fallbackImg,
          source: 'suelto',
        });
      }
    } else {
      if (!color || selectedCurves <= 0 || selectedCurves > maxCurves) return;
      const expanded = expandCurve(product, color, selectedCurves, dist);
      if (expanded.length === 0) return;
      for (const { variant, qty } of expanded) {
        addItem({
          product_id: product.id,
          variant_id: variant.id,
          name: product.name,
          size: variant.size,
          color: variant.color,
          unit_price: activeTierPrice || wholesalePrice,
          qty,
          image_url: variant.image_url ?? fallbackImg,
          source: 'curva',
          curves: selectedCurves,
        });
      }
    }
    if (mode === 'buy') goCheckout();
    else flashAdded();
  };

  const needColor = colors.length > 0;
  const hasSelection = tab === 'sueltos' ? totalSueltosUnits > 0 : !!activeTier && selectedCurves > 0;
  const canSubmit = (!needColor || !!color) && hasSelection && (tab === 'sueltos' || curveStockOk);

  const policies = [
    { key: 'envio', label: 'Envío', text: config.policyShipping },
    { key: 'cambios', label: 'Cambios y devoluciones', text: config.policyReturns },
    { key: 'pagos', label: 'Medios de pago', text: config.policyPayments },
  ].filter((p) => p.text);

  return (
    <div className="space-y-5">
      {/* Color con dots reales */}
      {needColor && (
        <div>
          <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            Color{color && <span className="text-text">: {color}</span>}
          </p>
          <div className="flex flex-wrap gap-2.5">
            {colors.map((c) => {
              const active = color === c;
              return (
                <button
                  key={c}
                  type="button"
                  title={c}
                  aria-label={`Color ${c}`}
                  onClick={() => changeColor(c)}
                  className={`h-9 w-9 rounded-full border transition-all ${
                    active ? 'border-text ring-2 ring-text ring-offset-2' : 'border-line hover:border-subtle'
                  }`}
                  style={{ backgroundColor: colorToHex(c) }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs Talles sueltos / Por curva */}
      {curveTabAvailable && (
        <div className="flex w-full gap-1 rounded-lg bg-secondary p-1">
          {([['sueltos', 'Talles sueltos'], ['curva', 'Por curva']] as const).map(([t, label]) => {
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md py-2 text-[14px] transition-colors ${
                  active ? 'bg-background font-bold text-text shadow-sm' : 'font-normal text-subtle hover:text-text'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {tab === 'sueltos' ? (
        <div className="space-y-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Talles y cantidades</p>
          {sizes.map((size, idx) => {
            const v = vsColor.find((vv) => vv.size === size);
            if (!v) return null;
            const q = quantities[v.id] || 0;
            const stock = sizeStock(product, size, color);
            const outOfStock = stock <= 0;
            return (
              <div
                key={size}
                className={`flex items-center justify-between py-3 ${idx < sizes.length - 1 ? 'border-b border-line' : ''}`}
              >
                <span className={`text-[15px] font-semibold ${outOfStock ? 'text-subtle line-through' : 'text-text'}`}>{size}</span>
                {outOfStock ? (
                  <span className="text-[12px] font-medium text-red-500">Sin stock</span>
                ) : (
                  <div className="inline-flex items-center overflow-hidden rounded-lg border border-line">
                    <button
                      type="button"
                      aria-label="Restar"
                      onClick={() => bumpQty(v.id, -1, stock)}
                      disabled={q <= 0}
                      className="flex h-[34px] w-[34px] items-center justify-center text-text disabled:opacity-40"
                    >
                      <Minus size={14} />
                    </button>
                    <span className={`min-w-[32px] text-center text-[15px] ${q === 0 ? 'text-subtle' : 'font-medium text-text'}`}>{q}</span>
                    <button
                      type="button"
                      aria-label="Sumar"
                      onClick={() => bumpQty(v.id, 1, stock)}
                      disabled={q >= stock}
                      title={q >= stock ? `Máximo ${stock} disponibles` : undefined}
                      className="flex h-[34px] w-[34px] items-center justify-center text-text disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {/* Resumen suelto */}
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-[14px] font-normal text-subtle">Total: {totalSueltosUnits} un.</span>
            <span className="text-[14px] font-normal text-subtle">
              Precio por unidad <span className="text-[16px] font-bold text-text">{formatPrice(wholesalePrice)}</span>
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[12px] text-subtle">{curveCompositionText(dist)}</p>
          {tiers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line py-6 text-center text-[13px] text-subtle">
              Sin escala de precios por curva
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {tiers.map((tier, idx) => {
                const sel = tierIdx === idx;
                const best = idx === cheapestIdx && tiers.length > 1;
                const tierOut = tier.curve_quantity > maxCurves;
                const label = `${tier.curve_quantity} ${tier.curve_quantity === 1 ? 'curva' : 'curvas'}`;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => !tierOut && pickTier(idx)}
                    disabled={tierOut}
                    className={`flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-left transition-colors ${
                      tierOut
                        ? 'cursor-not-allowed border border-line opacity-50'
                        : sel
                          ? 'border-[1.5px] border-text bg-secondary'
                          : 'border border-line hover:border-subtle'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${sel ? 'border-text' : 'border-line'}`}
                      >
                        {sel && <span className="h-2 w-2 rounded-full bg-text" />}
                      </span>
                      <span className="text-[13px] font-medium text-text">{label}</span>
                      {best && !tierOut && (
                        <span className="rounded-full bg-accent px-2 py-[3px] text-[10px] font-bold uppercase leading-none tracking-wide text-on-accent">
                          Mejor precio
                        </span>
                      )}
                      {tierOut && (
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-red-500">Sin stock</span>
                      )}
                    </span>
                    <span className="flex items-baseline gap-1">
                      <span className="text-[14px] font-medium text-text">{formatPrice(tier.price_per_unit)}</span>
                      <span className="text-[11px] text-subtle">c/u</span>
                    </span>
                  </button>
                );
              })}

              {/* "Más curvas" — custom (solo si el stock permite más que el último tier) */}
              {lastTier && customMin <= maxCurves && (
                <>
                  <button
                    type="button"
                    onClick={pickCustom}
                    className={`flex w-full items-center gap-2 py-2 text-left text-[12px] ${tierIdx === -1 ? 'text-text' : 'text-muted'}`}
                  >
                    <Plus size={14} /> <span>Más curvas</span>
                  </button>
                  {tierIdx === -1 && (
                    <div className="flex items-center justify-between border-t border-line py-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          aria-label="Restar curva"
                          onClick={() => bumpCustom(-1)}
                          disabled={customCurves <= customMin}
                          className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-line text-text disabled:opacity-40"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-[70px] text-center text-[15px] font-medium text-text">
                          {customCurves} {customCurves === 1 ? 'curva' : 'curvas'}
                        </span>
                        <button
                          type="button"
                          aria-label="Sumar curva"
                          onClick={() => bumpCustom(1)}
                          className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-line text-text"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="text-[16px] font-medium text-text">{formatPrice(lastTier.price_per_unit)} c/u</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Aviso de stock insuficiente para armar la(s) curva(s) */}
          {color && (maxCurves === 0 || (!!activeTier && selectedCurves > maxCurves)) && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-medium leading-snug text-red-600">
              <AlertCircle size={15} className="mt-px flex-none" />
              <span>
                {maxCurves === 0
                  ? 'No hay stock suficiente para armar una curva en este color.'
                  : `Con el stock actual solo podés armar hasta ${maxCurves} ${maxCurves === 1 ? 'curva' : 'curvas'}.`}
                {missingSizes.length > 0 && ` Faltan talles: ${missingSizes.join(', ')}.`}
              </span>
            </div>
          )}

          {/* Resumen curva (solo si el stock alcanza) */}
          {activeTier && totalCurvaUnits > 0 && curveStockOk && (
            <div className="flex items-center justify-between border-t border-line pt-3">
              <span className="text-[13px] text-muted">
                {selectedCurves} {selectedCurves === 1 ? 'curva' : 'curvas'} · {totalCurvaUnits} un.
              </span>
              <div className="text-right">
                <p className="text-[11px] leading-none text-subtle">Precio por unidad</p>
                <p className="text-[18px] font-semibold text-text">{formatPrice(activeTierPrice)}</p>
                <p className="mt-1 text-[13px] font-semibold text-text">Total: {formatPrice(totalCurvaPrice)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CTAs: Agregar al carrito (outline) + Comprar ahora (salmón → checkout) */}
      <div className="flex flex-col gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => submit('cart')}
          disabled={!canSubmit || added}
          className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] border-[1.5px] border-text bg-background px-6 py-[14px] text-[14px] font-semibold uppercase tracking-[0.03em] text-text transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ShoppingBag size={16} />
          {added ? '✓ Agregado al carrito' : 'Agregar al carrito'}
        </button>
        <button
          type="button"
          onClick={() => submit('buy')}
          disabled={!canSubmit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-accent px-6 py-[16px] text-[15px] font-bold uppercase tracking-[0.04em] text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CreditCard size={16} />
          Comprar ahora
        </button>
      </div>

      {/* Acordeones de políticas (settings mayorista) */}
      {policies.length > 0 && (
        <div className="divide-y divide-line border-t border-line">
          {policies.map((p) => {
            const open = openPolicy === p.key;
            return (
              <div key={p.key}>
                <button
                  type="button"
                  onClick={() => setOpenPolicy(open ? null : p.key)}
                  className="flex w-full items-center justify-between py-3.5 text-left"
                >
                  <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{p.label}</span>
                  <ChevronDown size={16} className={`text-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && <p className="whitespace-pre-line pb-4 text-[13px] leading-relaxed text-muted">{p.text}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
