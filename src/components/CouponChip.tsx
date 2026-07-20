import { useState } from 'react';
import { Tag, Check, X, Copy } from 'lucide-react';
import { useCoupon } from '@/context/CouponContext';
import { usePromotions } from '@/context/PromotionsContext';
import { useStoreType } from '@/context/StoreProvider';
import { evaluateCouponForCart, computeDiscount } from '@/lib/coupons';
import type { CartItem, Product, StoreType } from '@/lib/types';
import { formatPrice, getPriceInfo } from '@/lib/utils';

interface Props {
  /** Items sobre los que se evalúa el descuento (en el checkout, ya con promos). */
  items: CartItem[];
  /** Modo de pago vigente para el precio base (contado vs tarjeta). */
  mode: 'cash' | 'card';
  storeType: StoreType;
  /** Si el carrito tiene una promo automática NO acumulable, el cupón se bloquea. */
  hasNonStackablePromo: boolean;
  /**
   * Mostrar el monto exacto del descuento (-$X). En el carrito va en false: el
   * monto real depende de las promos por cantidad y del modo de pago (que recién
   * se elige en el checkout), así que ahí solo decimos "aplicado" y el monto
   * exacto queda para el checkout. Default true.
   */
  showAmount?: boolean;
  className?: string;
}

/**
 * Chip tri-estado del cupón guardado (dos vistas del mismo estado que el input
 * manual del checkout). Estados:
 *  - Disponible: guardado pero no aplicado y aplicable → borde punteado, tocable.
 *  - Aplicado: fondo acento + check + monto, tocable para quitar.
 *  - No aplicable: gris, no tocable, con el motivo (mínimo / promo / alcance).
 * Si no hay cupón guardado o el canal no coincide, no renderiza nada.
 */
