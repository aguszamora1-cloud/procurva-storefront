import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { StoreImage } from './StoreImage';
import { formatPrice } from '@/lib/utils';
import { groupCartItems } from '@/lib/cart';

export function CartDrawer() {
  const { items, isOpen, close, updateQty, removeItem, subtotal, itemCount } = useCart();
  const rows = groupCartItems(items);

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
          <h2 className="font-heading text-[24px] font-extrabold tracking-[-0.5px] text-text">
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
              <Link to="/productos" onClick={close} className="mt-5 inline-block border border-line px-6 py-3 text-[13px] font-semibold hover:border-text">
                Ver productos
              </Link>
            </div>
          ) : (
            rows.map((row) => (
              <div key={row.key} className="flex gap-3 border-b border-line py-4">
                <div className="h-24 w-20 shrink-0 overflow-hidden bg-secondary">
                  {row.image && (
                    <StoreImage src={row.image} alt={row.name} transformWidth={160} width={80} height={96} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[14px] font-semibold leading-snug text-text">{row.name}</p>
                    <button aria-label="Eliminar" onClick={() => row.removeKeys.forEach(removeItem)} className="text-subtle hover:text-accent">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {row.detail && <p className="text-[12px] text-subtle">{row.detail}</p>}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    {row.editable ? (
                      <div className="flex items-center border border-line">
                        <button aria-label="Restar" className="px-2 py-1 hover:text-accent" onClick={() => updateQty(row.removeKeys[0], row.units - 1)}>
                          <Minus size={14} />
                        </button>
                        <span className="min-w-[2rem] text-center text-[13px]">{row.units}</span>
                        <button aria-label="Sumar" className="px-2 py-1 hover:text-accent" onClick={() => updateQty(row.removeKeys[0], row.units + 1)}>
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-subtle">{row.units} u.</span>
                    )}
                    <span className="text-[14px] font-bold text-text">{formatPrice(row.lineTotal)}</span>
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
              className="mb-2 block w-full border border-line py-3 text-center text-[13px] font-semibold hover:border-text"
            >
              Ver carrito
            </Link>
            <Link
              to="/checkout"
              onClick={close}
              className="block w-full rounded-[10px] bg-accent py-4 text-center text-[14px] font-bold text-on-accent transition-all hover:scale-[1.01]"
            >
              Finalizar compra
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
