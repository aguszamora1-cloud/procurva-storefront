import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, X } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useCartPromos } from '@/hooks/useCartPromos';
import { useStore, useStoreType } from '@/context/StoreProvider';
import { supabase } from '@/lib/supabase';
import { Seo } from '@/components/Seo';
import { Spinner } from '@/components/Spinner';
import { formatPrice } from '@/lib/utils';
import { cartLineKey, groupCartItems } from '@/lib/cart';
import { applyPromoToPrice } from '@/lib/promotions';
import { buildWhatsappOrderWithCustomer } from '@/lib/checkout';
import { createCatalogOrder, startMercadoPagoCheckout, type CustomerInfo } from '@/lib/orders';
import { expandMethod, methodCoversPostalCode, normalizePostalCode, type ShippingOption } from '@/lib/shipping';
import { validateCoupon, registerCouponUse, computeDiscount, type CouponRecord } from '@/lib/coupons';

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

// Método por defecto si el negocio no configuró ninguno: SÓLO envío a domicilio.
// No incluimos "Retiro en local" como fallback: el retiro debe aparecer
// únicamente si el negocio lo configuró explícitamente y activo
// (isPickup: true). Mostrarlo por defecto hacía que llegaran pedidos como
// "Retiro" sin dirección en tiendas que no ofrecen retiro.
const FALLBACK_METHODS: ShippingOption[] = [
  { id: 'envio', name: 'Envío a domicilio', requiresAddress: true, cost: null, icon: '🚚', description: 'Envío a todo el país', coversAllPostalCodes: true, postalCodeRanges: [] },
];