export function CouponChip({ items, mode, storeType, hasNonStackablePromo, showAmount = true, className = '' }: Props) {
  const { savedCoupon, couponRecord, setApplied } = useCoupon();
  if (!savedCoupon || !couponRecord) return null;

  const ev = evaluateCouponForCart(couponRecord, items, mode, storeType, hasNonStackablePromo);
  if (!ev.channelOk) return null; // canal equivocado → no mostrar

  const code = couponRecord.code.toUpperCase();

  // ── Aplicado ───────────────────────────────────────────────────────────────
  if (savedCoupon.applied) {
    const active = ev.discount > 0;
    return (
      <div
        className={`flex items-center justify-between gap-2 rounded-[8px] px-3 py-2 ${
          active ? 'bg-accent/10' : 'bg-amber-50'
        } ${className}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Check size={16} className={`shrink-0 ${active ? 'text-accent' : 'text-amber-600'}`} />
          {active ? (
            <p className="truncate text-[12px] font-bold text-accent">
              Cupón {code} aplicado{showAmount ? ` — -${formatPrice(ev.discount)}` : ''}
            </p>
          ) : (
            <p className="truncate text-[12px] font-semibold text-amber-700">
              {ev.reason === 'min'
                ? `Te faltan ${formatPrice(ev.missingForMin)} para usar ${code}`
                : `El cupón ${code} no aplica a este pedido`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setApplied(false)}
          aria-label="Quitar cupón"
          className="shrink-0 rounded-full p-1 text-current opacity-70 transition-opacity hover:opacity-100"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  // ── No aplicable (no tocable) ────────────────────────────────────────────────
  if (!ev.applicable) {
    let msg = `El cupón ${code} no aplica a este pedido`;
    if (ev.reason === 'nonstackable') msg = 'Ya tenés un descuento promocional aplicado';
    else if (ev.reason === 'min') msg = `Te faltan ${formatPrice(ev.missingForMin)} para usar este cupón`;
    else if (ev.reason === 'scope') msg = `El cupón ${code} no aplica a los productos de tu carrito`;
    return (
      <div
        className={`flex items-center gap-2 rounded-[8px] bg-secondary px-3 py-2 text-[12px] font-medium text-subtle ${className}`}
      >
        <Tag size={15} className="shrink-0" />
        <span className="truncate">{msg}</span>
      </div>
    );
  }

  // ── Disponible (tocable) ─────────────────────────────────────────────────────
  return (
    <button
      type="button"
      onClick={() => setApplied(true)}
      className={`flex w-full items-center gap-2 rounded-[8px] border border-dashed border-accent/50 bg-accent/5 px-3 py-2 text-left text-[12px] font-semibold text-accent transition-colors hover:bg-accent/10 ${className}`}
    >
      <Tag size={15} className="shrink-0" />
      <span className="truncate">Tenés un cupón: {code} — Tocá para aplicar</span>
      {showAmount && <span className="ml-auto shrink-0 font-bold">-{formatPrice(ev.discount)}</span>}
    </button>
  );
}

interface PdpProps {
  product: Product;
  /** El producto tiene una promo automática NO acumulable con cupones. */
  hasNonStackablePromo?: boolean;
  className?: string;
}

/**
 * Chip INFORMATIVO del cupón guardado en la ficha de producto (PDP). No aplica
 * nada — el cupón se aplica recién en el carrito/checkout —: solo muestra cuánto
 * pagarías por ESTE producto con el cupón, y un botón para copiar el código.
 *
 * El precio base es EXACTAMENTE el que PriceDisplay muestra como principal
 * (lista/tarjeta, o el promocional si hay promo automática vigente): se reusa
 * getPriceInfo + priceFor, sin reinventar el cálculo. El descuento se calcula con
 * computeDiscount() sobre ese precio.
 *
 * Casos (informativo): (a) aplicable → muestra el precio con cupón; (b) no alcanza
 * a este producto → oculto; (c) aplica pero falta el mínimo global → muestra el
 * precio + nota "desde $min"; (d) promo no acumulable → oculto; (e) canal
 * equivocado → oculto.
 */
export function CouponPdpChip({ product, hasNonStackablePromo = false, className = '' }: PdpProps) {
  const { savedCoupon, couponRecord } = useCoupon();
  const { priceFor } = usePromotions();
  const storeType = useStoreType() ?? 'retail';
  const [copied, setCopied] = useState(false);

  if (!savedCoupon || !couponRecord) return null;

  const { mainPrice } = getPriceInfo(product);
  if (mainPrice <= 0) return null;
  // Precio principal EXACTO de PriceDisplay (con promo automática si la hay).
  const basePrice = priceFor(mainPrice, product).finalPrice;

  // Carrito sintético de 1 unidad de este producto: reusa la evaluación (canal,
  // alcance, promo no acumulable). El mínimo se maneja aparte (es informativo).
  const synthItem = {
    product_id: product.id,
    variant_id: '',
    name: product.name,
    categories: product.categories,
    size: null,
    color: null,
    unit_price: basePrice,
    qty: 1,
    image_url: null,
  } as CartItem;

  const ev = evaluateCouponForCart(couponRecord, [synthItem], 'card', storeType, hasNonStackablePromo);
  // (e) canal, (d) promo no acumulable, (b) no alcanza al producto → oculto.
  if (!ev.channelOk) return null;
  if (ev.reason === 'nonstackable' || ev.reason === 'scope' || ev.reason === 'nodiscount') return null;

  const off = Math.round(computeDiscount(couponRecord, basePrice));
  if (off <= 0) return null;
  const code = couponRecord.code.toUpperCase();
  const isPercent = couponRecord.discount_type === 'percent';
  const discounted = Math.max(0, basePrice - off);
  // (c) aplica al producto pero todavía no se llegó al mínimo de compra global.
  const minNote = ev.reason === 'min' && (couponRecord.min_subtotal ?? 0) > 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(couponRecord.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard no disponible */
    }
  };

  return (
    <div className={`flex items-center gap-2.5 rounded-lg border border-dashed border-accent/50 bg-accent/5 px-3 py-2.5 ${className}`}>
      <Tag className="h-4 w-4 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-accent">
          {isPercent
            ? `Con el cupón ${code} pagás ${formatPrice(discounted)}`
            : `Con el cupón ${code}: ${formatPrice(couponRecord.discount_value)} de descuento`}
        </p>
        {minNote && (
          <p className="text-[11px] text-subtle">En compras desde {formatPrice(couponRecord.min_subtotal as number)}</p>
        )}
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label="Copiar código del cupón"
        className="flex shrink-0 items-center gap-1 rounded-[6px] px-2 py-1 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/10"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? '¡Copiado!' : 'Copiar'}
      </button>
    </div>
  );
}
