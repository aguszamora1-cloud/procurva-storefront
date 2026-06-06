import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useStore, useStoreType } from '@/context/StoreProvider';
import { supabase } from '@/lib/supabase';
import { Seo } from '@/components/Seo';
import { Spinner } from '@/components/Spinner';
import { formatPrice } from '@/lib/utils';
import { groupCartItems } from '@/lib/cart';
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

/** Método de envío normalizado que consume el checkout. */
interface ShippingOption {
  id: string;
  name: string;
  /** true si el método necesita dirección (no es retiro en local). */
  requiresAddress: boolean;
  /** Dirección del local (sólo retiro). */
  pickupAddress?: string;
  /** Costo: 0 = gratis, >0 = fijo, null = a coordinar con la tienda. */
  cost: number | null;
  /** Tiempo estimado de entrega (opcional). */
  eta?: string;
}

// Métodos por defecto si el negocio no configuró ninguno (mismo criterio que el catálogo).
const FALLBACK_METHODS: ShippingOption[] = [
  { id: 'retiro', name: 'Retiro en local', requiresAddress: false, cost: 0, eta: 'Retirá en el local sin esperas' },
  { id: 'envio', name: 'Envío a domicilio', requiresAddress: true, cost: null },
];

/** Mapea un método crudo (companies.settings.shippingMethods) a ShippingOption. */
function toShippingOption(m: any): ShippingOption {
  const isPickup = m.isPickup === true || m.type === 'retiro';
  // Costo y tiempo estimado son opcionales en el modelo actual: se leen si el
  // negocio los cargó; si no, retiro = gratis y envío = a coordinar.
  const rawCost = m.cost ?? m.price ?? m.shipping_cost;
  const cost = isPickup ? 0 : typeof rawCost === 'number' ? rawCost : null;
  const rawEta = m.estimatedTime ?? m.eta ?? m.delivery_time ?? m.deliveryTime;
  const eta = typeof rawEta === 'string' && rawEta.trim()
    ? rawEta.trim()
    : isPickup
      ? 'Retirá en el local sin esperas'
      : undefined;
  return {
    id: String(m.id ?? m.name),
    name: String(m.name ?? 'Envío'),
    requiresAddress: !isPickup,
    pickupAddress: typeof m.pickupAddress === 'string' ? m.pickupAddress : undefined,
    cost,
    eta,
  };
}