export function Checkout() {
  const { items, subtotal, itemCount } = useCart();
  const { byLine } = useCartPromos();
  const config = useStore();
  const storeType = useStoreType();
  const isWholesale = storeType === 'wholesale';
  const effStoreType = storeType ?? 'retail';

  // Items con la promo POR CANTIDAD ya aplicada al precio (lo que se cobra y se
  // serializa en la orden). Las líneas activas bajan unit_price/unit_price_cash y
  // guardan el tracking en los campos promo_* existentes (sin migración).
  const pricedItems = useMemo(
    () =>
      items.map((it) => {
        const r = byLine.get(cartLineKey(it));
        if (!r?.active || !r.promo) return it;
        const cardBase = it.unit_price_original ?? it.unit_price;
        const newCard = Math.min(it.unit_price, applyPromoToPrice(cardBase, r.promo, effStoreType));
        const hasCash = typeof it.unit_price_cash === 'number';
        const cashBase = hasCash ? (it.unit_price_cash as number) : cardBase;
        const newCash = Math.min(cashBase, applyPromoToPrice(cashBase, r.promo, effStoreType));
        return {
          ...it,
          unit_price: newCard,
          ...(hasCash ? { unit_price_cash: newCash } : {}),
          unit_price_original: cardBase,
          promo_id: r.promo.id,
          promo_name: r.promo.name,
          promo_stackable: r.promo.stackable_with_coupons !== false,
        };
      }),
    [items, byLine, effStoreType],
  );

  // Subtotal de tarjeta/lista ya con las promos por cantidad aplicadas.
  const cardSubtotal = useMemo(() => pricedItems.reduce((s, i) => s + i.unit_price * i.qty, 0), [pricedItems]);
  const minQty = isWholesale ? config.minOrderQuantity : 0;
  const minMissing = minQty > 0 ? Math.max(0, minQty - itemCount) : 0;
  const navigate = useNavigate();

  const [form, setForm] = useState<CustomerInfo>(emptyForm);
  const [floor, setFloor] = useState(''); // Piso / Depto (opcional)
  const [methods, setMethods] = useState<ShippingOption[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [cpInput, setCpInput] = useState(''); // CP que el cliente está tipeando
  const [appliedCp, setAppliedCp] = useState(''); // CP confirmado ('' = todavía no calculó)
  const [loading, setLoading] = useState<null | 'mp' | 'wa'>(null);
  const [error, setError] = useState('');

  // Método de pago elegido. 'transferencia'/'efectivo' = contado (con descuento si
  // hay); 'tarjeta' = precio de tarjeta. La tarjeta requiere Mercado Pago.
  type PayMethod = 'transferencia' | 'efectivo' | 'tarjeta';
  const mpEnabled = config.mercadopagoEnabled;
  const waEnabled = Boolean(config.whatsapp);
  // Métodos disponibles según lo que el negocio tenga configurado:
  //  - transferencia: contado; va a MP si está habilitado, si no se coordina por WhatsApp.
  //  - efectivo: contado; siempre se coordina por WhatsApp.
  //  - tarjeta: precio tarjeta; sólo si hay Mercado Pago.
  const payMethods = useMemo<PayMethod[]>(() => {
    const list: PayMethod[] = [];
    if (mpEnabled || waEnabled) list.push('transferencia');
    if (waEnabled) list.push('efectivo');
    if (mpEnabled) list.push('tarjeta');
    return list;
  }, [mpEnabled, waEnabled]);
  const [payMethod, setPayMethod] = useState<PayMethod>('transferencia');

  // Si el método elegido deja de estar disponible, caé al primero disponible.
  useEffect(() => {
    setPayMethod((prev) => (payMethods.includes(prev) ? prev : payMethods[0] ?? 'transferencia'));
  }, [payMethods]);

  // ¿El método actual se cobra online por Mercado Pago? tarjeta siempre; transferencia
  // si hay MP; efectivo nunca.
  const routing: 'mp' | 'wa' =
    payMethod === 'tarjeta' ? 'mp' : payMethod === 'transferencia' && mpEnabled ? 'mp' : 'wa';
  const priceMode: 'cash' | 'card' = payMethod === 'tarjeta' ? 'card' : 'cash';

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
      const active = raw.filter((m: any) => m && m.isActive !== false).flatMap(expandMethod);
      const list = active.length > 0 ? active : FALLBACK_METHODS;
      setMethods(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [config.companyId]);

  // ¿Hay métodos de envío a domicilio? Si sólo hay retiro en local no pedimos CP.
  const hasDeliveryMethods = useMemo(() => methods.some((m) => m.requiresAddress), [methods]);
  // El input de CP gatea los envíos: hasta no calcular no se muestra ningún método de envío.
  const showCpGate = hasDeliveryMethods && !appliedCp;

  // Métodos disponibles según el CP: retiro en local siempre; envíos sólo si cubren la zona.
  const cpNum = useMemo(() => (appliedCp ? normalizePostalCode(appliedCp) : null), [appliedCp]);
  const availableMethods = useMemo(() => {
    if (showCpGate) return [];
    return methods.filter((m) => methodCoversPostalCode(m, cpNum));
  }, [methods, cpNum, showCpGate]);

  // Mantené la selección si sigue disponible; si no, elegí la primera opción disponible.
  useEffect(() => {
    setSelectedMethodId((prev) =>
      availableMethods.some((m) => m.id === prev) ? prev : availableMethods[0]?.id ?? '',
    );
  }, [availableMethods]);

  // Ya calculó el CP pero ningún envío a domicilio cubre su zona (el retiro igual aparece).
  const noDeliveryForZone = !!appliedCp && hasDeliveryMethods && !availableMethods.some((m) => m.requiresAddress);

  const selectedMethod = useMemo(
    () => availableMethods.find((m) => m.id === selectedMethodId) ?? null,
    [availableMethods, selectedMethodId],
  );
  const requiresAddress = selectedMethod?.requiresAddress ?? false;

  function applyCp() {
    const cp = cpInput.trim();
    if (!normalizePostalCode(cp)) {
      setError('Ingresá un código postal válido.');
      return;
    }
    setAppliedCp(cp);
    setForm((f) => ({ ...f, zip: cp })); // reutilizamos el CP en la dirección — no lo pedimos dos veces
    setError('');
  }

  function changeCp() {
    setAppliedCp('');
    setError('');
  }

  // Subtotal de contado (efectivo/transferencia): usa unit_price_cash si existe.
  // `subtotal` (del carrito) es el de tarjeta/lista.
  const cashSubtotal = useMemo(
    () => pricedItems.reduce((s, i) => s + (typeof i.unit_price_cash === 'number' ? i.unit_price_cash : i.unit_price) * i.qty, 0),
    [pricedItems],
  );
  const itemsSubtotal = priceMode === 'cash' ? cashSubtotal : cardSubtotal;
  // % de descuento de contado respecto del precio de tarjeta (0 si no hay diferencia,
  // p.ej. en mayorista). Se muestra en las opciones de contado.
  const cashDiscountPct = cardSubtotal > cashSubtotal ? Math.round(((cardSubtotal - cashSubtotal) / cardSubtotal) * 100) : 0;

  // Subtotal SIN la promo por cantidad (precios originales), para mostrar el
  // "Descuento por cantidad" como una línea propia en el resumen.
  const rawCashSubtotal = useMemo(
    () => items.reduce((s, i) => s + (typeof i.unit_price_cash === 'number' ? i.unit_price_cash : i.unit_price) * i.qty, 0),
    [items],
  );
  const rawSubtotalForMode = priceMode === 'cash' ? rawCashSubtotal : subtotal;
  const quantitySavingsShown = Math.max(0, rawSubtotalForMode - itemsSubtotal);

  // ── Cupón de descuento ──────────────────────────────────────────────────
  // Si algún item lleva una promo automática NO acumulable, no se permiten
  // cupones (el descuento promocional ya está aplicado en el precio).
  const hasNonStackablePromo = useMemo(
    () => pricedItems.some((i) => i.promo_id && i.promo_stackable === false),
    [pricedItems],
  );
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponRecord | null>(null);
  const [couponStatus, setCouponStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [couponError, setCouponError] = useState('');

  // Costo conocido (número) vs "a coordinar" (null/sin método).
  const shippingKnown = typeof selectedMethod?.cost === 'number';
  const shippingCost = shippingKnown ? (selectedMethod!.cost as number) : 0;

  // Descuento recalculado en vivo contra el subtotal actual (cambia con el
  // método de pago: contado vs tarjeta). Si el subtotal cae por debajo de la
  // compra mínima del cupón, el descuento es 0 (sin romper nada).
  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.min_subtotal && itemsSubtotal < appliedCoupon.min_subtotal) return 0;
    return Math.round(computeDiscount(appliedCoupon, itemsSubtotal));
  }, [appliedCoupon, itemsSubtotal]);

  const orderTotal = Math.max(0, itemsSubtotal - discountAmount) + shippingCost;

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponStatus('loading');
    setCouponError('');
    const res = await validateCoupon(config.companyId, code, itemsSubtotal);
    if (!res.ok) {
      setAppliedCoupon(null);
      setCouponError(res.error);
      setCouponStatus('error');
      return;
    }
    setAppliedCoupon(res.applied.coupon);
    setCouponStatus('idle');
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError('');
    setCouponStatus('idle');
  }

  const seo = <Seo title={`Finalizar compra · ${config.name}`} slug={config.slug} noindex />;

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

  // Etiqueta legible del método elegido (se guarda en catalog_orders.payment_method
  // y se muestra en el mensaje de WhatsApp).
  const payLabel: 'Transferencia' | 'Efectivo' | 'Tarjeta' =
    payMethod === 'tarjeta' ? 'Tarjeta' : payMethod === 'transferencia' ? 'Transferencia' : 'Efectivo';

  // Acción única de pago: persiste el pedido y lo rutea a Mercado Pago o WhatsApp
  // según el método elegido. Para MP se pide email; create-preference necesita la
  // orden en 'pending' (por eso createCatalogOrder NO auto-confirma cuando viaMercadoPago).
  async function handlePay() {
    const v = validate(routing === 'mp');
    if (v) { setError(v); return; }
    setLoading(routing);
    setError('');
    try {
      const customer = buildCustomer();
      // Cupón aplicado (si hay y descuenta algo). El `orderTotal` ya viene con el
      // descuento restado; estos campos son para el desglose y el tracking.
      const discount =
        appliedCoupon && discountAmount > 0
          ? {
              coupon_code: appliedCoupon.code.toUpperCase(),
              discount_type: appliedCoupon.discount_type,
              discount_value: appliedCoupon.discount_value,
              discount_amount: discountAmount,
            }
          : null;
      // storeType puede ser null mientras resuelve el tenant; por defecto minorista.
      const orderId = await createCatalogOrder(
        config, pricedItems, orderTotal, customer, payLabel, storeType ?? 'retail',
        { priceMode, viaMercadoPago: routing === 'mp', discount },
      );

      // Registrá el uso del cupón (incrementa used_count + fila de tracking).
      if (discount && appliedCoupon) {
        await registerCouponUse(appliedCoupon.id, orderId, discountAmount);
      }

      if (routing === 'mp') {
        const initPoint = await startMercadoPagoCheckout(orderId);
        // Redirige a MercadoPago Checkout Pro. El carrito se limpia al volver a /checkout/success.
        window.location.href = initPoint;
        return;
      }

      // WhatsApp: el pedido ya quedó registrado (y auto-confirmado si el plan es
      // Profesional). Abrimos el chat con el detalle y mostramos la confirmación.
      const href = buildWhatsappOrderWithCustomer(config, pricedItems, orderTotal, customer, payLabel);
      if (href) window.open(href, '_blank', 'noopener');
      navigate(`/checkout/success?order=${orderId}`);
    } catch (e: any) {
      setError(e?.message || 'Hubo un problema al procesar tu pedido.');
      setLoading(null);
    }
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
      <h1 className="mb-8 font-heading text-[32px] font-semibold text-text md:text-[40px]">Finalizar compra</h1>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* Formulario */}
        <div>
          <h2 className="mb-4 font-heading text-[18px] font-bold text-text">Tus datos</h2>
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

          {/* Método de envío — gateado por código postal */}
          <h2 className="mb-3 mt-8 font-heading text-[18px] font-bold text-text">Método de envío</h2>

          {showCpGate ? (
            /* Paso 1: pedimos el CP antes de mostrar los envíos disponibles */
            <div className="max-w-[440px]">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Código postal</span>
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    value={cpInput}
                    onChange={(e) => { setCpInput(e.target.value); setError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCp(); } }}
                    inputMode="numeric"
                    placeholder="Ingresá tu código postal"
                  />
                  <button
                    type="button"
                    onClick={applyCp}
                    className="shrink-0 rounded-[8px] bg-primary px-5 text-[13px] font-bold text-on-primary transition-colors hover:bg-accent hover:text-on-accent"
                  >
                    Calcular envío
                  </button>
                </div>
              </label>
              <a
                href="https://www.correoargentino.com.ar/formularios/cpa"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-[12px] text-subtle underline hover:text-accent"
              >
                No sé mi código postal
              </a>
            </div>
          ) : (
            <>
              {/* CP confirmado: lo mostramos con opción de cambiarlo (recalcula los envíos) */}
              {appliedCp && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="text-muted">Enviando al CP</span>
                  <span className="font-semibold text-text">{appliedCp}</span>
                  <button type="button" onClick={changeCp} className="text-[12px] uppercase tracking-wide text-accent underline">Cambiar</button>
                </div>
              )}

              {/* Ningún envío cubre la zona — el retiro en local, si existe, igual aparece abajo */}
              {noDeliveryForZone && (
                <p className="mb-3 rounded-[8px] bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-800">
                  No hay envíos disponibles para tu zona. Contactanos por WhatsApp.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {availableMethods.map((m) => {
                  const selected = m.id === selectedMethodId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setSelectedMethodId(m.id); setError(''); }}
                      className={`rounded-[8px] border px-4 py-2 text-[13px] font-semibold transition-colors ${
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
            </>
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
            </div>
          )}

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Notas (opcional)</span>
            <textarea className={`${inputCls} min-h-[80px] resize-y`} value={form.notes} onChange={set('notes')} placeholder="Aclaraciones para tu pedido" />
          </label>
        </div>

        {/* Resumen + pago */}
        <aside className="h-fit border border-line p-6">
          <h2 className="mb-4 font-heading text-[18px] font-bold text-text">Tu pedido</h2>
          <div className="space-y-3 border-b border-line pb-4">
            {groupCartItems(pricedItems).map((row) => (
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

          {/* Cupón de descuento */}
          <div className="border-b border-line py-3">
            {hasNonStackablePromo ? (
              <div className="rounded-[8px] bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800">
                Este producto ya tiene un descuento promocional aplicado. No se puede combinar con cupones.
              </div>
            ) : appliedCoupon ? (
              <div
                className={`flex items-center justify-between gap-2 rounded-[8px] px-3 py-2 ${
                  discountAmount > 0 ? 'bg-emerald-50' : 'bg-amber-50'
                }`}
              >
                <div className="min-w-0">
                  {discountAmount > 0 ? (
                    <>
                      <p className="text-[12px] font-bold text-emerald-700">
                        Cupón {appliedCoupon.code.toUpperCase()} aplicado
                      </p>
                      <p className="text-[11px] text-emerald-600">
                        {appliedCoupon.discount_type === 'percent' ? `-${appliedCoupon.discount_value}% ` : ''}(-{formatPrice(discountAmount)})
                      </p>
                    </>
                  ) : (
                    <p className="text-[12px] font-semibold text-amber-700">
                      El cupón {appliedCoupon.code.toUpperCase()} no aplica a este monto.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={removeCoupon}
                  aria-label="Quitar cupón"
                  className="shrink-0 rounded-full p-1 text-current opacity-70 transition-opacity hover:opacity-100"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <p className="mb-2 text-[12px] font-semibold text-muted">¿Tenés un cupón de descuento?</p>
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }}
                    placeholder="NEWSLETTER10"
                    autoCapitalize="characters"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={couponStatus === 'loading' || !couponInput.trim()}
                    className="shrink-0 rounded-[8px] bg-primary px-5 text-[13px] font-bold text-on-primary transition-colors hover:bg-accent hover:text-on-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {couponStatus === 'loading' ? '…' : 'Aplicar'}
                  </button>
                </div>
                {couponError && <p className="mt-2 text-[12px] font-medium text-red-600">{couponError}</p>}
              </>
            )}
          </div>

          {/* Subtotal + descuento + envío */}
          <div className="space-y-1 border-b border-line py-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted">Subtotal</span>
              <span className="text-[13px] font-semibold text-text">{formatPrice(rawSubtotalForMode)}</span>
            </div>
            {quantitySavingsShown > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted">Descuento por cantidad</span>
                <span className="text-[13px] font-bold text-[#27ae60]">-{formatPrice(quantitySavingsShown)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted">
                  Descuento{appliedCoupon?.discount_type === 'percent' ? ` (${appliedCoupon.discount_value}%)` : ''}
                </span>
                <span className="text-[13px] font-bold text-[#27ae60]">-{formatPrice(discountAmount)}</span>
              </div>
            )}
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

          {/* Método de pago */}
          {payMethods.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-[13px] font-semibold text-text">Método de pago</p>
              <div className="space-y-2">
                {payMethods.map((m) => {
                  const selected = payMethod === m;
                  const isCash = m !== 'tarjeta';
                  const label = m === 'tarjeta' ? 'Tarjeta' : m === 'transferencia' ? 'Transferencia' : 'Efectivo';
                  const sub =
                    m === 'tarjeta'
                      ? config.cardPaymentText ||
                        (config.installmentsCount > 1 ? `Hasta ${config.installmentsCount} cuotas` : 'Pago con tarjeta')
                      : m === 'transferencia'
                        ? mpEnabled
                          ? 'Pago online con Mercado Pago'
                          : 'Coordinamos la transferencia por WhatsApp'
                        : 'Lo coordinamos por WhatsApp';
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setPayMethod(m); setError(''); }}
                      className={`flex w-full items-center justify-between gap-3 rounded-[10px] border px-4 py-3 text-left transition-colors ${selected ? 'border-accent bg-accent/5' : 'border-line hover:border-accent/50'}`}
                    >
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-text">{label}</span>
                        <span className="block text-[11px] leading-snug text-subtle">{sub}</span>
                      </span>
                      {isCash && cashDiscountPct > 0 && (
                        <span className="shrink-0 rounded bg-accent px-2 py-0.5 text-[10px] font-bold leading-none text-on-accent">
                          -{cashDiscountPct}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="mb-3 rounded-[8px] bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{error}</p>
          )}

          {payMethods.length > 0 ? (
            <button
              type="button"
              onClick={handlePay}
              disabled={loading !== null}
              className={`flex w-full items-center justify-center gap-2 rounded-[10px] py-4 text-[14px] font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 ${routing === 'mp' ? 'bg-[#009ee3] hover:scale-[1.01]' : 'bg-[#25D366] hover:brightness-105'}`}
            >
              {loading !== null ? (
                <><Spinner size={16} /> {routing === 'mp' ? 'Redirigiendo…' : 'Procesando…'}</>
              ) : routing === 'mp' ? (
                'Pagar con Mercado Pago'
              ) : (
                'Confirmar pedido por WhatsApp'
              )}
            </button>
          ) : (
            <p className="text-[13px] text-subtle">Esta tienda todavía no tiene medios de pago configurados.</p>
          )}

          <button onClick={() => navigate('/carrito')} className="mt-4 block w-full text-center text-[12px] text-subtle hover:text-accent">
            Volver al carrito
          </button>
        </aside>
      </div>
    </div>
  );
}
