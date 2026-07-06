import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Check, ChevronDown, CreditCard, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { useWholesalePricing } from '@/context/WholesalePricingContext';
import { colorToHex, formatPrice, mainImage } from '@/lib/utils';
import {
  colorsOf,
  curveCompositionText,
  curveMissingSizes,
  expandCurve,
  itemsPerCurve,
  maxCurvesAvailable,
  pickCurveTier,
  sizesOfColor,
  sizeStock,
  sortedTiers,
  variantsOfColor,
} from '@/lib/wholesale';
import {
  activePacks,
  packCartLines,
  packCountLabel,
  packSizeDistribution,
  packTierLabel,
  pickPackTier,
  sortedPackTiers,
} from '@/lib/packs';
import { applyPromoToPrice, type Promotion } from '@/lib/promotions';
import type { CartItem, Product } from '@/lib/types';

type PanelTab = 'sueltos' | 'curva' | 'surtida' | 'pack';

/**
 * Panel de compra MAYORISTA del detalle (réplica de procurva2/PublicCatalog.tsx):
 *  - Color con dots reales.
 *  - Tabs "Talles sueltos" / "Por curva".
 *  - Suelto: cantidad por talle (− 0 +). Curva: radios por tier + "Más curvas".
 *  - CTAs "Agregar al carrito" (outline) + "Comprar ahora" (accent → checkout).
 *  - Acordeones de políticas (Envío / Cambios / Pagos) del settings mayorista.
 */
