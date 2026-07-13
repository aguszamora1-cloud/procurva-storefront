import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, X, ArrowLeft, Plus, MapPin, Clock, PackageCheck, Info } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useCartPromos } from '@/hooks/useCartPromos';
import { useMetaPixel } from '@/hooks/useMetaPixel';
import { stashPendingPurchase } from '@/lib/metaPixel';
import { useStore, useStoreType } from '@/context/StoreProvider';
import { supabase } from '@/lib/supabase';
import { Seo } from '@/components/Seo';
import { Spinner } from '@/components/Spinner';
import { formatPrice } from '@/lib/utils';
import { cartLineKey, groupCartItems, evalMinOrder } from '@/lib/cart';
import { applyPromoToPrice } from '@/lib/promotions';
import { buildWhatsappOrderWithCustomer } from '@/lib/checkout';
import { createCatalogOrder, startMercadoPagoCheckout, startGoCuotasCheckout, type CustomerInfo } from '@/lib/orders';
import { expandMethod, hasOwnZoneCoverage, methodAvailableForPostalCode, normalizePostalCode, type ShippingOption } from '@/lib/shipping';
import { SHIPPING_ICONS } from '@/lib/shippingIcons';
import { validateCoupon, registerCouponUse, computeDiscount, eligibleSubtotal, eligibleItems, type CouponRecord } from '@/lib/coupons';

const emptyForm: CustomerInfo = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  province: '',
  zip: '',
  notes: '',
  deliveryTime: '',
};

// Prefill local por dispositivo (sin backend, cero PII expuesta): guardamos los
// datos REUTILIZABLES del cliente en localStorage tras una compra y autocompletamos
// el checkout al volver (mismo navegador). NO se guardan notas ni horario (son por
// pedido), ni la dirección con el piso ya fusionado. Clave por empresa.
interface SavedCustomer {
  name?: string; phone?: string; email?: string;
  address?: string; city?: string; province?: string; zip?: string; floor?: string;
}
const savedCustomerKey = (companyId: string) => `procurva_checkout_customer:${companyId}`;

