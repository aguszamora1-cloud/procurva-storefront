import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/lib/utils';

export function CartDrawer() {
  const { items, isOpen, close, updateQty, removeItem, subtotal, itemCount } = useCart();

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
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-background transition-transform duration-300 sm:w-[420px] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="font-heading text-[24px] font-extrabold uppercase tracking-[-0.5px] text-text">
            Carrito {itemCount > 0 && <span className="text-subtle">({itemCount})</span>}
          </h2>
          <button type="button" onClick={close} className="text-[11px] tracking-wide text-subtle hover:text-accent">
            CERRAR
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[14px] text-subtle">Tu carrito está vacío.</p>
              <Link to="/productos" onClick={close} className="mt-5 inline-block border border-line px-6 py-3 text-[13px] font-semibold uppercase tracking-wide hover:border-text">
                Ver productos
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.variant_id} className="flex gap-3 border-b border-line py-4">
                <div className="h-24 w-20 shrink-0 overflow-hidden bg-secondary">
                  {item.image_url && <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />}
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[14px] font-semibold leading-snug text-text">{item.name}</p>
                    <button aria-label="Eliminar" onClick={() => removeItem(item.variant_id)} className="text-subtle hover:text-accent">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {(item.color || item.size) && (
                    <p className="text-[12px] text-subtle">{[item.color, item.size].filter(Boolean).join(' · ')}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="flex items-center border border-line">
                      <button aria-label="Restar" className="px-2 py-1 hover:text-accent" onClick={() => updateQty(item.variant_id, item.qty - 1)}>
                        <Minus size={14} />
                      </button>
                      <span className="min-w-[2rem] text-center text-[13px]">{item.qty}</span>
                      <button aria-label="Sumar" className="px-2 py-1 hover:text-accent" onClick={() => updateQty(item.variant_id, item.qty + 1)}>
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="text-[14px] font-bold text-text">{formatPrice(item.unit_price * item.qty)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-line px-6 py-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[1.5px] text-muted">Subtotal</span>
              <span className="text-[20px] font-extrabold text-text">{formatPrice(subtotal)}</span>
            </div>
            <Link
              to="/carrito"
              onClick={close}
              className="mb-2 block w-full border border-line py-3 text-center text-[13px] font-semibold uppercase tracking-wide hover:border-text"
            >
              Ver carrito
            </Link>
            <Link
              to="/checkout"
              onClick={close}
              className="block w-full rounded-[10px] bg-accent py-4 text-center text-[14px] font-bold uppercase tracking-[0.5px] text-on-accent transition-all hover:scale-[1.01]"
            >
              Finalizar compra
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
