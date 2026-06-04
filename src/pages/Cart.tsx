import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/lib/utils';

export function Cart() {
  const { items, updateQty, removeItem, subtotal, clear } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-5 px-6 py-24 text-center">
        <ShoppingBag size={56} className="text-subtle" />
        <h1 className="font-heading text-[28px] font-semibold uppercase tracking-[1px] text-text">Tu carrito está vacío</h1>
        <Link to="/productos" className="rounded-[10px] bg-primary px-8 py-3.5 text-[14px] font-bold uppercase tracking-[0.5px] text-on-primary transition-all hover:bg-accent hover:text-on-accent">
          Ver productos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10 md:py-14">
      <h1 className="mb-8 font-heading text-[32px] font-semibold uppercase tracking-[1px] text-text md:text-[40px]">Tu carrito</h1>

      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div>
          {items.map((item) => (
            <div key={item.variant_id} className="flex gap-4 border-b border-line py-5">
              <div className="h-28 w-24 shrink-0 overflow-hidden bg-secondary">
                {item.image_url && <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />}
              </div>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-semibold text-text">{item.name}</p>
                    {(item.color || item.size) && (
                      <p className="text-[12px] text-subtle">{[item.color, item.size].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                  <button aria-label="Eliminar" onClick={() => removeItem(item.variant_id)} className="text-subtle hover:text-accent">
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center border border-line">
                    <button aria-label="Restar" className="px-3 py-1.5 hover:text-accent" onClick={() => updateQty(item.variant_id, item.qty - 1)}>
                      <Minus size={14} />
                    </button>
                    <span className="min-w-[2.5rem] text-center text-[14px]">{item.qty}</span>
                    <button aria-label="Sumar" className="px-3 py-1.5 hover:text-accent" onClick={() => updateQty(item.variant_id, item.qty + 1)}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="text-[16px] font-bold text-text">{formatPrice(item.unit_price * item.qty)}</span>
                </div>
              </div>
            </div>
          ))}
          <button onClick={clear} className="mt-4 text-[12px] uppercase tracking-wide text-subtle hover:text-accent">
            Vaciar carrito
          </button>
        </div>

        <aside className="h-fit border border-line p-6">
          <h2 className="mb-4 font-heading text-[18px] font-bold uppercase tracking-[0.5px] text-text">Resumen</h2>
          <div className="flex items-center justify-between border-b border-line pb-4">
            <span className="text-[14px] text-muted">Subtotal</span>
            <span className="text-[20px] font-extrabold text-text">{formatPrice(subtotal)}</span>
          </div>
          <p className="py-4 text-[12px] text-subtle">El envío se coordina al finalizar la compra.</p>
          <Link
            to="/checkout"
            className="block w-full rounded-[10px] bg-accent py-4 text-center text-[14px] font-bold uppercase tracking-[0.5px] text-on-accent transition-all hover:scale-[1.01]"
          >
            Finalizar compra
          </Link>
          <Link to="/productos" className="mt-3 block text-center text-[12px] uppercase tracking-wide text-subtle hover:text-accent">
            Seguir comprando
          </Link>
        </aside>
      </div>
    </div>
  );
}
