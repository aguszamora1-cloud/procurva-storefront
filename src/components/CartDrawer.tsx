import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useCartPromos } from '@/hooks/useCartPromos';
import { useCartCoupon } from '@/hooks/useCartCoupon';
import { StoreImage } from './StoreImage';
import { ComplementaryBlock } from './ComplementaryBlock';
import { FreeShippingProgress } from './FreeShippingProgress';
import { CouponCartBox } from './CouponCartBox';
import { useStore, useStoreType } from '@/context/StoreProvider';
import { formatPrice } from '@/lib/utils';
import { cartAmountRows, cartSubtotalAmount, freeShippingBase } from '@/lib/cartAmounts';

export function CartDrawer() {
  const { items, isOpen, close, updateQty, removeItem, itemCount } = useCart();
  const { byLine, quantitySavings, nudges } = useCartPromos();
  const config = useStore();
  const storeType = useStoreType() ?? 'retail';
  // Filas, subtotal y envío gratis con los MISMOS precios que cobra el checkout
  // (priceCartItems + cupón, ver lib/cartAmounts.ts). Con cupón aplicado, el
  // subtotal se muestra con el descuento y el de antes queda tachado.
  const coupon = useCartCoupon();
  const rows = cartAmountRows(items, coupon.pricedItems, byLine, config);
  const shownPair = cartSubtotalAmount(coupon, config);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, close]);

  return (
    <>
      <div
        onClick={close}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role="dialog"
        aria-label="Carrito"
        className={`fixed right-0 top-0 z-50 flex h-dvh w-full flex-col bg-background transition-transform duration-300 sm:w-[420px] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="font-heading text-[calc(24px_*_var(--font-scale,1))] font-extrabold tracking-[-0.5px] text-text">
            Carrito {itemCount > 0 && <span className="text-subtle">({itemCount})</span>}
          </h2>
          <button type="button" onClick={close} className="text-[calc(11px_*_var(--font-scale,1))] tracking-wide text-subtle hover:text-accent">
            CERRAR
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[calc(14px_*_var(--font-scale,1))] text-subtle">Tu carrito está vacío.</p>
              <Link to="/productos" onClick={close} className="mt-5 inline-block border border-line px-6 py-3 text-[calc(13px_*_var(--font-scale,1))] font-semibold hover:border-text">
                Ver productos
              </Link>
            </div>
          ) : (
            rows.map(({ row, price }) => (
              <div key={row.key} className="flex gap-3 border-b border-line py-4">
                <div className="h-24 w-20 shrink-0 overflow-hidden bg-secondary">
                  {row.image && (
                    <StoreImage src={row.image} alt={row.name} transformWidth={160} width={80} height={96} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[calc(14px_*_var(--font-scale,1))] font-semibold leading-snug text-text">{row.name}</p>
                    <button aria-label="Eliminar" onClick={() => row.removeKeys.forEach(removeItem)} className="text-subtle hover:text-accent">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {row.detail && <p className="text-[calc(12px_*_var(--font-scale,1))] text-subtle">{row.detail}</p>}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    {row.editable ? (
                      <div className="flex items-center border border-line">
                        <button aria-label="Restar" className="px-2 py-1 hover:text-accent" onClick={() => updateQty(row.removeKeys[0], row.units - 1)}>
                          <Minus size={14} />
                        </button>
                        <span className="min-w-[2rem] text-center text-[calc(13px_*_var(--font-scale,1))]">{row.units}</span>
                        <button aria-label="Sumar" className="px-2 py-1 hover:text-accent" onClick={() => updateQty(row.removeKeys[0], row.units + 1)}>
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[calc(12px_*_var(--font-scale,1))] font-semibold uppercase tracking-wide text-subtle">{row.units} u.</span>
                    )}
                    {/* Escalones, promo por cantidad y línea normal con el precio que
                        cobra el checkout: contado protagonista y tarjeta secundaria (si
                        la tienda muestra las dos); tachado sólo con un descuento real. */}
                    {row.source !== 'tier' && price.strike == null && price.isCash ? (
                      // Línea normal sin descuento: igual que siempre.
                      <div className="text-right">
                        <span className="text-[calc(14px_*_var(--font-scale,1))] font-bold text-accent">{formatPrice(price.big)}</span>
                        {price.small != null && (
                          <span className="mt-0.5 block text-[calc(11px_*_var(--font-scale,1))] text-subtle">
                            <span className="font-semibold">{formatPrice(price.small)}</span> {price.smallLabel}
                          </span>
                        )}
                      </div>
                    ) : row.source === 'tier' || price.strike != null ? (
                      <div className="text-right">
                        <span className="flex items-baseline justify-end gap-1.5">
                          {price.strike != null && <span className="text-[calc(12px_*_var(--font-scale,1))] text-subtle line-through">{formatPrice(price.strike)}</span>}
                          <span className="text-[calc(14px_*_var(--font-scale,1))] font-bold text-accent">{formatPrice(price.big)}</span>
                        </span>
                        {price.small != null && (
                          <span className="mt-0.5 block text-[calc(11px_*_var(--font-scale,1))] text-subtle">
                            <span className="font-semibold">{formatPrice(price.small)}</span> {price.smallLabel}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[calc(14px_*_var(--font-scale,1))] font-bold text-text">{formatPrice(price.big)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Complementarios del carrito (cross-selling): resueltos de todos los
              ítems, dedup, excluyendo lo que ya está. Se autooculta si no hay nada. */}
          {items.length > 0 && <ComplementaryBlock contexto="carrito" className="my-4" />}
        </div>

        {items.length > 0 && (
          <div className="border-t border-line px-6 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {/* Nudges: promos por cantidad a las que les falta poco para activarse. */}
            {nudges.map((n) => (
              <div key={n.key} className="mb-3 rounded-lg border border-dashed border-accent-a40 bg-accent-a05 px-3 py-2 text-[calc(12px_*_var(--font-scale,1))] font-semibold text-accent">
                Agregá {n.missing} más y ahorrá — {n.message}
              </div>
            ))}
            <div className="mb-4 flex items-start justify-between">
              <span className="mt-1 text-[calc(11px_*_var(--font-scale,1))] font-semibold uppercase tracking-[1.5px] text-muted">Subtotal</span>
              <div className="text-right">
                <span className="flex items-baseline justify-end gap-2">
                  {shownPair.strike != null && (
                    <span className="text-[calc(13px_*_var(--font-scale,1))] text-subtle line-through">{formatPrice(shownPair.strike)}</span>
                  )}
                  <span className="text-[calc(20px_*_var(--font-scale,1))] font-extrabold text-accent">{formatPrice(shownPair.big)}</span>
                </span>
                {shownPair.small != null && (
                  <p className="mt-0.5 text-[calc(11px_*_var(--font-scale,1))] text-subtle">
                    <span className="font-semibold">{formatPrice(shownPair.small)}</span> {shownPair.smallLabel}
                  </p>
                )}
              </div>
            </div>
            {quantitySavings > 0 && (
              <p className="-mt-3 mb-4 text-right text-[calc(12px_*_var(--font-scale,1))] font-semibold text-accent">Ahorrás {formatPrice(quantitySavings)}</p>
            )}
            {/* Cuánto falta para el envío gratis: acá es donde el cliente decide
                si suma una prenda más o si cierra el pedido. */}
            <FreeShippingProgress subtotal={freeShippingBase(coupon)} className="mb-4" />
            {/* Cupón: se puede cargar acá y llega aplicado al checkout. */}
            <CouponCartBox
              items={coupon.pricedItems}
              storeType={storeType}
              hasNonStackablePromo={coupon.hasNonStackablePromo}
              className="mb-4"
            />
            <Link
              to="/carrito"
              onClick={close}
              className="mb-2 block w-full border border-line py-3 text-center text-[calc(13px_*_var(--font-scale,1))] font-semibold hover:border-text"
            >
              Ver carrito
            </Link>
            <Link
              to="/checkout"
              onClick={close}
              className="block w-full rounded-button bg-accent py-4 text-center text-[calc(14px_*_var(--font-scale,1))] font-bold text-on-accent transition-all hover:scale-[1.01]"
            >
              Finalizar compra
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