function loadSavedCustomer(companyId: string): SavedCustomer | null {
  try {
    const raw = localStorage.getItem(savedCustomerKey(companyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as SavedCustomer) : null;
  } catch {
    return null;
  }
}

function saveCustomer(companyId: string, data: SavedCustomer): void {
  try {
    localStorage.setItem(savedCustomerKey(companyId), JSON.stringify(data));
  } catch {
    /* localStorage lleno o no disponible: ignorar (es solo conveniencia) */
  }
}

// Método por defecto si el negocio no configuró ninguno: SÓLO envío a domicilio.
// No incluimos "Retiro en local" como fallback: el retiro debe aparecer
// únicamente si el negocio lo configuró explícitamente y activo
// (isPickup: true). Mostrarlo por defecto hacía que llegaran pedidos como
// "Retiro" sin dirección en tiendas que no ofrecen retiro.
const FALLBACK_METHODS: ShippingOption[] = [
  { id: 'envio', name: 'Envío a domicilio', kind: 'home', requiresAddress: true, cost: null, icon: 'truck', description: 'Envío a todo el país', coversAllPostalCodes: true, postalCodeRanges: [] },
];

/** Etiqueta de precio por opción de entrega: 0 = "Gratis", null = "A coordinar", resto = precio. */
function shippingPriceLabel(cost: number | null): { text: string; free: boolean } {
  if (cost === 0) return { text: 'Gratis', free: true };
  if (cost == null) return { text: 'A coordinar', free: false };
  return { text: formatPrice(cost), free: false };
}

// Encabezado de sección numerado: círculo con el número + título + divider sutil.
// Liviano (sin card pesada), igual que pide el diseño mobile-first.
function SectionHeading({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent">
        {n}
      </span>
      <h2 className="font-heading text-[14px] font-bold uppercase tracking-wide text-text">{children}</h2>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function Checkout() {
  const { items, subtotal, itemCount } = useCart();
  const { byLine } = useCartPromos();
  const { trackInitiateCheckout } = useMetaPixel();
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
  // Mínimo de compra mayorista (unidades / monto / ambos). El monto se mide sobre
  // el subtotal de mercadería a precio de lista (cardSubtotal), sin envío.
  const min = evalMinOrder(config, isWholesale, itemCount, cardSubtotal);
  const navigate = useNavigate();

  // Meta Pixel: InitiateCheckout una sola vez al entrar al checkout con carrito.
  const initiateCheckoutFired = useRef(false);
  useEffect(() => {
    if (initiateCheckoutFired.current || items.length === 0) return;
    initiateCheckoutFired.current = true;
    trackInitiateCheckout({
      contentIds: Array.from(new Set(items.map((i) => i.product_id))),
      value: subtotal,
      numItems: itemCount,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, subtotal, itemCount]);

  // Prefill desde localStorage (cliente que ya compró en este dispositivo). Notas y
  // horario quedan vacíos siempre (son por pedido).
  const [form, setForm] = useState<CustomerInfo>(() => {
    const saved = loadSavedCustomer(config.companyId);
    if (!saved) return emptyForm;
    const { floor: _floor, ...rest } = saved;
    return { ...emptyForm, ...rest, notes: '', deliveryTime: '' };
  });
  const [floor, setFloor] = useState(() => loadSavedCustomer(config.companyId)?.floor ?? ''); // Piso / Depto (opcional)
  const [showNotes, setShowNotes] = useState(false); // Sección "Notas" colapsada por defecto
  const [methods, setMethods] = useState<ShippingOption[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [cpInput, setCpInput] = useState(''); // CP que el cliente está tipeando
  const [appliedCp, setAppliedCp] = useState(''); // CP confirmado ('' = todavía no calculó)
  const [loading, setLoading] = useState<null | 'mp' | 'wa' | 'gc'>(null);
  const [error, setError] = useState('');
  // Candado sincrónico anti doble-submit. `disabled={loading !== null}` no alcanza:
  // el estado recién deshabilita el botón tras el re-render, y un doble-tap en
  // mobile dispara onClick dos veces antes de eso => dos createCatalogOrder con
  // ids distintos => dos pedidos (y dos auto-confirm/descuentos de stock en plan
  // Profesional). Este ref bloquea el segundo handlePay en el mismo tick.
  const submitLockRef = useRef(false);

  // Método de pago elegido. 'transferencia'/'efectivo' = contado (con descuento si
  // hay); 'tarjeta' = precio de tarjeta. La tarjeta requiere Mercado Pago.
  // 'gocuotas' = cuotas sin interés con débito (precio de contado).
  // 'mp_cuenta' = dinero en cuenta de Mercado Pago (precio de contado, va a MP
  // restringido a saldo en cuenta). Requiere Mercado Pago.
  type PayMethod = 'transferencia' | 'efectivo' | 'tarjeta' | 'gocuotas' | 'mp_cuenta';
  const mpEnabled = config.mercadopagoEnabled;
  const gcEnabled = config.gocuotasEnabled;
  const waEnabled = Boolean(config.whatsapp);
  const transferAccount = config.transferAccount;
  // Métodos disponibles según lo que el negocio tenga configurado:
  //  - transferencia: contado; va a MP si está habilitado, si no se coordina por WhatsApp.
  //  - efectivo: contado; siempre se coordina por WhatsApp.
  //  - tarjeta: precio tarjeta; sólo si hay Mercado Pago.
  //  - mp_cuenta: contado (dinero en cuenta de MP); sólo si hay Mercado Pago.
  //  - gocuotas: contado (débito en cuotas sin interés); sólo si hay GoCuotas.
  const payMethods = useMemo<PayMethod[]>(() => {
    const list: PayMethod[] = [];
    if (mpEnabled || waEnabled) list.push('transferencia');
    if (waEnabled) list.push('efectivo');
    if (mpEnabled) list.push('mp_cuenta');
    if (mpEnabled) list.push('tarjeta');
    if (gcEnabled) list.push('gocuotas');
    return list;
  }, [mpEnabled, gcEnabled, waEnabled]);
  const [payMethod, setPayMethod] = useState<PayMethod>('transferencia');

  // Si el método elegido deja de estar disponible, caé al primero disponible.
  useEffect(() => {
    setPayMethod((prev) => (payMethods.includes(prev) ? prev : payMethods[0] ?? 'transferencia'));
  }, [payMethods]);

  // Transferencia bancaria directa: si el comercio configuró una cuenta destino con
  // datos, "Transferencia" pasa a modo manual (muestra los datos bancarios, el
  // pedido queda pendiente de pago, sin MP ni descuento de stock hasta el
  // comprobante). Sin cuenta con datos se mantiene el flujo anterior.
  const transferManual = payMethod === 'transferencia' && Boolean(transferAccount);

  // Ruteo del cobro: 'mp' (Mercado Pago), 'gc' (GoCuotas) o 'wa' (WhatsApp).
  // tarjeta -> MP siempre; mp_cuenta (dinero en cuenta) -> MP siempre;
  // gocuotas -> GoCuotas; transferencia con cuenta cargada -> manual (wa, sin
  // pasarela); transferencia sin cuenta -> MP si hay, si no WA; efectivo -> WA.
  const routing: 'mp' | 'gc' | 'wa' =
    payMethod === 'tarjeta' || payMethod === 'mp_cuenta'
      ? 'mp'
      : payMethod === 'gocuotas'
        ? 'gc'
        : transferManual
          ? 'wa'
          : payMethod === 'transferencia' && mpEnabled
            ? 'mp'
            : 'wa';
  // Sólo la tarjeta usa el precio de tarjeta; el resto (incluido dinero en
  // cuenta) va a precio de contado.
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

  // CP efectivo: el del calculador (appliedCp) o, si no, el que el cliente tipea en el
  // campo de dirección (form.zip). Así puede completar la dirección sin pasar por el
  // calculador cuando el envío es de cobertura total.
  const cpNum = useMemo(() => {
    const src = appliedCp || form.zip || '';
    return src.trim() ? normalizePostalCode(src) : null;
  }, [appliedCp, form.zip]);

  // ¿El método cubre todo el país? (transportadoras nacionales tipo Correo Argentino,
  // Vía Cargo). Esas son para envío a otras localidades y se ofrecen recién con el CP.
  const coversEverywhere = (m: ShippingOption) => m.coversAllPostalCodes || m.postalCodeRanges.length === 0;

  // Métodos disponibles: retiro en local SIEMPRE. Mientras el cliente no ingresó su CP
  // mostramos solo la logística propia / de zona acotada (cadete); las transportadoras
  // nacionales (Correo Argentino, Vía Cargo) aparecen recién cuando ingresa el CP, porque
  // son para envío a otras localidades. Con CP filtramos por zona: las de cobertura total
  // quedan para cualquier CP y la logística propia se oculta si el CP cae fuera de su zona.
  const availableMethods = useMemo(() => {
    // En la zona de reparto propio (cadete), se ocultan las transportadoras
    // nacionales (Correo Argentino / Vía Cargo): si llegamos con cadete, no las ofrecemos ahí.
    const ownZone = hasOwnZoneCoverage(methods, cpNum);
    return methods.filter((m) => {
      if (!m.requiresAddress) return true;         // retiro: no depende del CP
      if (!cpNum) return !coversEverywhere(m);      // sin CP: solo logística propia (zona acotada)
      return methodAvailableForPostalCode(m, cpNum, ownZone);
    });
  }, [methods, cpNum]);

  // Grupos del selector: "Retirar en el local" (retiro presencial, sin dirección) vs
  // "Envío" (el paquete viaja: domicilio + retiro en sucursal del correo). El predicado
  // es requiresAddress, así el grupo de retiro queda puro (solo puntos del negocio) y la
  // sucursal del correo —que igual viaja y se filtra por CP— cae en "Envío".
  const localPickupMethods = useMemo(() => availableMethods.filter((m) => !m.requiresAddress), [availableMethods]);
  const deliveryMethods = useMemo(() => availableMethods.filter((m) => m.requiresAddress), [availableMethods]);

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

  // Calculador de CP independiente: sólo cuando hay envíos a domicilio pero todavía no
  // hay uno seleccionado (ej.: la tienda sólo tiene envíos con zona acotada y hace falta
  // el CP para revelarlos). Si ya hay un método a domicilio elegido, el CP se completa en
  // el campo de la dirección, así que no mostramos el calculador aparte.
  const needsCpForDelivery = hasDeliveryMethods && !requiresAddress && !appliedCp && !(form.zip || '').trim();

  // Sólo es retiro en local cuando hay un método de retiro efectivamente elegido.
  // Si todavía no se calculó el envío (o el método es a domicilio) el horario es para RECIBIR.
  const isPickup = !!selectedMethod && !selectedMethod.requiresAddress;

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
  // p.ej. en mayorista). Se calcula SIEMPRE en vivo desde la diferencia entre el total
  // de tarjeta y el de contado del carrito actual: así el badge refleja el descuento
  // real (no depende de ningún campo de config que pueda estar mal cargado).
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
  // El descuento se calcula sobre el SUBTOTAL ELEGIBLE: si el cupón tiene alcance
  // acotado (productos/categorías), sólo descuenta sobre esos items; el resto se
  // cobra a precio normal. La compra mínima se evalúa sobre el subtotal total.
  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.min_subtotal && itemsSubtotal < appliedCoupon.min_subtotal) return 0;
    const elig = eligibleSubtotal(appliedCoupon, pricedItems, priceMode);
    return Math.round(computeDiscount(appliedCoupon, elig));
  }, [appliedCoupon, itemsSubtotal, pricedItems, priceMode]);

  // Productos del carrito alcanzados por el cupón (para el desglose cuando aplica
  // parcialmente). Vacío si el alcance es 'all'.
  const couponEligibleNames = useMemo(() => {
    if (!appliedCoupon || (appliedCoupon.applies_to ?? 'all') === 'all') return [];
    return Array.from(new Set(eligibleItems(appliedCoupon, pricedItems).map((it) => it.name)));
  }, [appliedCoupon, pricedItems]);
  const couponIsPartial = couponEligibleNames.length > 0 && couponEligibleNames.length < pricedItems.length;

  const orderTotal = Math.max(0, itemsSubtotal - discountAmount) + shippingCost;

  // Total que pagaría el cliente con un método de pago dado. Recalcula el
  // descuento del cupón contra el subtotal del modo (contado vs tarjeta) para
  // mostrar el total real en cada radio card del paso "Método de pago".
  const totalForMode = (mode: 'cash' | 'card') => {
    const sub = mode === 'cash' ? cashSubtotal : cardSubtotal;
    let disc = 0;
    if (appliedCoupon && !(appliedCoupon.min_subtotal && sub < appliedCoupon.min_subtotal)) {
      disc = Math.round(computeDiscount(appliedCoupon, eligibleSubtotal(appliedCoupon, pricedItems, mode)));
    }
    return Math.max(0, sub - disc) + shippingCost;
  };

  // Monto exacto a transferir: SIEMPRE el total de contado del método Transferencia
  // (recargo 0%), nunca el de tarjeta. Coincide con orderTotal cuando Transferencia
  // está seleccionada; lo calculamos explícito para el bloque y el mensaje de WhatsApp.
  const transferTotal = totalForMode('cash');


  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponStatus('loading');
    setCouponError('');
    const res = await validateCoupon(config.companyId, code, itemsSubtotal, {
      storeType: effStoreType,
      items: pricedItems,
      mode: priceMode,
    });
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
    if (!min.ok) {
      if (!min.unitsOk) return `Pedido mínimo: ${min.minUnits} unidades. Te faltan ${min.missingUnits} unidades.`;
      return `Compra mínima: ${formatPrice(min.minAmount)}. Te faltan ${formatPrice(min.missingAmount)}.`;
    }
    if (!form.name.trim()) return 'Ingresá tu nombre.';
    if (!form.phone.trim()) return 'Ingresá tu teléfono.';
    if (requireEmail && !form.email.trim()) return 'Para pagar online necesitamos tu email.';
    // El cliente tiene que elegir CÓMO recibe el pedido antes de pagar. El retiro en
    // local está siempre disponible (sin CP); los envíos a domicilio aparecen recién al
    // calcular el CP. Sin esto, quien ignora el CP completaba la compra sin método ni
    // dirección y el pedido entraba como "Retiro / sin dirección" aunque quisiera envío.
    if (availableMethods.length > 0 && !selectedMethod) {
      return 'Elegí un método de envío o retiro en local.';
    }
    // Tienda con envío a domicilio y CP sin calcular: no hay método para elegir todavía.
    // (Si ya calculó y la zona no tiene cobertura, no bloqueamos: el flujo lo manda a
    // coordinar por WhatsApp con el aviso "No hay envíos disponibles para tu zona".)
    if (needsCpForDelivery && availableMethods.length === 0) {
      return 'Ingresá tu código postal para calcular el envío.';
    }
    if (requiresAddress) {
      if (!form.address?.trim()) return 'Ingresá tu dirección de envío.';
      if (!form.city?.trim()) return 'Ingresá la ciudad.';
      if (!form.zip?.trim()) return 'Ingresá el código postal.';
      if (!form.province?.trim()) return 'Ingresá la provincia.';
    }
    if (!form.deliveryTime?.trim()) {
      return isPickup
        ? 'Indicá un horario para retirar el pedido.'
        : 'Indicá un horario para recibir el pedido.';
    }
    return '';
  }

  // Etiqueta legible del método elegido (se guarda en catalog_orders.payment_method
  // y se muestra en el mensaje de WhatsApp).
  const payLabel: 'Transferencia' | 'Efectivo' | 'Tarjeta' | 'GoCuotas' | 'Dinero en cuenta' =
    payMethod === 'tarjeta'
      ? 'Tarjeta'
      : payMethod === 'mp_cuenta'
        ? 'Dinero en cuenta'
        : payMethod === 'gocuotas'
          ? 'GoCuotas'
          : payMethod === 'transferencia'
            ? 'Transferencia'
            : 'Efectivo';

  // Acción única de pago: persiste el pedido y lo rutea a Mercado Pago, GoCuotas o
  // WhatsApp según el método elegido. Las pasarelas online (MP/GoCuotas) piden email
  // y necesitan la orden en 'pending' (por eso createCatalogOrder NO auto-confirma).
  async function handlePay() {
    // Candado sincrónico: si ya hay un submit en curso, ignorá el segundo click
    // (doble-tap mobile). Se libera solo en los caminos que NO navegan/redirigen
    // (error, o WhatsApp que abre pestaña y se queda en la página).
    if (submitLockRef.current) return;
    const v = validate(routing !== 'wa');
    if (v) { setError(v); return; }
    submitLockRef.current = true;
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
        { priceMode, viaMercadoPago: routing !== 'wa', discount, manualTransfer: transferManual },
      );

      // Prefill local: guardamos los datos reutilizables para autocompletar la
      // próxima compra desde este dispositivo (guardamos form.address SIN el piso
      // fusionado, y el piso aparte, para no duplicarlo al recargar).
      saveCustomer(config.companyId, {
        name: form.name, phone: form.phone, email: form.email,
        address: form.address, city: form.city, province: form.province, zip: form.zip,
        floor,
      });

      // Registrá el uso del cupón (incrementa used_count + fila de tracking).
      if (discount && appliedCoupon) {
        await registerCouponUse(appliedCoupon.id, orderId, discountAmount);
      }

      // Meta Pixel: dejamos lista la compra para disparar Purchase al volver de
      // la pasarela (MP/GoCuotas), que son los flujos que confirman pago. Sólo
      // si el tenant tiene pixel cargado. La transferencia directa y el cierre
      // por WhatsApp no confirman pago acá, así que no generan Purchase.
      const stashPurchaseForPixel = () => {
        if (!config.metaPixelId) return;
        stashPendingPurchase({
          orderId: String(orderId),
          value: Math.round(orderTotal),
          contentIds: Array.from(new Set(pricedItems.map((i) => i.product_id))),
          numItems: itemCount,
        });
      };

      if (routing === 'mp') {
        stashPurchaseForPixel();
        // Dinero en cuenta: restringimos el checkout de MP a saldo en cuenta
        // (sin tarjeta) porque cobra a precio de contado.
        const initPoint = await startMercadoPagoCheckout(orderId, payMethod === 'mp_cuenta');
        // Redirige a MercadoPago Checkout Pro. El carrito se limpia al volver a /checkout/success.
        window.location.href = initPoint;
        return;
      }

      if (routing === 'gc') {
        stashPurchaseForPixel();
        const urlInit = await startGoCuotasCheckout(orderId);
        // Redirige a la UI de GoCuotas. El carrito se limpia al volver a /checkout/success.
        window.location.href = urlInit;
        return;
      }

      // Transferencia bancaria directa: el pedido queda registrado (pendiente de
      // pago) y la confirmación se resuelve enteramente en la pantalla de éxito,
      // que muestra los datos para transferir + el monto. NO se abre WhatsApp:
      // el cliente transfiere y manda el comprobante por su cuenta.
      if (transferManual) {
        navigate(`/checkout/success?order=${orderId}&transfer=1&total=${Math.round(transferTotal)}`);
        return;
      }

      // Resto de métodos por WhatsApp (efectivo, o transferencia sin cuenta cargada):
      // el pedido ya quedó registrado y el mensaje cita el N° de pedido + el monto
      // para coordinar. Guardamos el slice por si el id no viene en UUID largo.
      const orderRef =
        typeof orderId === 'string' && orderId.length >= 8
          ? orderId.slice(0, 8).toUpperCase()
          : orderId
            ? String(orderId).toUpperCase()
            : undefined;
      const href = buildWhatsappOrderWithCustomer(config, pricedItems, orderTotal, customer, payLabel, orderRef);
      // NO abrimos WhatsApp acá con window.open: en mobile tapa la página (el
      // cliente no ve la confirmación y cree que falló → reintenta y duplica) y el
      // navegador suele bloquear el pop-up. En su lugar, llevamos al cliente a la
      // pantalla de éxito (que confirma "Pedido registrado" + N°) y ahí ofrecemos un
      // botón para enviar por WhatsApp: al ser un click real nunca se bloquea.
      if (href) {
        try { sessionStorage.setItem(`wa_order_${orderId}`, href); } catch { /* sessionStorage no disponible */ }
      }
      navigate(`/checkout/success?order=${orderId}&method=wa`);
    } catch (e: any) {
      setError(e?.message || 'Hubo un problema al procesar tu pedido.');
      setLoading(null);
      // Liberamos el candado para que pueda reintentar tras el error.
      submitLockRef.current = false;
    }
  }

  // text-[16px] evita el zoom automático de iOS al enfocar un input (<16px).
  const inputCls =
    'w-full rounded-[8px] border border-line bg-background px-3.5 py-2.5 text-[16px] text-text outline-none transition-colors focus:border-accent';
  const labelCls = 'text-[12px] font-semibold uppercase tracking-wide text-muted';

  // Card seleccionable de una opción de entrega. El detalle rico va dentro de la card
  // (dirección/horarios/listo para retiro; aclaración de sucursal), no en líneas sueltas.
  const renderMethodCard = (m: ShippingOption) => {
    const selected = m.id === selectedMethodId;
    const Icon = SHIPPING_ICONS[m.icon];
    const price = shippingPriceLabel(m.cost);
    return (
      <button
        key={m.id}
        type="button"
        onClick={() => { setSelectedMethodId(m.id); setError(''); }}
        className={`w-full rounded-[10px] border px-4 py-3 text-left transition-colors ${
          selected ? 'border-accent bg-accent/5' : 'border-line hover:border-text'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${selected ? 'text-accent' : 'text-muted'}`} />
            <div>
              <p className="text-[14px] font-semibold text-text">{m.name}</p>
              {m.kind !== 'local-pickup' && m.eta && (
                <p className="mt-0.5 text-[12px] text-muted">Llega en {m.eta}</p>
              )}
            </div>
          </div>
          <span className={`shrink-0 text-[14px] font-bold ${price.free ? 'text-[#27ae60]' : 'text-text'}`}>
            {price.text}
          </span>
        </div>

        {/* Retiro en el local: dirección, horarios y "listo para retirar" (cada línea si está cargada) */}
        {m.kind === 'local-pickup' && (m.pickupAddress || m.openingHours || m.readyTime) && (
          <div className="mt-2 space-y-1 pl-[30px]">
            {m.pickupAddress && (
              <p className="flex items-start gap-1.5 text-[12px] text-muted">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" /><span>{m.pickupAddress}</span>
              </p>
            )}
            {m.openingHours && (
              <p className="flex items-start gap-1.5 text-[12px] text-muted">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" /><span>{m.openingHours}</span>
              </p>
            )}
            {m.readyTime && (
              <p className="flex items-start gap-1.5 text-[12px] text-muted">
                <PackageCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" /><span>{m.readyTime}</span>
              </p>
            )}
          </div>
        )}

        {/* Retiro en sucursal del correo: el paquete viaja, no es inmediato. Lo aclaramos. */}
        {m.kind === 'branch' && (
          <p className="mt-2 flex items-start gap-1.5 pl-[30px] text-[12px] text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" />
            <span>El correo te avisa cuando tu pedido llega a la sucursal que elijas.</span>
          </p>
        )}
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-6 sm:px-6 md:py-12">
      {seo}

      {/* Volver al carrito */}
      <button
        onClick={() => navigate('/carrito')}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-subtle transition-colors hover:text-accent"
      >
        <ArrowLeft size={16} /> Volver al carrito
      </button>

      <h1 className="mb-7 font-heading text-[26px] font-semibold text-text sm:text-[34px] md:mb-9">Finalizar compra</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start lg:gap-12">
        {/* ───────── Columna izquierda: datos + envío + notas ───────── */}
        <div>
          {/* 1. Tus datos */}
          <SectionHeading n={1}>Tus datos</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Nombre *</span>
              <input className={inputCls} value={form.name} onChange={set('name')} placeholder="Tu nombre y apellido" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Teléfono *</span>
              <input className={inputCls} value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="11 1234 5678" />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className={labelCls}>Email {config.mercadopagoEnabled ? '*' : ''}</span>
              <input className={inputCls} value={form.email} onChange={set('email')} inputMode="email" placeholder="tu@email.com" />
            </label>
          </div>

          {/* 2. Envío — gateado por código postal */}
          <div className="mt-9">
            <SectionHeading n={2}>Envío</SectionHeading>

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

            {/* Métodos agrupados por tipo. Cada bloque se muestra SÓLO si el negocio tiene
                opciones de ese tipo (nada de secciones vacías). "Envío" incluye domicilio y
                retiro en sucursal del correo (ambos viajan y se filtran por CP); el retiro en
                el local aparece siempre, sin importar el CP. */}
            {availableMethods.length > 0 && (
              <div className="space-y-5">
                {deliveryMethods.length > 0 && (
                  <div>
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-subtle">Envío</p>
                    <div className="space-y-2">{deliveryMethods.map(renderMethodCard)}</div>
                  </div>
                )}
                {localPickupMethods.length > 0 && (
                  <div>
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-subtle">Retirar en el local</p>
                    <div className="space-y-2">{localPickupMethods.map(renderMethodCard)}</div>
                  </div>
                )}
              </div>
            )}

            {/* Código postal: revela los envíos a domicilio. NO bloquea el retiro en local. */}
            {needsCpForDelivery && (
              <div className="mt-3 max-w-[440px]">
                <label className="flex flex-col gap-1.5">
                  <span className={labelCls}>
                    {availableMethods.length > 0
                      ? '¿Preferís envío a domicilio? Ingresá tu código postal'
                      : 'Ingresá tu código postal para calcular el envío'}
                  </span>
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
                      Calcular
                    </button>
                  </div>
                </label>
                <a
                  href="https://www.correoargentino.com.ar/formularios/cpa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-[12px] text-subtle underline hover:text-accent"
                >
                  ¿No sabés tu código postal?
                </a>
              </div>
            )}

            {/* Campos de dirección: sólo si el método requiere envío a domicilio */}
            {requiresAddress && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className={labelCls}>Dirección *</span>
                  <input className={inputCls} value={form.address} onChange={set('address')} placeholder="Calle y número" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelCls}>Piso / Depto</span>
                  <input className={inputCls} value={floor} onChange={(e) => { setFloor(e.target.value); setError(''); }} placeholder="Opcional" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelCls}>Ciudad *</span>
                  <input className={inputCls} value={form.city} onChange={set('city')} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelCls}>Provincia *</span>
                  <input className={inputCls} value={form.province} onChange={set('province')} />
                </label>
                {/* Código postal: editable acá mismo. Si el cliente ya lo calculó arriba,
                    viene precargado; si no, lo completa acá (y recalcula la cobertura). */}
                <label className="flex flex-col gap-1.5">
                  <span className={labelCls}>Código postal *</span>
                  <input
                    className={inputCls}
                    value={form.zip}
                    onChange={(e) => { setForm((f) => ({ ...f, zip: e.target.value })); setError(''); }}
                    inputMode="numeric"
                    placeholder="Ej: 2000"
                  />
                </label>
              </div>
            )}

            {/* Horario para recibir / retirar — obligatorio, sirve para coordinar la entrega */}
            <label className="mt-4 flex flex-col gap-1.5">
              <span className={labelCls}>
                {isPickup ? 'Horario para retirar el pedido *' : 'Horario para recibir el pedido *'}
              </span>
              <input
                className={inputCls}
                value={form.deliveryTime}
                onChange={set('deliveryTime')}
                placeholder="Ej: de 9 a 13 hs, o después de las 18"
              />
            </label>
          </div>

          {/* 3. Notas (opcional) — colapsada por defecto */}
          <div className="mt-9">
            <SectionHeading n={3}>Notas (opcional)</SectionHeading>
            {showNotes || form.notes ? (
              <textarea
                className={`${inputCls} min-h-[80px] resize-y`}
                value={form.notes}
                onChange={set('notes')}
                placeholder="Aclaraciones para tu pedido"
                autoFocus={showNotes && !form.notes}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowNotes(true)}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent transition-colors hover:opacity-80"
              >
                <Plus size={15} /> Agregar una nota
              </button>
            )}
          </div>
        </div>

        {/* ───────── Columna derecha: pedido + cupón + resumen + pago (sticky) ───────── */}
        <aside className="lg:sticky lg:top-6">
          <div className="rounded-[14px] border border-line bg-background p-5 sm:p-6">
            <h2 className="mb-4 font-heading text-[16px] font-bold text-text">Tu pedido</h2>
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

            {min.active && (
              <div className={`pt-3 text-[12px] font-semibold ${min.ok ? 'text-emerald-600' : 'text-amber-600'}`}>
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

            {/* 4. Cupón */}
            <div className="border-b border-line py-5">
              <SectionHeading n={4}>Cupón</SectionHeading>
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
                        {couponIsPartial && (
                          <p className="mt-0.5 text-[11px] leading-snug text-emerald-600">
                            Aplica sólo a: {couponEligibleNames.join(', ')}. El resto de los productos se cobran a precio normal.
                          </p>
                        )}
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
                  <div className="flex gap-2">
                    <input
                      className={inputCls}
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }}
                      placeholder="Código de cupón"
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

            {/* 5. Resumen */}
            <div className="border-b border-line py-5">
              <SectionHeading n={5}>Resumen</SectionHeading>
              <div className="space-y-1.5">
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
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-muted">Envío</span>
                  {shippingKnown ? (
                    shippingCost === 0 ? (
                      <span className="text-[13px] font-bold text-[#27ae60]">GRATIS</span>
                    ) : (
                      <span className="text-[13px] font-bold text-text">{formatPrice(shippingCost)}</span>
                    )
                  ) : (
                    <span className="text-[13px] font-medium text-subtle">Se coordina</span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
                  <span className="text-[14px] font-semibold text-text">Total</span>
                  <span className="text-[22px] font-extrabold text-text">{formatPrice(orderTotal)}</span>
                </div>
              </div>
            </div>

            {/* 6. Método de pago — radio cards */}
            {payMethods.length > 0 && (
              <div className="py-5">
                <SectionHeading n={6}>Método de pago</SectionHeading>
                <div className="space-y-2.5">
                  {payMethods.map((m) => {
                    const selected = payMethod === m;
                    const isCash = m !== 'tarjeta';
                    const label =
                      m === 'tarjeta'
                        ? 'Tarjeta'
                        : m === 'mp_cuenta'
                          ? 'Dinero en cuenta'
                          : m === 'gocuotas'
                            ? 'GoCuotas'
                            : m === 'transferencia'
                              ? 'Transferencia'
                              : 'Efectivo';
                    const sub =
                      m === 'tarjeta'
                        ? config.cardPaymentText ||
                          (config.installmentsCount > 1 ? `Hasta ${config.installmentsCount} cuotas` : 'Pago con tarjeta')
                        : m === 'mp_cuenta'
                          ? 'Pagás con tu saldo de Mercado Pago'
                          : m === 'gocuotas'
                            ? 'Cuotas sin interés con tarjeta de débito'
                            : m === 'transferencia'
                              ? transferAccount
                                ? 'Transferí y enviá el comprobante'
                                : mpEnabled
                                  ? 'Pago online con Mercado Pago'
                                  : 'Coordinamos la transferencia por WhatsApp'
                              : 'Lo coordinamos por WhatsApp';
                    const methodTotal = totalForMode(isCash ? 'cash' : 'card');
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setPayMethod(m); setError(''); }}
                        aria-pressed={selected}
                        className={`flex w-full items-start gap-3 rounded-[12px] border p-3.5 text-left transition-all ${
                          selected ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-line hover:border-accent/50'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            selected ? 'border-accent' : 'border-line'
                          }`}
                        >
                          {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-[14px] font-bold text-text">{label}</span>
                            {isCash && cashDiscountPct > 0 && (
                              <span className="shrink-0 rounded-full bg-[#27ae60] px-2 py-0.5 text-[10px] font-bold leading-none text-white">
                                -{cashDiscountPct}%
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-snug text-subtle">{sub}</span>
                          <span className="mt-1.5 block text-[15px] font-extrabold text-text">{formatPrice(methodTotal)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Transferencia directa: NO mostramos alias/CBU acá (antes de confirmar).
                    Si el cliente copiara los datos y transfiriera sin confirmar, el pedido
                    no entraría al sistema. Los datos completos se muestran en la pantalla de
                    éxito, una vez que el pedido quedó registrado. Acá solo anticipamos el monto. */}
                {transferManual && transferAccount && (
                  <div className="mt-4 rounded-[12px] border border-accent/40 bg-accent/5 p-4">
                    <p className="text-[13px] font-bold text-text">Pago por transferencia</p>
                    <p className="mt-1.5 text-[13px] leading-snug text-muted">
                      Al confirmar el pedido te mostramos el alias y CBU para transferir{' '}
                      <span className="font-semibold text-text">{formatPrice(transferTotal)}</span>. Queda como
                      pendiente de pago hasta que envíes el comprobante por WhatsApp.
                    </p>
                  </div>
                )}
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
                className={`flex w-full items-center justify-center gap-2 rounded-[10px] py-4 text-[14px] font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 ${routing === 'mp' ? 'bg-[#009ee3] hover:scale-[1.01]' : routing === 'gc' ? 'bg-[#7c3aed] hover:scale-[1.01]' : 'bg-[#25D366] hover:brightness-105'}`}
              >
                {loading !== null ? (
                  <><Spinner size={16} /> {routing === 'wa' ? 'Procesando…' : 'Redirigiendo…'}</>
                ) : routing === 'mp' ? (
                  'Pagar con Mercado Pago'
                ) : routing === 'gc' ? (
                  'Pagar con GoCuotas'
                ) : transferManual ? (
                  'Confirmar pedido'
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
          </div>
        </aside>
      </div>
    </div>
  );
}
