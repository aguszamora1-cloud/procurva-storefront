import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useStore } from '@/context/StoreProvider';
import { formatPrice } from '@/lib/utils';
import { buildWhatsappOrder } from '@/lib/checkout';

export function CartDrawer() {
  const { items, isOpen, close, updateQty, removeItem, subtotal, itemCount } = useCart();
  const config = useStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    if (isOpen) {
      window.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  const checkoutHref = buildWhatsappOrder(config, items, subtotal);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={close} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-background shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-heading text-base font-bold uppercase tracking-tight">
            Tu carrito {itemCount > 0 && `(${itemCount})`}
          </h2>
          <button type="button" aria-label="Cerrar" onClick={close}>
            <X size={22} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingBag size={48} className="text-muted" />
            <p className="text-muted">Tu carrito está vacío.</p>
            <Link to="/productos" onClick={close} className="btn-outline px-6 py-3 text-sm">
              Ver productos
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.map((item) => (
                <div key={item.variant_id} className="flex gap-3 border-b border-line py-4">
                  <div className="h-20 w-16 shrink-0 overflow-hidden bg-secondary">
                    {item.image_url && (
                      <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <p className="product-title font-semibold">{item.name}</p>
                    <p className="text-xs text-muted">
                      {[item.color, item.size].filter(Boolean).join(' · ')}
                    </p>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center border border-line">
                        <button
                          type="button"
                          aria-label="Restar"
                          className="px-2 py-1"
                          onClick={() => updateQty(item.variant_id, item.qty - 1)}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-[2rem] text-center text-sm">{item.qty}</span>
                        <button
                          type="button"
                          aria-label="Sumar"
                          className="px-2 py-1"
                          onClick={() => updateQty(item.variant_id, item.qty + 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="price text-sm">{formatPrice(item.unit_price * item.qty)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Eliminar"
                    className="self-start text-muted hover:text-accent"
                    onClick={() => removeItem(item.variant_id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-line px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="subtitle-label">Subtotal</span>
                <span className="price text-lg">{formatPrice(subtotal)}</span>
              </div>
              <Link
                to="/carrito"
                onClick={close}
                className="mb-2 block w-full border border-line py-3 text-center text-sm font-semibold uppercase tracking-wide"
              >
                Ver carrito
              </Link>
              {checkoutHref && (
                <a
                  href={checkoutHref}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-accent block w-full py-3 text-center text-sm"
                >
                  Finalizar por WhatsApp
                </a>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
