import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useCartPromos } from '@/hooks/useCartPromos';
import { useStore, useStoreType } from '@/context/StoreProvider';
import { StoreImage } from '@/components/StoreImage';
import { Seo } from '@/components/Seo';
import { formatPrice } from '@/lib/utils';
import { groupCartItems } from '@/lib/cart';

export function Cart() {
  const { items, updateQty, removeItem, clear, itemCount } = useCart();
  const { byLine, adjustedSubtotal, quantitySavings, nudges } = useCartPromos();
  const config = useStore();
  const isWholesale = useStoreType() === 'wholesale';
  const minQty = isWholesale ? config.minOrderQuantity : 0;
  const minOk = minQty <= 0 || itemCount >= minQty;
  const rows = groupCartItems(items);
  const seo = <Seo title={`Carrito · ${config.name}`} slug={config.slug} noindex />;

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-5 px-6 py-24 text-center">
        {seo}
        <ShoppingBag size={56} className="text-subtle" />
        <h1 className="font-heading text-[28px] font-semibold text-text">Tu carrito está vacío</h1>
        <Link to="/productos" className="rounded-[10px] bg-primary px-8 py-3.5 text-[14px] font-bold text-on-primary transition-all hover:bg-accent hover:text-on-accent">
          Ver productos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10 md:py-14">
      {seo}
      <h1 className="mb-8 font-heading text-[32px] font-semibold text-text md:text-[40px]">Tu carrito</h1>

      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div>
          {rows.map((row) => (
            <div key={row.key} className="flex gap-4 border-b border-line py-5">
              <div className="h-28 w-24 shrink-0 overflow-hidden bg-secondary">
                {row.image && (
                  <StoreImage src={row.image} alt={row.name} transformWidth={200} width={96} height={112} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-semibold text-text">{row.name}</p>
                    {row.detail && <p className="text-[12px] text-subtle">{row.detail}</p>}
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
                      <span className="min-w-[2.5rem] text-center text-[14px]">{row.units}</span>
                      <button aria-label="Sumar" className="px-3 py-1.5 hover:text-accent" onClick={() => updateQty(row.removeKeys[0], row.units + 1)}>
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[13px] font-semibold uppercase tracking-wide text-subtle">{row.units} unidades</span>
                  )}
                  {(() => {
                    const r = byLine.get(row.removeKeys[0]);
                    if (r?.active) {
                      return (
                        <span className="flex items-baseline gap-2">
                          <span className="text-[13px] text-subtle line-through">{formatPrice(row.lineTotal)}</span>
                          <span className="text-[16px] font-bold text-accent">{formatPrice(r.unitPriceFinal * row.units)}</span>
                        </span>
                      );
                    }
                    return <span className="text-[16px] font-bold text-text">{formatPrice(row.lineTotal)}</span>;
                  })()}
                </div>
              </div>
            </div>
          ))}
          <button onClick={clear} className="mt-4 text-[12px] text-subtle hover:text-accent">
            Vaciar carrito
          </button>
        </div>

        <aside className="h-fit border border-line p-6">
          <h2 className="mb-4 font-heading text-[18px] font-bold text-text">Resumen</h2>
          {nudges.map((n) => (
            <div key={n.key} className="mb-3 rounded-lg border border-dashed border-accent/40 bg-accent/5 px-3 py-2 text-[12px] font-semibold text-accent">
              Agregá {n.missing} más y ahorrá — {n.message}
            </div>
          ))}
          <div className="flex items-center justify-between border-b border-line pb-4">
            <span className="text-[14px] text-muted">Subtotal</span>
            <span className="text-[20px] font-extrabold text-text">{formatPrice(adjustedSubtotal)}</span>
          </div>
          {quantitySavings > 0 && (
            <p className="pt-3 text-right text-[12px] font-semibold text-accent">Ahorrás {formatPrice(quantitySavings)} por cantidad</p>
          )}
          {minQty > 0 && (
            <p className={`pt-4 text-[12px] font-semibold ${minOk ? 'text-emerald-600' : 'text-amber-600'}`}>
              {minOk
                ? `✓ Mínimo de compra alcanzado (${minQty} u.)`
                : `Pedido mínimo: ${minQty} unidades. Te faltan ${minQty - itemCount}.`}
            </p>
          )}
          <p className="py-4 text-[12px] text-subtle">El envío se coordina al finalizar la compra.</p>
          {minOk ? (
            <Link
              to="/checkout"
              className="block w-full rounded-[10px] bg-accent py-4 text-center text-[14px] font-bold text-on-accent transition-all hover:scale-[1.01]"
            >
              Finalizar compra
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="block w-full cursor-not-allowed rounded-[10px] bg-primary py-4 text-center text-[14px] font-bold text-on-primary opacity-40"
            >
              Faltan {minQty - itemCount} unidades
            </button>
          )}
          <Link to="/productos" className="mt-3 block text-center text-[12px] text-subtle hover:text-accent">
            Seguir comprando
          </Link>
        </aside>
      </div>
    </div>
  );
}
