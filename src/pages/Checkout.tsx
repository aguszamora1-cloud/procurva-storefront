import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useStore } from '@/context/StoreProvider';
import { formatPrice } from '@/lib/utils';
import { buildWhatsappOrderWithCustomer } from '@/lib/checkout';
import { createCatalogOrder, startMercadoPagoCheckout, type CustomerInfo } from '@/lib/orders';

const emptyForm: CustomerInfo = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  province: '',
  zip: '',
  notes: '',
};

export function Checkout() {
  const { items, subtotal } = useCart();
  const config = useStore();
  const navigate = useNavigate();

  const [form, setForm] = useState<CustomerInfo>(emptyForm);
  const [withShipping, setWithShipping] = useState(false);
  const [loading, setLoading] = useState<null | 'mp' | 'wa'>(null);
  const [error, setError] = useState('');

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

  const set = (k: keyof CustomerInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setError('');
  };

  /** Datos del cliente listos para mandar (limpia campos de envío si es retiro). */
  function buildCustomer(): CustomerInfo {
    return withShipping
      ? form
      : { ...form, address: '', city: '', province: '', zip: '' };
  }

  function validate(requireEmail: boolean): string {
    if (!form.name.trim()) return 'Ingresá tu nombre.';
    if (!form.phone.trim()) return 'Ingresá tu teléfono.';
    if (requireEmail && !form.email.trim()) return 'Para pagar con MercadoPago necesitamos tu email.';
    if (withShipping && !form.address?.trim()) return 'Ingresá tu dirección de envío.';
    return '';
  }

  async function handleMercadoPago() {
    const v = validate(true);
    if (v) { setError(v); return; }
    setLoading('mp');
    setError('');
    try {
      const customer = buildCustomer();
      const orderId = await createCatalogOrder(config, items, subtotal, customer, 'MercadoPago');
      const initPoint = await startMercadoPagoCheckout(orderId);
      // Redirige a MercadoPago Checkout Pro. El carrito se limpia al volver a /checkout/success.
      window.location.href = initPoint;
    } catch (e: any) {
      setError(e?.message || 'Hubo un problema al iniciar el pago.');
      setLoading(null);
    }
  }

  function handleWhatsApp() {
    const v = validate(false);
    if (v) { setError(v); return; }
    setLoading('wa');
    const href = buildWhatsappOrderWithCustomer(config, items, subtotal, buildCustomer());
    if (!href) {
      setError('Esta tienda no tiene WhatsApp configurado.');
      setLoading(null);
      return;
    }
    window.open(href, '_blank', 'noopener');
    setLoading(null);
  }

  const inputCls =
    'w-full rounded-[8px] border border-line bg-background px-3.5 py-2.5 text-[14px] text-text outline-none transition-colors focus:border-accent';

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10 md:py-14">
      <h1 className="mb-8 font-heading text-[32px] font-semibold uppercase tracking-[1px] text-text md:text-[40px]">Finalizar compra</h1>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* Formulario */}
        <div>
          <h2 className="mb-4 font-heading text-[18px] font-bold uppercase tracking-[0.5px] text-text">Tus datos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Nombre *</span>
              <input className={inputCls} value={form.name} onChange={set('name')} placeholder="Tu nombre y apellido" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Teléfono *</span>
              <input className={inputCls} value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="11 1234 5678" />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Email {config.mercadopagoEnabled ? '*' : ''}</span>
              <input className={inputCls} value={form.email} onChange={set('email')} inputMode="email" placeholder="tu@email.com" />
            </label>
          </div>

          {/* Envío / retiro */}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setWithShipping(false); setError(''); }}
              className={`rounded-[8px] border px-4 py-2 text-[13px] font-semibold uppercase tracking-wide transition-colors ${
                !withShipping ? 'border-accent bg-accent text-on-accent' : 'border-line text-muted hover:border-text'
              }`}
            >
              Retiro en local
            </button>
            <button
              type="button"
              onClick={() => { setWithShipping(true); setError(''); }}
              className={`rounded-[8px] border px-4 py-2 text-[13px] font-semibold uppercase tracking-wide transition-colors ${
                withShipping ? 'border-accent bg-accent text-on-accent' : 'border-line text-muted hover:border-text'
              }`}
            >
              Envío a domicilio
            </button>
          </div>

          {withShipping && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Dirección *</span>
                <input className={inputCls} value={form.address} onChange={set('address')} placeholder="Calle y número" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Ciudad</span>
                <input className={inputCls} value={form.city} onChange={set('city')} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Provincia</span>
                <input className={inputCls} value={form.province} onChange={set('province')} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Código postal</span>
                <input className={inputCls} value={form.zip} onChange={set('zip')} inputMode="numeric" />
              </label>
            </div>
          )}

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Notas (opcional)</span>
            <textarea className={`${inputCls} min-h-[80px] resize-y`} value={form.notes} onChange={set('notes')} placeholder="Aclaraciones para tu pedido" />
          </label>
        </div>

        {/* Resumen + pago */}
        <aside className="h-fit border border-line p-6">
          <h2 className="mb-4 font-heading text-[18px] font-bold uppercase tracking-[0.5px] text-text">Tu pedido</h2>
          <div className="space-y-3 border-b border-line pb-4">
            {items.map((item) => (
              <div key={item.variant_id} className="flex items-start justify-between gap-3 text-[13px]">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-text">{item.qty}x {item.name}</p>
                  {(item.color || item.size) && (
                    <p className="text-[11px] text-subtle">{[item.color, item.size].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <span className="shrink-0 font-bold text-text">{formatPrice(item.unit_price * item.qty)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between py-4">
            <span className="text-[14px] text-muted">Total</span>
            <span className="text-[22px] font-extrabold text-text">{formatPrice(subtotal)}</span>
          </div>
          <p className="mb-4 text-[12px] text-subtle">El costo de envío se coordina con la tienda.</p>

          {error && (
            <p className="mb-3 rounded-[8px] bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{error}</p>
          )}

          {config.mercadopagoEnabled && (
            <button
              type="button"
              onClick={handleMercadoPago}
              disabled={loading !== null}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#009ee3] py-4 text-[14px] font-bold uppercase tracking-[0.5px] text-white transition-all hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {loading === 'mp' ? 'Redirigiendo…' : 'Pagar con MercadoPago'}
            </button>
          )}

          {config.whatsapp && (
            <button
              type="button"
              onClick={handleWhatsApp}
              disabled={loading !== null}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] border-2 border-[#25D366] py-[14px] text-[14px] font-bold uppercase tracking-[0.5px] text-[#25D366] transition-colors hover:bg-[#25D366] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19.4 4.6A10 10 0 0 0 4.1 17.3L3 21l3.8-1.1A10 10 0 1 0 19.4 4.6Zm-7.4 15.3a8 8 0 0 1-4.1-1.1l-.3-.2-2.3.7.7-2.3-.2-.3a8 8 0 1 1 6.2 3.2Zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.3.2-.3.6-1 .1-.1 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4 0-.6.3l-.6.7a3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.7 2.6 4.2 3.6 1.5.6 2.1.7 2.9.5.5-.1 1.4-.6 1.6-1.2.2-.5.2-1 .2-1.1-.1-.1-.2-.1-.4-.2Z" />
              </svg>
              {loading === 'wa' ? 'Abriendo WhatsApp…' : 'Pagar por WhatsApp'}
            </button>
          )}

          {!config.mercadopagoEnabled && !config.whatsapp && (
            <p className="text-[13px] text-subtle">Esta tienda todavía no tiene medios de pago configurados.</p>
          )}

          <button onClick={() => navigate('/carrito')} className="mt-4 block w-full text-center text-[12px] uppercase tracking-wide text-subtle hover:text-accent">
            Volver al carrito
          </button>
        </aside>
      </div>
    </div>
  );
}
