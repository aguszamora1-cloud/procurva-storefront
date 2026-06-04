import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useStore } from '@/context/StoreProvider';
import { formatPrice } from '@/lib/utils';
import { buildWhatsappOrder } from '@/lib/checkout';

export function Cart() {
  const { items, updateQty, removeItem, subtotal, clear } = useCart();
  const config = useStore();
  const checkoutHref = buildWhatsappOrder(config, items, subtotal);

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-24 text-center">
        <ShoppingBag size={56} className="text-muted" />
        <h1 className="text-2xl">Tu carrito está vacío</h1>
        <Link to="/productos" className="btn-primary px-8 py-3.5 text-sm">
          Ver productos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-8 text-3xl">Tu carrito</h1>

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          {items.map((item) => (
            <div key={item.variant_id} className="flex gap-4 border-b border-line py-5">
              <div className="h-28 w-24 shrink-0 overflow-hidden bg-secondary">
                {item.image_url && (
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-muted">
                      {[item.color, item.size].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button
                    aria-label="Eliminar"
                    onClick={() => removeItem(item.variant_id)}
                    className="text-muted hover:text-accent"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center border border-line">
                    <button aria-label="Restar" className="px-3 py-1.5" onClick={() => updateQty(item.variant_id, item.qty - 1)}>
                      <Minus size={14} />
                    </button>
                    <span className="min-w-[2.5rem] text-center text-sm">{item.qty}</span>
                    <button aria-label="Sumar" className="px-3 py-1.5" onClick={() => updateQty(item.variant_id, item.qty + 1)}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="price">{formatPrice(item.unit_price * item.qty)}</span>
                </div>
              </div>
            </div>
          ))}
          <button onClick={clear} className="mt-4 text-xs uppercase tracking-wide text-muted hover:text-accent">
            Vaciar carrito
          </button>
        </div>

        <aside className="h-fit border border-line p-6">
          <h2 className="mb-4 text-lg">Resumen</h2>
          <div className="flex items-center justify-between border-b border-line pb-4">
            <span className="text-sm text-muted">Subtotal</span>
            <span className="price">{formatPrice(subtotal)}</span>
          </div>
          <p className="py-4 text-xs text-muted">El envío se coordina al finalizar la compra.</p>
          {checkoutHref ? (
            <a href={checkoutHref} target="_blank" rel="noreferrer" className="btn-accent block w-full py-4 text-center text-sm">
              Finalizar por WhatsApp
            </a>
          ) : (
            <p className="text-sm text-muted">Esta tienda no tiene WhatsApp configurado.</p>
          )}
          <Link to="/productos" className="mt-3 block text-center text-xs uppercase tracking-wide text-muted hover:text-accent">
            Seguir comprando
          </Link>
        </aside>
      </div>
    </div>
  );
}