export function Checkout() {
  const { items, subtotal, itemCount } = useCart();
  const config = useStore();
  const isWholesale = useStoreType() === 'wholesale';
  const minQty = isWholesale ? config.minOrderQuantity : 0;
  const minMissing = minQty > 0 ? Math.max(0, minQty - itemCount) : 0;
  const navigate = useNavigate();

  const [form, setForm] = useState<CustomerInfo>(emptyForm);
  const [floor, setFloor] = useState(''); // Piso / Depto (opcional)
  const [methods, setMethods] = useState<ShippingOption[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [loading, setLoading] = useState<null | 'mp' | 'wa'>(null);
  const [error, setError] = useState('');

  // Carga dinámica de los métodos de envío configurados por el negocio.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: rpcErr } = await supabase.rpc('get_catalog_shipping_methods', {
        p_company_id: config.companyId,
      });
      if (cancelled) return;
      if (rpcErr) console.error('[Checkout] error cargando métodos de envío:', rpcErr);
      const raw = Array.isArray(data) ? data : [];
      const active = raw.filter((m: any) => m && m.isActive !== false).map(toShippingOption);
      const list = active.length > 0 ? active : FALLBACK_METHODS;
      setMethods(list);
      setSelectedMethodId((prev) => (prev && list.some((m) => m.id === prev) ? prev : list[0]?.id ?? ''));
    })();
    return () => {
      cancelled = true;
    };
  }, [config.companyId]);

  const selectedMethod = useMemo(
    () => methods.find((m) => m.id === selectedMethodId) ?? null,
    [methods, selectedMethodId],
  );
  const requiresAddress = selectedMethod?.requiresAddress ?? false;

  // Costo conocido (número) vs "a coordinar" (null/sin método).
  const shippingKnown = typeof selectedMethod?.cost === 'number';
  const shippingCost = shippingKnown ? (selectedMethod!.cost as number) : 0;
  const orderTotal = subtotal + shippingCost;

  const seo = <Seo title={`Finalizar compra · ${config.name}`} slug={config.slug} noindex />;

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-5 px-6 py-24 text-center">
        {seo}
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
    if (!requiresAddress) {
      return { ...form, address: '', city: '', province: '', zip: '' };
    }
    const address = floor.trim()
      ? `${form.address}${form.address ? ', ' : ''}${floor.trim()}`
      : form.address;
    return { ...form, address };
  }

  function validate(requireEmail: boolean): string {
    if (minMissing > 0) return `Pedido mínimo: ${minQty} unidades. Te faltan ${minMissing} unidades.`;
    if (!form.name.trim()) return 'Ingresá tu nombre.';
    if (!form.phone.trim()) return 'Ingresá tu teléfono.';
    if (requireEmail && !form.email.trim()) return 'Para pagar con MercadoPago necesitamos tu email.';
    if (requiresAddress) {
      if (!form.address?.trim()) return 'Ingresá tu dirección de envío.';
      if (!form.city?.trim()) return 'Ingresá la ciudad.';
      if (!form.zip?.trim()) return 'Ingresá el código postal.';
      if (!form.province?.trim()) return 'Ingresá la provincia.';
    }
    return '';
  }

  async function handleMercadoPago() {
    const v = validate(true);
    if (v) { setError(v); return; }
    setLoading('mp');
    setError('');
    try {
      const customer = buildCustomer();
      const orderId = await createCatalogOrder(config, items, orderTotal, customer, 'MercadoPago');
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
    const href = buildWhatsappOrderWithCustomer(config, items, orderTotal, buildCustomer());
    if (!href) {
      setError('Esta tienda no tiene WhatsApp configurado.');
      setLoading(null);
      return;
    }
    window.open(href, '_blank', 'noopener');
    setLoading(null);
  }

  // text-[16px] evita el zoom automático de iOS al enfocar un input (<16px).
  const inputCls =
    'w-full rounded-[8px] border border-line bg-background px-3.5 py-2.5 text-[16px] text-text outline-none transition-colors focus:border-accent';

  const etaText = selectedMethod
    ? selectedMethod.requiresAddress
      ? selectedMethod.eta
        ? `📦 Llega en ${selectedMethod.eta}`
        : null
      : `🏪 ${selectedMethod.eta || 'Retirá en el local sin esperas'}`
    : null;

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10 md:py-14">
      {seo}
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

          {/* Método de envío — dinámico desde los ajustes del negocio */}
          <h2 className="mb-3 mt-8 font-heading text-[18px] font-bold uppercase tracking-[0.5px] text-text">Método de envío</h2>
          <div className="flex flex-wrap gap-2">
            {methods.map((m) => {
              const selected = m.id === selectedMethodId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setSelectedMethodId(m.id); setError(''); }}
                  className={`rounded-[8px] border px-4 py-2 text-[13px] font-semibold uppercase tracking-wide transition-colors ${
                    selected ? 'border-accent bg-accent text-on-accent' : 'border-line text-muted hover:border-text'
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>

          {/* Tiempo estimado / mensaje del método seleccionado */}
          {etaText && <p className="mt-3 text-[13px] font-medium text-text">{etaText}</p>}

          {/* Retiro en local: mostramos la dirección del local si está cargada */}
          {selectedMethod && !requiresAddress && selectedMethod.pickupAddress && (
            <p className="mt-1 text-[13px] text-muted">
              <span className="text-subtle">Retirás en: </span>
              <span className="font-medium text-text">{selectedMethod.pickupAddress}</span>
            </p>
          )}

          {/* Campos de dirección: sólo si el método requiere envío a domicilio */}
          {requiresAddress && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Dirección *</span>
                <input className={inputCls} value={form.address} onChange={set('address')} placeholder="Calle y número" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Piso / Depto</span>
                <input className={inputCls} value={floor} onChange={(e) => { setFloor(e.target.value); setError(''); }} placeholder="Opcional" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Ciudad *</span>
                <input className={inputCls} value={form.city} onChange={set('city')} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Provincia *</span>
                <input className={inputCls} value={form.province} onChange={set('province')} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Código postal *</span>
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
            {groupCartItems(items).map((row) => (
              <div key={row.key} className="flex items-start justify-between gap-3 text-[13px]">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-text">
                    {row.source === 'curva' ? row.detail : `${row.units}x ${row.name}`}
                  </p>
                  {row.source === 'curva' ? (
                    <p className="text-[11px] text-subtle">{row.name} · {row.units} u.</p>
                  ) : (
                    row.detail && <p className="text-[11px] text-subtle">{row.detail}</p>
                  )}
                </div>
                <span className="shrink-0 font-bold text-text">{formatPrice(row.lineTotal)}</span>
              </div>
            ))}
          </div>

          {minQty > 0 && (
            <p className={`pt-3 text-[12px] font-semibold ${minMissing === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {minMissing === 0
                ? `✓ Mínimo de compra alcanzado (${minQty} u.)`
                : `Pedido mínimo: ${minQty} unidades. Te faltan ${minMissing}.`}
            </p>
          )}

          {/* Subtotal + envío */}
          <div className="space-y-1 border-b border-line py-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted">Subtotal</span>
              <span className="text-[13px] font-semibold text-text">{formatPrice(subtotal)}</span>
            </div>
            {shippingKnown && (
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted">Envío</span>
                {shippingCost === 0 ? (
                  <span className="text-[13px] font-bold text-[#27ae60]">GRATIS</span>
                ) : (
                  <span className="text-[13px] font-bold text-text">{formatPrice(shippingCost)}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between py-4">
            <span className="text-[14px] text-muted">Total</span>
            <span className="text-[22px] font-extrabold text-text">{formatPrice(orderTotal)}</span>
          </div>
          {!shippingKnown && (
            <p className="mb-4 text-[12px] text-subtle">El costo de envío se coordina con la tienda.</p>
          )}

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
              {loading === 'mp' ? <><Spinner size={16} /> Redirigiendo…</> : 'Pagar con MercadoPago'}
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
              {loading === 'wa' ? <><Spinner size={16} /> Abriendo WhatsApp…</> : 'Pagar por WhatsApp'}
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
