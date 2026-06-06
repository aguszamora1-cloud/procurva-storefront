import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Truck } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { useWholesalePricing } from '@/context/WholesalePricingContext';
import { ColorSelector } from '@/components/ColorSelector';
import { SizeSelector } from '@/components/SizeSelector';
import { WholesalePriceTable } from '@/components/WholesalePriceTable';
import { formatPrice, mainImage } from '@/lib/utils';
import { buildWhatsappInquiry } from '@/lib/checkout';
import {
  canOfferCurve,
  colorsOf,
  curveCompositionText,
  curveHasStock,
  expandCurve,
  itemsPerCurve,
  pickCurveTier,
  sizeStock,
  sizesOfColor,
} from '@/lib/wholesale';
import type { Product } from '@/lib/types';

/**
 * Panel de compra MAYORISTA del detalle de producto. Dos modos:
 *  - SUELTO: color + talle + cantidad → precio "por talle" (wholesale_price).
 *  - POR CURVA: color + cantidad de curvas → precio escalonado por volumen.
 * Reemplaza al bloque retail (PriceDisplay + selectores) cuando storeType==='wholesale'.
 */
export function WholesalePurchasePanel({ product, images }: { product: Product; images: string[] }) {
  const config = useStore();
  const { addItem } = useCart();
  const { curveTiers, curveDistributions } = useWholesalePricing();

  const tiers = curveTiers[product.id] ?? [];
  const dist = curveDistributions[product.id] ?? [];
  const wholesalePrice = product.wholesale_price ?? 0;
  const colors = useMemo(() => colorsOf(product), [product]);
  const fallbackImg = images[0] ?? mainImage(product);
  const curveTabAvailable = tiers.length > 0 && !product.pack_only_sale;

  const [tab, setTab] = useState<'sueltos' | 'curva'>('sueltos');
  const [color, setColor] = useState<string | null>(colors.length === 1 ? colors[0] : null);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [curves, setCurves] = useState(1);
  const [added, setAdded] = useState(false);

  // Pre-seleccionar color si hay uno solo.
  useEffect(() => {
    if (colors.length === 1 && !color) setColor(colors[0]);
  }, [colors, color]);

  const sizes = useMemo(() => sizesOfColor(product, color), [product, color]);
  const sizeDisabled = (s: string) => sizeStock(product, s, color) <= 0;

  // Si la curva no se puede ofrecer para el color elegido, volvemos a sueltos.
  const canCurve = canOfferCurve(product, color, tiers, dist);
  useEffect(() => {
    if (tab === 'curva' && color && !canCurve) setTab('sueltos');
  }, [tab, color, canCurve]);

  const tier = pickCurveTier(tiers, curves);
  const curvePricePerUnit = tier?.price_per_unit ?? wholesalePrice;
  const unitsPerCurve = itemsPerCurve(dist, product, color);
  const curveTotalUnits = curves * unitsPerCurve;
  const curveTotal = curveTotalUnits * curvePricePerUnit;
  const curveStockOk = color ? curveHasStock(product, color, curves, dist) : false;

  const needColor = colors.length > 0;
  const sueltoReady = (!needColor || !!color) && !!size && sizeStock(product, size ?? '', color) > 0 && wholesalePrice > 0;
  const curvaReady = (!needColor || !!color) && canCurve && curveStockOk && curves >= 1;

  const flashAdded = () => {
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  };

  const addSuelto = () => {
    if (!sueltoReady || !size) return;
    const v = product.product_variants.find((x) => x.size === size && x.color === color);
    if (!v) return;
    addItem({
      product_id: product.id,
      variant_id: v.id,
      name: product.name,
      size: v.size,
      color: v.color,
      unit_price: wholesalePrice,
      qty,
      image_url: v.image_url ?? fallbackImg,
      source: 'suelto',
    });
    flashAdded();
  };

  const addCurva = () => {
    if (!curvaReady) return;
    const expanded = expandCurve(product, color, curves, dist);
    if (expanded.length === 0) return;
    for (const { variant, qty: vqty } of expanded) {
      addItem({
        product_id: product.id,
        variant_id: variant.id,
        name: product.name,
        size: variant.size,
        color: variant.color,
        unit_price: curvePricePerUnit,
        qty: vqty,
        image_url: variant.image_url ?? fallbackImg,
        source: 'curva',
        curves,
      });
    }
    flashAdded();
  };

  const inquiry = buildWhatsappInquiry(config, product.name);

  return (
    <div className="space-y-5">
      {/* Tabla de precios escalonados */}
      <WholesalePriceTable wholesalePrice={wholesalePrice} tiers={tiers} variant="detail" />

      {/* Tabs de modo de compra */}
      {curveTabAvailable && (
        <div className="flex w-full rounded-lg bg-secondary p-1">
          {([['sueltos', 'Suelto'], ['curva', 'Por curva']] as const).map(([t, label]) => {
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md py-2 text-[13px] font-semibold uppercase tracking-wide transition-colors ${
                  active ? 'bg-primary text-on-primary' : 'text-muted hover:text-text'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Color (siempre primero) */}
      {needColor && (
        <ColorSelector
          colors={colors}
          selected={color}
          onSelect={(c) => {
            setColor(c);
            setSize(null);
          }}
        />
      )}

      {tab === 'sueltos' ? (
        <>
          {sizes.length > 0 && (
            <SizeSelector sizes={sizes} selected={size} isDisabled={sizeDisabled} onSelect={setSize} />
          )}

          {/* Cantidad */}
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">Cantidad</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Restar"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-text disabled:opacity-30"
              >
                <Minus size={15} />
              </button>
              <span className="min-w-[2ch] text-center text-[15px] font-semibold text-text">{qty}</span>
              <button
                type="button"
                aria-label="Sumar"
                onClick={() => setQty((q) => q + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-text"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          {/* Total por talle */}
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">Total (por talle)</span>
            <span className="text-[20px] font-extrabold text-text">{formatPrice(wholesalePrice * qty)}</span>
          </div>

          <AddButton
            ready={sueltoReady}
            added={added}
            onClick={addSuelto}
            idleLabel={needColor && !color ? 'Elegí un color' : !size ? 'Elegí un talle' : 'Agregar al pedido'}
          />
        </>
      ) : (
        <>
          {/* Composición de la curva */}
          <p className="text-[12px] text-subtle">{curveCompositionText(dist, product, color)}</p>

          {/* Selector de cantidad de curvas */}
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">Curvas</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Restar curva"
                onClick={() => setCurves((c) => Math.max(1, c - 1))}
                disabled={curves <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-text disabled:opacity-30"
              >
                <Minus size={15} />
              </button>
              <span className="min-w-[5ch] text-center text-[15px] font-semibold text-text">
                {curves} {curves === 1 ? 'curva' : 'curvas'}
              </span>
              <button
                type="button"
                aria-label="Sumar curva"
                onClick={() => setCurves((c) => c + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-text"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          {/* Precio por unidad del tier activo + total */}
          <div className="flex items-center justify-between border-t border-line pt-3">
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">
                Total ({curves} {curves === 1 ? 'curva' : 'curvas'})
              </span>
              <span className="text-[11px] text-subtle">
                {curveTotalUnits} u. × {formatPrice(curvePricePerUnit)} c/u
              </span>
            </div>
            <span className="text-[20px] font-extrabold text-text">{formatPrice(curveTotal)}</span>
          </div>

          {color && !curveStockOk && (
            <p className="text-[12px] font-semibold text-red-600">SIN STOCK suficiente para esa curva en {color}</p>
          )}

          <AddButton
            ready={curvaReady}
            added={added}
            onClick={addCurva}
            idleLabel={needColor && !color ? 'Elegí un color' : !canCurve ? 'Sin stock para curva' : 'Agregar al pedido'}
          />
        </>
      )}

      {/* Promesa de envío */}
      {config.shippingPromiseEnabled && (
        <p className="flex items-center gap-2 text-[14px] text-text">
          <Truck size={17} className="text-accent" />
          <span className="font-semibold">{config.shippingPromiseTitle}</span>
          {config.shippingPromiseSubtitle && <span className="text-muted">· {config.shippingPromiseSubtitle}</span>}
        </p>
      )}

      {inquiry && (
        <a
          href={inquiry}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] border-2 border-[#25D366] py-[14px] text-[14px] font-bold uppercase tracking-[0.5px] text-[#25D366] transition-colors hover:bg-[#25D366] hover:text-white"
        >
          Consultar por WhatsApp
        </a>
      )}
    </div>
  );
}

function AddButton({
  ready,
  added,
  onClick,
  idleLabel,
}: {
  ready: boolean;
  added: boolean;
  onClick: () => void;
  idleLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!ready || added}
      className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary py-[18px] text-[16px] font-bold uppercase tracking-[0.5px] text-on-primary transition-all duration-200 hover:bg-accent hover:text-on-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary disabled:hover:text-on-primary"
      style={added ? { background: '#27ae60', color: '#fff' } : undefined}
    >
      {added ? '✓ Agregado al pedido' : idleLabel}
    </button>
  );
}