export function WholesalePurchasePanel({
  product,
  images,
  promo = null,
  onColorChange,
}: {
  product: Product;
  images: string[];
  promo?: Promotion | null;
  /** Avisa al detalle qué color está elegido para que la galería cambie la foto. */
  onColorChange?: (color: string | null) => void;
}) {
  const config = useStore();
  const { addItem, close } = useCart();
  const { curveTiers, curvaSurtidaTiers, curveDistributions, productPacks } = useWholesalePricing();
  const navigate = useNavigate();

  // Descuento de la promoción mayorista vigente, por unidad. Si no hay promo, identidad.
  const d = (price: number) => (promo ? applyPromoToPrice(price, promo, 'wholesale') : price);
  // Tags de la promo para cada línea de carrito (precio ya descontado en unit_price).
  const promoTag = (originalUnit: number): Partial<CartItem> =>
    promo
      ? {
          promo_id: promo.id,
          promo_name: promo.name,
          unit_price_original: originalUnit,
          promo_stackable: promo.stackable_with_coupons !== false,
        }
      : {};

  const tiers = useMemo(() => sortedTiers(curveTiers[product.id] ?? []), [curveTiers, product.id]);
  // Precio propio de la curva surtida (tabla aparte, NO los tiers de mismo color).
  const surtidaTiers = useMemo(() => sortedTiers(curvaSurtidaTiers[product.id] ?? []), [curvaSurtidaTiers, product.id]);
  const dist = curveDistributions[product.id] ?? [];
  const packs = useMemo(() => activePacks(productPacks[product.id] ?? []), [productPacks, product.id]);
  const wholesalePrice = product.wholesale_price ?? product.retail_price ?? 0;
  const colors = useMemo(() => colorsOf(product), [product]);
  const fallbackImg = images[0] ?? mainImage(product);
  const curveTabAvailable = tiers.length > 0 && !product.pack_only_sale;
  // Curva surtida: misma DISTRIBUCIÓN de talles pero con su PROPIO precio. Aparece si:
  //  - el producto la tiene activada (flag),
  //  - existe distribución de talles (dist),
  //  - y tiene precio de surtida cargado (surtidaTiers) — desacoplado del mismo color.
  // El color por talle lo surte el server al confirmar.
  const surtidaTabAvailable =
    product.curva_surtida_enabled === true &&
    surtidaTiers.length > 0 &&
    dist.length > 0 &&
    !product.pack_only_sale;
  // Talles sueltos: requiere un PRECIO MAYORISTA propio (> 0). Si el negocio no
  // cargó precio por mayor, no mostramos el selector de talles sueltos (así no se
  // vende suelto al precio minorista de fallback ni a $0). Pensado para negocios
  // que venden SOLO por curva/surtida/pack. Ojo: usamos product.wholesale_price,
  // NO wholesalePrice (que cae a retail) — el fallback a retail es justo lo que
  // queremos evitar acá. También se oculta si el producto es solo-pack.
  const hasWholesaleLoosePrice = (product.wholesale_price ?? 0) > 0;
  const sueltoTabAvailable = !product.pack_only_sale && hasWholesaleLoosePrice;
  const packTabAvailable = packs.length > 0;

  // Tabs visibles según lo que tenga el producto (suelto / curva / surtida / pack).
  const availableTabs = useMemo(() => {
    const t: Array<[PanelTab, string]> = [];
    if (sueltoTabAvailable) t.push(['sueltos', 'Talles sueltos']);
    if (curveTabAvailable) t.push(['curva', 'Por curva']);
    if (surtidaTabAvailable) t.push(['surtida', 'Curva surtida']);
    if (packTabAvailable) t.push(['pack', 'Por pack']);
    return t;
  }, [sueltoTabAvailable, curveTabAvailable, surtidaTabAvailable, packTabAvailable]);

  const [tab, setTab] = useState<PanelTab>(() => (product.pack_only_sale && packs.length > 0 ? 'pack' : 'sueltos'));
  // Pre-seleccionamos un color (el primero) así el selector de talles aparece de
  // entrada, sin obligar a elegir color antes. El usuario lo cambia con un toque.
  const [color, setColor] = useState<string | null>(colors[0] ?? null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [tierIdx, setTierIdx] = useState<number | null>(null); // -1 = "más curvas" (custom)
  const [customCurves, setCustomCurves] = useState(0);
  const [surtidaCurves, setSurtidaCurves] = useState(1); // cantidad de curvas surtidas
  const [packId, setPackId] = useState<string | null>(null);
  const [packCount, setPackCount] = useState(1);
  const [openPolicy, setOpenPolicy] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (colors.length > 0 && !color) setColor(colors[0]);
  }, [colors, color]);

  // Sincronizamos el color elegido con el detalle para que la galería muestre la
  // foto de la variante de ese color (la misma lógica "Imagen por color" del retail).
  useEffect(() => {
    onColorChange?.(color);
  }, [color, onColorChange]);

  // Si el tab activo deja de estar disponible (datos async de packs/curva), caemos al primero.
  const tabKeys = availableTabs.map((t) => t[0]).join(',');
  useEffect(() => {
    const valid = tabKeys ? tabKeys.split(',') : [];
    if (valid.length > 0 && !valid.includes(tab)) setTab(valid[0] as PanelTab);
  }, [tabKeys, tab]);

  // Pre-seleccionamos el primer pack (menor volumen) cuando el tab pack aparece.
  useEffect(() => {
    if (packs.length > 0 && (!packId || !packs.some((p) => p.id === packId))) {
      setPackId(packs[0].id);
      setPackCount(1);
    }
  }, [packs, packId]);

  const selectedPack = packs.find((p) => p.id === packId) ?? packs[0] ?? null;
  const packTier = selectedPack ? pickPackTier(selectedPack.price_tiers, packCount) : null;
  const packUnitPrice = packTier?.price_per_unit ?? 0;
  const packTotalUnits = selectedPack ? selectedPack.total_units * packCount : 0;
  const packDist = selectedPack ? packSizeDistribution(selectedPack) : [];

  const vsColor = useMemo(() => variantsOfColor(product, color), [product, color]);
  const sizes = useMemo(() => sizesOfColor(product, color), [product, color]);
  const itemsPer = itemsPerCurve(dist, product, color);
  const lastTier = tiers.length > 0 ? tiers[tiers.length - 1] : null;
  const customMin = lastTier ? lastTier.curve_quantity + 1 : 2;
  // Precio base = el de "1 curva" (o el primer tier) para calcular el ahorro por unidad
  // que muestran las cards de 2+ curvas.
  const baseTier = tiers.find((t) => t.curve_quantity === 1) ?? tiers[0] ?? null;
  const basePrice = baseTier?.price_per_unit ?? 0;

  // Nota: NO rebotamos el tab 'curva' cuando el color elegido no tiene stock para
  // armar la curva. El tab muestra adentro el aviso "No hay stock suficiente para
  // armar una curva en este color" (con los tiers en gris) y el botón de agregar
  // queda bloqueado por `curveStockOk`. Rebotar a 'sueltos' hacía que el tab
  // "no se apretara" sin explicar el motivo.

  // Curva surtida: precio del tier PROPIO de surtida para la cantidad elegida +
  // unidades totales. No valida stock client-side: los colores se surten
  // server-side al confirmar. Usa surtidaTiers (NO los tiers de mismo color).
  const surtidaTier = useMemo(() => pickCurveTier(surtidaTiers, surtidaCurves), [surtidaTiers, surtidaCurves]);
  // Precio de surtida: SIN fallback silencioso a wholesalePrice. Si no hay tier de
  // surtida válido (>0), queda null → el ítem NO se agrega y se muestra aviso
  // (defensa en profundidad, coherente con el POS que bloquea sin tiers). En la
  // práctica el tab no aparece sin tiers, así que esto solo cubre estados raros
  // (carrito viejo, etc.): que falle RUIDOSO, no que invente un precio.
  const surtidaPrice: number | null = surtidaTier && surtidaTier.price_per_unit > 0 ? surtidaTier.price_per_unit : null;
  const surtidaUnits = surtidaCurves * itemsPer;

  const activeTier = tab === 'curva' ? (tierIdx === -1 ? lastTier : tierIdx !== null ? tiers[tierIdx] : null) : null;
  const selectedCurves = tierIdx === -1 ? customCurves : activeTier?.curve_quantity ?? 0;
  const activeTierPrice = activeTier?.price_per_unit ?? 0;
  const totalCurvaUnits = activeTier ? selectedCurves * itemsPer : 0;

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
          unit_price: d(wholesalePrice),
          qty: q,
          image_url: v.image_url ?? fallbackImg,
          source: 'suelto',
          ...promoTag(wholesalePrice),
        });
      }
    } else if (tab === 'curva') {
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
          unit_price: d(activeTierPrice || wholesalePrice),
          qty,
          image_url: variant.image_url ?? fallbackImg,
          source: 'curva',
          curves: selectedCurves,
          ...promoTag(activeTierPrice || wholesalePrice),
        });
      }
    } else if (tab === 'surtida') {
      // Curva surtida: NO se explota en el cliente (no hay colores todavía). Va
      // como UN item especial sin variant_id; el server asigna los colores según
      // stock al promover el pedido. qty = unidades totales (curvas × ítems/curva).
      if (surtidaCurves <= 0 || itemsPer <= 0) return;
      // Sin precio de surtida válido NO agregamos (no caemos a wholesalePrice en
      // silencio). El botón ya queda deshabilitado por canSubmit + aviso inline.
      if (surtidaPrice == null) return;
      const price = surtidaPrice;
      addItem({
        product_id: product.id,
        variant_id: '',
        lineId: crypto.randomUUID(),
        name: product.name,
        size: null,
        color: null,
        unit_price: d(price),
        qty: surtidaUnits,
        image_url: fallbackImg,
        source: 'curva_surtida',
        curves: surtidaCurves,
        curve_price_per_unit: d(price),
        ...promoTag(price),
      });
    } else {
      // pack
      if (!selectedPack || packCount < 1 || packUnitPrice <= 0) return;
      const lines = packCartLines(product, selectedPack, packCount, d(packUnitPrice), fallbackImg);
      if (lines.length === 0) return;
      for (const line of lines) addItem({ ...line, ...promoTag(packUnitPrice) });
    }
    if (mode === 'buy') goCheckout();
    else flashAdded();
  };

  const needColor = colors.length > 0;
  const hasSelection =
    tab === 'sueltos'
      ? totalSueltosUnits > 0
      : tab === 'curva'
        ? !!activeTier && selectedCurves > 0
        : tab === 'surtida'
          ? surtidaCurves > 0
          : !!selectedPack && packCount > 0 && packUnitPrice > 0;
  // El pack trae su propia distribución (color incluido): no exige elegir color del producto.
  // La curva surtida tampoco: el color y el stock se resuelven server-side al confirmar.
  const canSubmit =
    tab === 'pack'
      ? hasSelection
      : tab === 'surtida'
        ? hasSelection && surtidaPrice != null
        : (!needColor || !!color) && hasSelection && (tab === 'sueltos' || curveStockOk);

  const policies = [
    { key: 'envio', label: 'Envío', text: config.policyShipping },
    { key: 'cambios', label: 'Cambios y devoluciones', text: config.policyReturns },
    { key: 'pagos', label: 'Medios de pago', text: config.policyPayments },
  ].filter((p) => p.text);

  return (
    <div className="space-y-5">
      {/* Aviso de promoción mayorista vigente (precios ya con descuento aplicado). */}
      {promo && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-secondary px-3 py-2">
          <span
            className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold uppercase leading-none tracking-wide text-white"
            style={{ backgroundColor: promo.badge_color || 'var(--color-accent)' }}
          >
            {promo.badge_text || 'PROMO'}
          </span>
          <span className="text-[13px] font-semibold text-text">{promo.name}</span>
          <span className="text-[12px] font-medium text-subtle">· precios con descuento aplicado</span>
        </div>
      )}

      {/* Color con dots reales. El pack trae su distribución y la curva surtida
          asigna los colores server-side → en ambos no se elige color. */}
      {needColor && tab !== 'pack' && tab !== 'surtida' && (
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

      {/* Tabs Talles sueltos / Por curva / Por pack — tab selector con subrayado accent */}
      {availableTabs.length > 1 && (
        <div className="flex w-full border-b border-line">
          {availableTabs.map(([t, label]) => {
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`-mb-px flex-1 border-b-2 pb-2.5 pt-1 text-[15px] transition-colors ${
                  active ? 'border-accent font-semibold text-text' : 'border-transparent font-medium text-subtle hover:text-text'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {tab === 'sueltos' && sueltoTabAvailable && (
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
                className={`flex items-center justify-between py-3 ${idx < sizes.length - 1 ? 'border-b border-line' : ''} ${outOfStock ? 'opacity-50' : ''}`}
              >
                <span className="text-[15px] font-semibold text-text">{size}</span>
                {outOfStock ? (
                  <span className="text-[12px] font-medium text-subtle">Sin stock</span>
                ) : (
                  <div className="inline-flex items-center overflow-hidden rounded-md border border-line">
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
          <div className="flex items-end justify-between border-t border-line pt-3">
            <span className="text-[14px] font-medium text-subtle">Total: {totalSueltosUnits} un.</span>
            <div className="text-right">
              <p className="text-[13px] font-medium leading-none text-subtle">Precio por unidad</p>
              <p className="mt-1 flex items-baseline justify-end gap-1">
                {promo && d(wholesalePrice) < wholesalePrice && (
                  <span className="text-[14px] font-medium text-subtle line-through">{formatPrice(wholesalePrice)}</span>
                )}
                <span className={`text-[26px] font-bold leading-none ${promo ? 'text-accent' : 'text-text'}`}>{formatPrice(d(wholesalePrice))}</span>
                <span className="text-[13px] font-medium text-subtle">c/u</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === 'curva' && (
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-subtle">{curveCompositionText(dist)}</p>
          {tiers.length === 0 ? (
            <div className="rounded-md border border-dashed border-line py-6 text-center text-[13px] font-medium text-subtle">
              Sin escala de precios por curva
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {tiers.map((tier, idx) => {
                const sel = tierIdx === idx;
                const isLast = idx === tiers.length - 1 && tiers.length > 1;
                const tierOut = tier.curve_quantity > maxCurves;
                const savings = d(basePrice) - d(tier.price_per_unit);
                const showSavings = tier.curve_quantity >= 2 && savings > 0;
                const label = `${tier.curve_quantity} ${tier.curve_quantity === 1 ? 'curva' : 'curvas'}`;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => !tierOut && pickTier(idx)}
                    disabled={tierOut}
                    style={sel ? { backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' } : undefined}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3.5 text-left transition-colors ${
                      tierOut
                        ? 'cursor-not-allowed border border-line opacity-50'
                        : sel
                          ? 'border-[2.5px] border-accent'
                          : 'border border-line hover:border-subtle'
                    }`}
                  >
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <span
                        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${sel ? 'border-accent' : 'border-line'}`}
                      >
                        {sel && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
                      </span>
                      <span className="text-[15px] font-semibold text-text">{label}</span>
                      {showSavings && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[12px] font-bold leading-none text-emerald-600">
                          -{formatPrice(savings)}/u
                        </span>
                      )}
                      {isLast && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[12px] font-bold leading-none text-amber-700">
                          Mejor precio
                        </span>
                      )}
                      {tierOut && <span className="text-[12px] font-medium text-subtle">Sin stock</span>}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-1">
                      {promo && d(tier.price_per_unit) < tier.price_per_unit && (
                        <span className="text-[14px] font-medium text-subtle line-through">{formatPrice(tier.price_per_unit)}</span>
                      )}
                      <span className={`text-[26px] font-bold leading-none ${promo ? 'text-accent' : 'text-text'}`}>{formatPrice(d(tier.price_per_unit))}</span>
                      <span className="text-[13px] font-medium text-subtle">c/u</span>
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
                    className={`flex w-full items-center gap-2 py-2 text-left text-[13px] font-medium ${tierIdx === -1 ? 'text-text' : 'text-muted'}`}
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
                      <span className="flex items-baseline gap-1">
                        {promo && d(lastTier.price_per_unit) < lastTier.price_per_unit && (
                          <span className="text-[14px] font-medium text-subtle line-through">{formatPrice(lastTier.price_per_unit)}</span>
                        )}
                        <span className={`text-[26px] font-bold leading-none ${promo ? 'text-accent' : 'text-text'}`}>{formatPrice(d(lastTier.price_per_unit))}</span>
                        <span className="text-[13px] font-medium text-subtle">c/u</span>
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Aviso de stock insuficiente para armar la(s) curva(s) */}
          {color && (maxCurves === 0 || (!!activeTier && selectedCurves > maxCurves)) && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-medium leading-snug text-red-600">
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
              <span className="text-[14px] font-medium text-muted">
                {selectedCurves} {selectedCurves === 1 ? 'curva' : 'curvas'} · {totalCurvaUnits} un.
              </span>
              <div className="text-right">
                <p className="text-[13px] font-medium leading-none text-subtle">Total</p>
                <p className="mt-1 text-[26px] font-bold leading-none text-text">{formatPrice(totalCurvaUnits * d(activeTierPrice))}</p>
                <p className="mt-1.5 flex items-baseline justify-end gap-1">
                  {promo && d(activeTierPrice) < activeTierPrice && (
                    <span className="text-[12px] font-medium text-subtle line-through">{formatPrice(activeTierPrice)}</span>
                  )}
                  <span className={`text-[15px] font-semibold ${promo ? 'text-accent' : 'text-text'}`}>{formatPrice(d(activeTierPrice))}</span>
                  <span className="text-[12px] font-medium text-subtle">c/u</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'surtida' && (
        <div className="space-y-3">
          <p className="text-[13px] font-medium text-subtle">{curveCompositionText(dist)} — colores surtidos por el negocio</p>

          {/* Aviso: colores asignados al confirmar */}
          <div className="flex items-start gap-2 rounded-md border border-line bg-secondary px-3 py-2.5 text-[12px] font-medium leading-snug text-muted">
            <AlertCircle size={15} className="mt-px flex-none" />
            <span>Los colores se asignan según disponibilidad al confirmar tu pedido.</span>
          </div>

          {/* Selector de cantidad de curvas */}
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-[14px] font-medium text-muted">Cantidad de curvas</span>
            <div className="inline-flex items-center overflow-hidden rounded-md border border-line">
              <button
                type="button"
                aria-label="Restar curva"
                onClick={() => setSurtidaCurves((c) => Math.max(1, c - 1))}
                disabled={surtidaCurves <= 1}
                className="flex h-[34px] w-[34px] items-center justify-center text-text disabled:opacity-40"
              >
                <Minus size={14} />
              </button>
              <span className="min-w-[40px] text-center text-[15px] font-medium text-text">{surtidaCurves}</span>
              <button
                type="button"
                aria-label="Sumar curva"
                onClick={() => setSurtidaCurves((c) => c + 1)}
                className="flex h-[34px] w-[34px] items-center justify-center text-text"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Resumen: precio por unidad (tier) + total estimado. Solo si hay precio
              de surtida válido; si no, aviso ruidoso (no se inventa wholesalePrice). */}
          {surtidaPrice != null ? (
            <div className="flex items-center justify-between border-t border-line pt-3">
              <span className="text-[14px] font-medium text-muted">
                {surtidaCurves} {surtidaCurves === 1 ? 'curva' : 'curvas'} · {surtidaUnits} un.
              </span>
              <div className="text-right">
                <p className="text-[13px] font-medium leading-none text-subtle">Total estimado</p>
                <p className="mt-1 text-[26px] font-bold leading-none text-text">{formatPrice(surtidaUnits * d(surtidaPrice))}</p>
                <p className="mt-1.5 flex items-baseline justify-end gap-1">
                  {promo && d(surtidaPrice) < surtidaPrice && (
                    <span className="text-[12px] font-medium text-subtle line-through">{formatPrice(surtidaPrice)}</span>
                  )}
                  <span className={`text-[15px] font-semibold ${promo ? 'text-accent' : 'text-text'}`}>{formatPrice(d(surtidaPrice))}</span>
                  <span className="text-[12px] font-medium text-subtle">c/u</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-line bg-secondary px-3 py-2.5 text-[12px] font-medium leading-snug text-muted">
              <AlertCircle size={15} className="mt-px flex-none" />
              <span>Este producto todavía no tiene precio de curva surtida configurado. No se puede comprar por curva surtida por ahora.</span>
            </div>
          )}
        </div>
      )}

      {tab === 'pack' && selectedPack && (
        <div className="space-y-4">
          {/* Sub-selector de packs disponibles (chips) */}
          {packs.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {packs.map((p) => {
                const sel = p.id === selectedPack.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPackId(p.id);
                      setPackCount(1);
                    }}
                    style={sel ? { backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' } : undefined}
                    className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                      sel ? 'border-accent text-text' : 'border-line text-subtle hover:border-subtle'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Nombre + unidades del pack */}
          <p className="text-[15px] font-semibold text-text">
            {selectedPack.name} — {selectedPack.total_units} {selectedPack.total_units === 1 ? 'unidad' : 'unidades'}
          </p>

          {/* Distribución de talles (readonly) o, sin distribución, el total */}
          {packDist.length > 0 ? (
            <div>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Qué incluye</p>
              <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                {packDist.map((r) => (
                  <div key={r.size} className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-[14px] font-semibold text-text">{r.size}</span>
                    <span className="text-[13px] font-medium text-subtle">{r.quantity} u.</span>
                  </div>
                ))}
              </div>
              {selectedPack.pack_type === 'free_color' && (
                <p className="mt-2 text-[12px] font-medium text-subtle">Color a definir con el vendedor.</p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-line px-3.5 py-3 text-[14px] font-medium text-text">
              Cantidad total: {selectedPack.total_units} unidades
            </div>
          )}

          {/* Escala de precios por volumen (informativa, escalón activo resaltado) */}
          {sortedPackTiers(selectedPack.price_tiers).length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {sortedPackTiers(selectedPack.price_tiers).map((t) => {
                const isActive = packTier?.min_packs === t.min_packs;
                return (
                  <span
                    key={t.min_packs}
                    className={`rounded-full border px-2.5 py-1 text-[12px] font-medium ${
                      isActive ? 'border-accent text-text' : 'border-line text-subtle'
                    }`}
                  >
                    {packTierLabel(selectedPack, t)} · {formatPrice(d(t.price_per_unit))}/u
                  </span>
                );
              })}
            </div>
          )}

          {/* Selector de cantidad de packs */}
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-[14px] font-medium text-muted">Cantidad de packs</span>
            <div className="inline-flex items-center overflow-hidden rounded-md border border-line">
              <button
                type="button"
                aria-label="Restar pack"
                onClick={() => setPackCount((c) => Math.max(1, c - 1))}
                disabled={packCount <= 1}
                className="flex h-[34px] w-[34px] items-center justify-center text-text disabled:opacity-40"
              >
                <Minus size={14} />
              </button>
              <span className="min-w-[40px] text-center text-[15px] font-medium text-text">{packCount}</span>
              <button
                type="button"
                aria-label="Sumar pack"
                onClick={() => setPackCount((c) => c + 1)}
                className="flex h-[34px] w-[34px] items-center justify-center text-text"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Resumen pack: precio por unidad + total */}
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-[14px] font-medium text-muted">
              {packCountLabel(selectedPack, packCount)} · {packTotalUnits} un.
            </span>
            <div className="text-right">
              <p className="text-[13px] font-medium leading-none text-subtle">Total</p>
              <p className="mt-1 text-[26px] font-bold leading-none text-text">{formatPrice(packTotalUnits * d(packUnitPrice))}</p>
              <p className="mt-1.5 flex items-baseline justify-end gap-1">
                {promo && d(packUnitPrice) < packUnitPrice && (
                  <span className="text-[12px] font-medium text-subtle line-through">{formatPrice(packUnitPrice)}</span>
                )}
                <span className={`text-[15px] font-semibold ${promo ? 'text-accent' : 'text-text'}`}>{formatPrice(d(packUnitPrice))}</span>
                <span className="text-[12px] font-medium text-subtle">c/u</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CTAs: Agregar al carrito (outline gris) + Comprar ahora (sólido oscuro → checkout) */}
      <div className="flex flex-col gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => submit('cart')}
          disabled={!canSubmit || added}
          className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] border border-line bg-transparent px-6 py-[14px] text-[14px] font-medium text-text transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {added ? <Check size={16} /> : <ShoppingBag size={16} />}
          {added ? 'Agregado al carrito' : 'Agregar al carrito'}
        </button>
        <button
          type="button"
          onClick={() => submit('buy')}
          disabled={!canSubmit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-text px-6 py-[14px] text-[14px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
                {open && <p className="whitespace-pre-line pb-4 text-[13px] font-medium leading-relaxed text-muted">{p.text}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
