import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useCartPromos } from '@/hooks/useCartPromos';
import { useCartCoupon } from '@/hooks/useCartCoupon';
import { useStore, useStoreType } from '@/context/StoreProvider';
import { StoreImage } from '@/components/StoreImage';
import { CouponCartBox } from '@/components/CouponCartBox';
import { FreeShippingProgress } from '@/components/FreeShippingProgress';
import { Seo } from '@/components/Seo';
import { formatPrice } from '@/lib/utils';
import { evalMinOrder } from '@/lib/cart';
import { cartAmountRows, cartSubtotalAmount, freeShippingBase } from '@/lib/cartAmounts';

export function Cart() {
  const { items, updateQty, removeItem, clear, itemCount } = useCart();
  const { byLine, adjustedSubtotal, quantitySavings, nudges } = useCartPromos();
  const config = useStore();
  const storeType = useStoreType() ?? 'retail';
  const isWholesale = storeType === 'wholesale';
  // El monto del mínimo se mide sobre el subtotal de mercadería (con promos por
  // cantidad, a precio de lista, sin envío) — el mismo número del "Subtotal".
  const min = evalMinOrder(config, isWholesale, itemCount, adjustedSubtotal);
  // Filas, subtotal y envío gratis con los MISMOS precios que cobra el checkout
  // (priceCartItems + cupón, ver lib/cartAmounts.ts). Con cupón aplicado, el
  // subtotal se muestra con el descuento y el de antes queda tachado.
  const coupon = useCartCoupon();
  const rows = cartAmountRows(items, coupon.pricedItems, byLine, config);
  const shownPair = cartSubtotalAmount(coupon, config);
  const seo = <Seo title={`Carrito · ${config.name}`} slug={config.slug} noindex />;

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-5 px-6 py-24 text-center">
        {seo}
        <ShoppingBag size={56} className="text-subtle" />
        <h1 className="font-heading text-[calc(28px_*_var(--font-scale,1))] font-semibold text-text">Tu carrito está vacío</h1>
        <Link to="/productos" className="rounded-button bg-primary px-8 py-3.5 text-[calc(14px_*_var(--font-scale,1))] font-bold text-on-primary transition-all hover:bg-accent hover:text-on-accent">
          Ver productos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10 md:py-14">
      {seo}
      <h1 className="mb-8 font-heading text-[calc(32px_*_var(--font-scale,1))] font-semibold text-text md:text-[calc(40px_*_var(--font-scale,1))]">Tu carrito</h1>

      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div>
          {rows.map(({ row, price }) => (
            <div key={row.key} className="flex gap-4 border-b border-line py-5">
              <div className="h-28 w-24 shrink-0 overflow-hidden bg-secondary">
                {row.image && (
                  <StoreImage src={row.image} alt={row.name} transformWidth={200} width={96} height={112} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[calc(15px_*_var(--font-scale,1))] font-semibold text-text">{row.name}</p>
                    {row.detail && <p className="text-[calc(12px_*_var(--font-scale,1))] text-subtle">{row.detail}</p>}
                  </div>
                  <button aria-label="Eliminar" onClick={() => row.removeKeys.forEach(removeItem)} className="text-subtle hover:text-accent">
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="mt-auto flex items-center justify-between pt-2">
                  {row.editable ? (
                    <div className="flex items-center border border-line">
                      <button aria-label="Restar" className="px-3 py-1.5 hover:text-accent" onClick={() => updateQty(row.removeKeys[0], row.units - 1)}>
                        <Minus size={14} />
                      </button>
                      <span className="min-w-[2.5rem] text-center text-[calc(14px_*_var(--font-scale,1))]">{row.units}</span>
                      <button aria-label="Sumar" className="px-3 py-1.5 hover:text-accent" onClick={() => updateQty(row.removeKeys[0], row.units + 1)}>
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[calc(13px_*_var(--font-scale,1))] font-semibold uppercase tracking-wide text-subtle">{row.units} unidades</span>
                  )}
                  {/* Escalones, promo por cantidad y línea normal con el precio que
                      cobra el checkout: contado protagonista y tarjeta secundaria (si
                      la tienda muestra las dos); tachado sólo con un descuento real. */}
                  {row.source !== 'tier' && price.strike == null && price.isCash ? (
                    // Línea normal sin descuento: igual que siempre.
                    <div className="text-right">
                      <span className="block text-[calc(16px_*_var(--font-scale,1))] font-bold text-accent">{formatPrice(price.big)}</span>
                      {price.small != null && (
                        <span className="mt-0.5 block text-[calc(12px_*_var(--font-scale,1))] text-subtle">
                          <span className="font-semibold">{formatPrice(price.small)}</span> {price.smallLabel}
                        </span>
                      )}
                    </div>
                  ) : row.source === 'tier' || price.strike != null ? (
                    <div className="text-right">
                      <span className="flex items-baseline justify-end gap-2">
                        {price.strike != null && <span className="text-[calc(13px_*_var(--font-scale,1))] text-subtle line-through">{formatPrice(price.strike)}</span>}
                        <span className="text-[calc(16px_*_var(--font-scale,1))] font-bold text-accent">{formatPrice(price.big)}</span>
                      </span>
                      {price.small != null && (
                        <span className="mt-0.5 block text-[calc(12px_*_var(--font-scale,1))] text-subtle">
                          <span className="font-semibold">{formatPrice(price.small)}</span> {price.smallLabel}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[calc(16px_*_var(--font-scale,1))] font-bold text-text">{formatPrice(price.big)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          <button onClick={clear} className="mt-4 text-[calc(12px_*_var(--font-scale,1))] text-subtle hover:text-accent">
            Vaciar carrito
          </button>
        </div>

        <aside className="h-fit border border-line p-6">
          <h2 className="mb-4 font-heading text-[calc(18px_*_var(--font-scale,1))] font-bold text-text">Resumen</h2>
          {nudges.map((n) => (
            <div key={n.key} className="mb-3 rounded-lg border border-dashed border-accent-a40 bg-accent-a05 px-3 py-2 text-[calc(12px_*_var(--font-scale,1))] font-semibold text-accent">
              Agregá {n.missing} más y ahorrá — {n.message}
            </div>
          ))}
          <div className="flex items-center justify-between border-b border-line pb-4">
            <span className="text-[calc(14px_*_var(--font-scale,1))] text-muted">Subtotal</span>
            <span className="text-right">
              {shownPair.strike != null && (
                <span className="block text-[calc(13px_*_var(--font-scale,1))] text-subtle line-through">{formatPrice(shownPair.strike)}</span>
              )}
              <span className="block text-[calc(20px_*_var(--font-scale,1))] font-extrabold text-accent">{formatPrice(shownPair.big)}</span>
              {shownPair.small != null && (
                <span className="mt-0.5 block text-[calc(12px_*_var(--font-scale,1))] text-subtle">
                  <span className="font-semibold">{formatPrice(shownPair.small)}</span> {shownPair.smallLabel}
                </span>
              )}
            </span>
          </div>
          {quantitySavings > 0 && (
            <p className="pt-3 text-right text-[calc(12px_*_var(--font-scale,1))] font-semibold text-accent">Ahorrás {formatPrice(quantitySavings)} por cantidad</p>
          )}
          {/* Cuánto falta para el envío gratis: contra el subtotal de mercadería
              más bajo de los que usa el checkout (contado, sin cupón), así lo que
              promete el carrito lo cumple el checkout con cualquier medio de pago. */}
          <FreeShippingProgress subtotal={freeShippingBase(coupon)} className="pt-4" />
          {/* Cupón: chip del guardado + campo para escribirlo sin esperar al checkout. */}
          <CouponCartBox
            items={coupon.pricedItems}
            storeType={storeType}
            hasNonStackablePromo={coupon.hasNonStackablePromo}
            className="mt-4"
          />
          {min.active && (
            <div className={`pt-4 text-[calc(12px_*_var(--font-scale,1))] font-semibold ${min.ok ? 'text-emerald-600' : 'text-amber-600'}`}>
              {min.ok ? (
                <p>✓ Mínimo de compra alcanzado</p>
              ) : (
                <div className="space-y-0.5">
                  {!min.unitsOk && (
                    <p>Pedido mínimo: {min.minUnits} unidades. Te faltan {min.missingUnits}.</p>
                  )}
                  {!min.amountOk && (
                    <p>Compra mínima: {formatPrice(min.minAmount)}. Te faltan {formatPrice(min.missingAmount)}.</p>
                  )}
                </div>
              )}
            </div>
          )}
          <p className="py-4 text-[calc(12px_*_var(--font-scale,1))] text-subtle">El envío se coordina al finalizar la compra.</p>
          {min.ok ? (
            <Link
              to="/checkout"
              className="block w-full rounded-button bg-accent py-4 text-center text-[calc(14px_*_var(--font-scale,1))] font-bold text-on-accent transition-all hover:scale-[1.01]"
            >
              Finalizar compra
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="block w-full cursor-not-allowed rounded-button bg-primary py-4 text-center text-[calc(14px_*_var(--font-scale,1))] font-bold text-on-primary opacity-40"
            >
              {!min.unitsOk ? `Faltan ${min.missingUnits} unidades` : `Faltan ${formatPrice(min.missingAmount)}`}
            </button>
          )}
          <Link to="/productos" className="mt-3 block text-center text-[calc(12px_*_var(--font-scale,1))] text-subtle hover:text-accent">
            Seguir comprando
          </Link>
        </aside>
      </div>
    </div>
  );
}
