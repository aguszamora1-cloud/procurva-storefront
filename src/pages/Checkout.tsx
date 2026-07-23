import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, X, ArrowLeft, Plus, MapPin, Info, AlertTriangle, Image as ImageIcon, Lock, Pencil, ChevronUp, MessageCircle, Tag } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useCartPromos } from '@/hooks/useCartPromos';
import { useMetaPixel } from '@/hooks/useMetaPixel';
import { stashPendingPurchase } from '@/lib/metaPixel';
import { useStore, useStoreType } from '@/context/StoreProvider';
import { supabase } from '@/lib/supabase';
import { Seo } from '@/components/Seo';
import { Spinner } from '@/components/Spinner';
import { formatPrice, whatsappLink } from '@/lib/utils';
import { cartLineKey, groupCartItems, evalMinOrder } from '@/lib/cart';
import { applyPromoToPrice } from '@/lib/promotions';
import { buildWhatsappOrderWithCustomer } from '@/lib/checkout';
import { createCatalogOrder, startMercadoPagoCheckout, startGoCuotasCheckout, checkCartStock, CouponError, StockError, type CouponErrorCode, type CustomerInfo, type StockShortfall, type PriceBreakdown } from '@/lib/orders';
import { expandMethod, hasOwnZoneCoverage, methodAvailableForPostalCode, normalizePostalCode, type ShippingOption } from '@/lib/shipping';
import { looksLikePhone } from '@/lib/phone';
import { computeDiscount, eligibleSubtotal, eligibleItems } from '@/lib/coupons';
import { track } from '@/lib/tracking';
import { useCoupon } from '@/context/CouponContext';
import { CouponChip } from '@/components/CouponChip';

/** Mensaje en español para cada código de error de cupón que puede lanzar la RPC. */
const COUPON_ERROR_MESSAGES: Record<CouponErrorCode, string> = {
  COUPON_NOT_FOUND: 'El cupón no es válido.',
  COUPON_INACTIVE: 'El cupón no es válido.',
  COUPON_EXPIRED: 'El cupón está vencido.',
  COUPON_NOT_YET_VALID: 'El cupón está vencido.',
  COUPON_EXHAUSTED: 'Este cupón ya fue utilizado.',
  COUPON_MIN_NOT_MET: 'No alcanzás el mínimo de compra para este cupón.',
  COUPON_WRONG_CHANNEL: 'El cupón no aplica a esta tienda.',
  COUPON_DISCOUNT_MISMATCH: 'Hubo un problema con el descuento. Recargá la página e intentá de nuevo.',
};

/** "BUZO NIKE AIR — Talle M / Negro": el detalle de una línea sin stock. */
function shortfallLabel(s: StockShortfall): string {
  const attrs = [s.size && `Talle ${s.size}`, s.color].filter(Boolean).join(' / ');
  return attrs ? `${s.name} — ${attrs}` : s.name;
}

/** "Pediste 5, queda 1" / "Pediste 3, no queda stock". */
function shortfallDetail(s: StockShortfall): string {
  if (s.available <= 0) return `Pediste ${s.requested}, no queda stock`;
  return `Pediste ${s.requested}, ${s.available === 1 ? 'queda 1' : `quedan ${s.available}`}`;
}

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

// Encabezado de paso numerado — SOLO en la columna izquierda (los pasos reales
// del checkout). Número en círculo de acento + título en sentence case, una sola
// familia tipográfica, peso 500. Sin ALL CAPS, sin divider pesado.
function SectionHeading({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-medium text-on-accent">
        {n}
      </span>
      <h2 className="font-body text-[16px] font-medium text-text">{children}</h2>
    </div>
  );
}

// Radio real (accesible) con presentación de card. El <input type="radio"> vive
// dentro del <label> (queda asociado sin htmlFor), oculto visualmente pero
// enfocable y navegable por teclado dentro de su grupo `name`. La selección se
// marca con borde 2px de acento (sin fondo tintado); el foco muestra un ring.
function RadioCard({
  name,
  value,
  checked,
  onChange,
  children,
  className = '',
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-[12px] px-4 py-3.5 transition-colors focus-within:ring-2 focus-within:ring-accent/40 ${
        checked ? 'border-2 border-accent' : 'border border-line hover:border-accent/50'
      } ${className}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors ${
          checked ? 'border-accent' : 'border-line'
        }`}
      >
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
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
    // Analytics propio (independiente del pixel; no-op hasta tenant resuelto).
    track('checkout_start', { amount: subtotal });
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
  const [showCoupon, setShowCoupon] = useState(false); // Input de cupón colapsado tras "¿Tenés un cupón?"
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false); // Detalle expandible de la barra fija mobile
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
  //  - transferencia: contado; con cuenta bancaria cargada es transferencia directa
  //    (no requiere MP ni WhatsApp); sin cuenta, va a MP si está habilitado y si no se
  //    coordina por WhatsApp. Por eso alcanza con MP, WhatsApp o una cuenta cargada.
  //  - efectivo: contado; siempre se coordina por WhatsApp.
  //  - tarjeta: precio tarjeta; sólo si hay Mercado Pago.
  //  - mp_cuenta: contado (dinero en cuenta de MP); sólo si hay Mercado Pago.
  //  - gocuotas: contado (débito en cuotas sin interés); sólo si hay GoCuotas.
  const hasTransferAccount = Boolean(transferAccount);
  const payMethods = useMemo<PayMethod[]>(() => {
    const list: PayMethod[] = [];
    if (mpEnabled || waEnabled || hasTransferAccount) list.push('transferencia');
    if (waEnabled) list.push('efectivo');
    if (mpEnabled) list.push('mp_cuenta');
    if (mpEnabled) list.push('tarjeta');
    if (gcEnabled) list.push('gocuotas');
    return list;
  }, [mpEnabled, gcEnabled, waEnabled, hasTransferAccount]);
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

  // Revalidación de stock al entrar al checkout. El carrito vive en localStorage
  // sin vencimiento y no se revalida nunca, así que un ítem agregado hace días
  // puede llegar acá con stock 0. Esto es solo el aviso temprano —el bloqueo real
  // lo hace el trigger de catalog_orders al registrar el pedido—, por eso ante
  // cualquier fallo `checkCartStock` devuelve [] y el checkout sigue normal.
  const [stockIssues, setStockIssues] = useState<StockShortfall[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (items.length === 0) {
      setStockIssues([]);
      return;
    }
    (async () => {
      const short = await checkCartStock(config.companyId, items, priceMode);
      if (!cancelled) setStockIssues(short);
    })();
    return () => {
      cancelled = true;
    };
    // priceMode queda afuera a propósito: no afecta el stock, solo el precio, y
    // revalidar en cada cambio de medio de pago sería una llamada al pedo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.companyId, items]);

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

  // ── Cupón de descuento ──────────────────────────────────────────────────
  // Si algún item lleva una promo automática NO acumulable, no se permiten
  // cupones (el descuento promocional ya está aplicado en el precio).
  const hasNonStackablePromo = useMemo(
    () => pricedItems.some((i) => i.promo_id && i.promo_stackable === false),
    [pricedItems],
  );
  const [couponInput, setCouponInput] = useState('');
  const [couponStatus, setCouponStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [couponError, setCouponError] = useState('');
  // Cupón guardado (persistente). El chip y el input son dos vistas de este estado.
  // `appliedCoupon` (derivado) es el registro solo cuando está aplicado: el resto
  // del checkout (descuento, resumen, orden) sigue leyéndolo igual que antes.
  const { savedCoupon, couponRecord, saveCoupon, setApplied, removeCoupon: clearSavedCoupon } = useCoupon();
  const appliedCoupon = savedCoupon?.applied ? couponRecord : null;

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
    // El mínimo se mide sobre el subtotal ELEGIBLE (igual que la RPC server-side),
    // no sobre el total del carrito: así nunca mostramos un descuento que el
    // servidor va a rechazar.
    const elig = eligibleSubtotal(appliedCoupon, pricedItems, priceMode);
    if (appliedCoupon.min_subtotal && elig < appliedCoupon.min_subtotal) return 0;
    return Math.round(computeDiscount(appliedCoupon, elig));
  }, [appliedCoupon, pricedItems, priceMode]);

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
    if (appliedCoupon) {
      const elig = eligibleSubtotal(appliedCoupon, pricedItems, mode);
      if (!(appliedCoupon.min_subtotal && elig < appliedCoupon.min_subtotal)) {
        disc = Math.round(computeDiscount(appliedCoupon, elig));
      }
    }
    return Math.max(0, sub - disc) + shippingCost;
  };

  // Monto exacto a transferir: SIEMPRE el total de contado del método Transferencia
  // (recargo 0%), nunca el de tarjeta. Coincide con orderTotal cuando Transferencia
  // está seleccionada; lo calculamos explícito para el bloque y el mensaje de WhatsApp.
  const transferTotal = totalForMode('cash');


  // Aplicar desde el input manual: valida (cart-independiente) y guarda el cupón
  // como aplicado. Queda sincronizado con el chip (misma fuente de estado). La
  // validez contra el carrito (mínimo/alcance) la refleja el resumen en vivo.
  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponStatus('loading');
    setCouponError('');
    const res = await saveCoupon(code, { applied: true });
    if (!res.ok) {
      setCouponError(res.error || 'El código no es válido.');
      setCouponStatus('error');
      return;
    }
    setCouponInput('');
    setCouponStatus('idle');
  }

  // Quitar el cupón APLICADO: lo dejamos guardado (chip "disponible") para que el
  // cliente pueda re-aplicarlo sin volver a tipearlo.
  function unapplyCoupon() {
    setApplied(false);
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
        <h1 className="font-body text-[24px] font-medium text-text">Tu carrito está vacío</h1>
        <Link to="/productos" className="rounded-[8px] bg-primary px-8 py-3.5 text-[14px] font-medium text-on-primary transition-opacity hover:opacity-90">
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
    // Antes sólo se validaba "no vacío", así que un email autocompletado en el
    // campo teléfono pasaba derecho y el pedido quedaba sin forma de contacto.
    if (!looksLikePhone(form.phone)) return 'Revisá tu teléfono: ingresá sólo el número con característica (ej: 11 1234 5678).';
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
    if (config.requireDeliveryTime && !form.deliveryTime?.trim()) {
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
      // Desglose de precio completo para el detalle de la venta en el ERP. Reusa
      // los subtotales que el checkout ya calcula, así el desglose es exacto y
      // consistente con lo que ve el cliente. Descomposición (de lista a total):
      //   list_subtotal (tarjeta, pre-promo)
      //     - promo_discount      = subtotal - cardSubtotal   (promo por cantidad)
      //     - payment_discount    = cardSubtotal - cashSubtotal (contado, solo cash)
      //     - coupon_discount     = discountAmount
      //     + shipping
      //     = total
      const promoNames = Array.from(
        new Set(pricedItems.filter((i) => i.promo_id && i.promo_name).map((i) => i.promo_name as string)),
      );
      const priceBreakdown: PriceBreakdown = {
        source: 'storefront',
        list_subtotal: Math.round(subtotal),
        promo_discount: Math.max(0, Math.round(subtotal - cardSubtotal)),
        promo_name: promoNames[0] ?? null,
        payment_discount: priceMode === 'cash' ? Math.max(0, Math.round(cardSubtotal - cashSubtotal)) : 0,
        payment_discount_pct: priceMode === 'cash' ? cashDiscountPct : 0,
        payment_method: payLabel,
        coupon_discount: Math.round(discountAmount),
        coupon_code: discount?.coupon_code ?? null,
        shipping: Math.round(shippingCost),
        surcharge: 0,
        total: Math.round(orderTotal),
        items: pricedItems.map((i) => {
          const priceFinal =
            priceMode === 'cash' && typeof i.unit_price_cash === 'number' ? i.unit_price_cash : i.unit_price;
          const priceList = i.unit_price_original ?? i.unit_price;
          return {
            product_id: i.product_id,
            variant_id: i.source === 'curva_surtida' ? null : i.variant_id,
            size: i.size ?? null,
            color: i.color ?? null,
            name: i.name,
            quantity: i.qty,
            price_list: Math.round(priceList),
            price_final: Math.round(priceFinal),
            promo_name: i.promo_name ?? null,
          };
        }),
      };

      // storeType puede ser null mientras resuelve el tenant; por defecto minorista.
      const orderId = await createCatalogOrder(
        config, pricedItems, orderTotal, customer, payLabel, storeType ?? 'retail',
        { priceMode, viaMercadoPago: routing !== 'wa', discount, manualTransfer: transferManual, shippingCost, priceBreakdown },
      );

      // Prefill local: guardamos los datos reutilizables para autocompletar la
      // próxima compra desde este dispositivo (guardamos form.address SIN el piso
      // fusionado, y el piso aparte, para no duplicarlo al recargar).
      saveCustomer(config.companyId, {
        name: form.name, phone: form.phone, email: form.email,
        address: form.address, city: form.city, province: form.province, zip: form.zip,
        floor,
      });

      // El uso del cupón (incrementar current_uses + fila de tracking en
      // ecommerce_coupon_uses) ahora lo hace la RPC create_catalog_order_dedup
      // server-side, en la misma transacción que inserta el pedido. Si el cupón
      // no era válido/ya se agotó, createCatalogOrder ya habría lanzado un
      // CouponError arriba y no llegamos hasta acá.

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
          // Disparo dual (pixel + CAPI) del Purchase en la pantalla de éxito, dedup por eventId.
          // userData mejora el match de Meta (se hashea SHA-256 en el Edge Function).
          eventId: crypto.randomUUID(),
          companyId: config.companyId,
          userData: { email: form.email, phone: form.phone },
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
      // Error de cupón (validación/redención server-side): mostramos el motivo,
      // limpiamos el cupón aplicado y dejamos que reintente la compra sin él.
      if (e instanceof CouponError) {
        const msg = COUPON_ERROR_MESSAGES[e.code] ?? 'El cupón no es válido.';
        setCouponError(msg);
        setError(`${msg} Quitamos el cupón; podés reintentar la compra.`);
        // El servidor rechazó el cupón en el paso final: lo sacamos por completo.
        clearSavedCoupon();
        setCouponInput('');
      } else if (e instanceof StockError) {
        // El pedido NO se registró: alguien se llevó el stock mientras el cliente
        // completaba el checkout. Mostramos qué faltó y no lo dejamos confirmar
        // hasta que ajuste el carrito.
        setStockIssues(e.shortfalls);
        setError(
          e.shortfalls.length > 0
            ? 'No pudimos confirmar tu pedido: se quedó sin stock un producto de tu carrito.'
            : 'No pudimos confirmar tu pedido: uno de los productos se quedó sin stock. Revisá tu carrito.',
        );
      } else {
        setError(e?.message || 'Hubo un problema al procesar tu pedido.');
      }
      setLoading(null);
      // Liberamos el candado para que pueda reintentar tras el error.
      submitLockRef.current = false;
    }
  }

  // text-[16px] evita el zoom automático de iOS al enfocar un input (<16px).
  // Borde 1px neutro, radio 8px, sin sombra: sólo el focus ring del input.
  const inputCls =
    'w-full rounded-[8px] border border-line bg-background px-3.5 py-2.5 text-[16px] font-normal text-text outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/25';
  const labelCls = 'text-[13px] font-medium text-muted';

  // Link de WhatsApp para las salidas de contacto del panel (dudas / sin cobertura).
  const waHref = config.whatsapp
    ? whatsappLink(config.whatsapp, `Hola! Tengo una consulta sobre mi pedido en ${config.name}.`)
    : null;

  // Retiro en el local como radio: dirección + días en una sola línea de subtítulo.
  // El horario para retirar se anida acá, y sólo cuando esta opción está elegida.
  const renderPickupOption = (m: ShippingOption) => {
    const selected = m.id === selectedMethodId;
    const price = shippingPriceLabel(m.cost);
    const line = [m.pickupAddress, m.readyTime || m.openingHours].filter(Boolean).join(' · ');
    return (
      <div key={m.id}>
        <RadioCard
          name="metodo-entrega"
          value={m.id}
          checked={selected}
          onChange={() => { setSelectedMethodId(m.id); setError(''); }}
        >
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-text">{m.name}</span>
              {line && (
                <span className="mt-0.5 flex items-start gap-1.5 text-[13px] text-muted">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" />
                  <span className="min-w-0">{line}</span>
                </span>
              )}
            </span>
            <span className={`shrink-0 text-[14px] ${price.free ? 'font-medium text-[#27ae60]' : 'font-medium text-text'}`}>
              {price.text}
            </span>
          </span>
        </RadioCard>

        {/* Horario para retirar — anidado dentro de la opción, sólo si está elegida */}
        {selected && (
          <label className="mt-2 flex flex-col gap-1.5 pl-4">
            <span className={labelCls}>
              Horario para retirar el pedido{config.requireDeliveryTime ? ' *' : ' (opcional)'}
            </span>
            <input
              className={inputCls}
              value={form.deliveryTime}
              onChange={set('deliveryTime')}
              placeholder="Ej: de 9 a 13 hs, o después de las 18"
            />
          </label>
        )}
      </div>
    );
  };

  // Envío a domicilio / retiro en sucursal como radio: nombre, plazo y precio a la derecha.
  const renderDeliveryOption = (m: ShippingOption) => {
    const selected = m.id === selectedMethodId;
    const price = shippingPriceLabel(m.cost);
    return (
      <RadioCard
        key={m.id}
        name="metodo-entrega"
        value={m.id}
        checked={selected}
        onChange={() => { setSelectedMethodId(m.id); setError(''); }}
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[14px] font-medium text-text">{m.name}</span>
            {m.eta && <span className="mt-0.5 block text-[13px] text-muted">Llega en {m.eta}</span>}
            {m.kind === 'branch' && (
              <span className="mt-1 flex items-start gap-1.5 text-[12px] text-subtle">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0">El correo te avisa cuando tu pedido llega a la sucursal que elijas.</span>
              </span>
            )}
          </span>
          <span className={`shrink-0 text-[14px] font-medium ${price.free ? 'text-[#27ae60]' : 'text-text'}`}>
            {price.text}
          </span>
        </span>
      </RadioCard>
    );
  };

  // ── Desglose del resumen (SÓLO presentación; el total no cambia) ────────────
  // Reexpresamos el subtotal a precio de lista/tarjeta y mostramos cada descuento
  // como línea propia (cantidad, pago contado, cupón). La suma da exactamente
  // `orderTotal`: listSubtotal − qtyDiscount − paymentDiscount − cupón + envío.
  const listSubtotalDisplay = subtotal;
  const qtyDiscountDisplay = Math.max(0, subtotal - cardSubtotal);
  const paymentDiscountDisplay = priceMode === 'cash' ? Math.max(0, cardSubtotal - cashSubtotal) : 0;

  // El CTA queda inactivo si todavía falta cotizar el envío (tienda con envío a
  // domicilio, sin método elegido y sin CP). El motivo se muestra bajo el botón.
  const mustQuoteShipping = !selectedMethod && hasDeliveryMethods && !appliedCp && !(form.zip || '').trim();
  const ctaDisabled = loading !== null || stockIssues.length > 0 || mustQuoteShipping;

  // Bloque de totales del resumen (reusado en el panel y en la barra fija mobile).
  const summaryRows = (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted">Subtotal</span>
        <span className="text-[13px] font-medium text-text">{formatPrice(listSubtotalDisplay)}</span>
      </div>
      {qtyDiscountDisplay > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted">Descuento por cantidad</span>
          <span className="text-[13px] font-medium text-[#27ae60]">-{formatPrice(qtyDiscountDisplay)}</span>
        </div>
      )}
      {paymentDiscountDisplay > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted">Descuento por pago{cashDiscountPct > 0 ? ` (${cashDiscountPct}%)` : ''}</span>
          <span className="text-[13px] font-medium text-[#27ae60]">-{formatPrice(paymentDiscountDisplay)}</span>
        </div>
      )}
      {discountAmount > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted">
            Cupón{appliedCoupon?.discount_type === 'percent' ? ` (${appliedCoupon.discount_value}%)` : ''}
          </span>
          <span className="text-[13px] font-medium text-[#27ae60]">-{formatPrice(discountAmount)}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted">Envío</span>
        {shippingKnown ? (
          shippingCost === 0 ? (
            <span className="text-[13px] font-medium text-[#27ae60]">Gratis</span>
          ) : (
            <span className="text-[13px] font-medium text-text">{formatPrice(shippingCost)}</span>
          )
        ) : (
          <span className="text-[13px] font-normal text-subtle">Se coordina</span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
        <span className="text-[14px] font-medium text-text">Total</span>
        <span className="text-[22px] font-medium text-text">{formatPrice(orderTotal)}</span>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1200px] px-5 pt-6 pb-32 sm:px-6 md:pt-12 lg:pb-12">
      {seo}

      {/* Volver al carrito */}
      <button
        onClick={() => navigate('/carrito')}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-subtle transition-colors hover:text-accent"
      >
        <ArrowLeft size={16} /> Volver al carrito
      </button>

      <h1 className="mb-7 font-body text-[24px] font-medium text-text sm:text-[30px] md:mb-9">Finalizar compra</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start lg:gap-12">
        {/* ───────── Columna izquierda: datos + envío + notas ───────── */}
        <div>
          {/* 1. Tus datos */}
          <SectionHeading n={1}>Tus datos</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* name/type/autoComplete son necesarios para que el autocompletado del
                navegador ponga cada dato en su campo. Con sólo inputMode (que es una
                pista de teclado, no de autofill) Safari/iOS resuelve por heurística y
                llegaron pedidos con el email cargado en el teléfono. */}
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Nombre *</span>
              <input className={inputCls} value={form.name} onChange={set('name')} name="name" autoComplete="name" placeholder="Tu nombre y apellido" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Teléfono *</span>
              <input className={inputCls} value={form.phone} onChange={set('phone')} type="tel" name="tel" autoComplete="tel" inputMode="tel" placeholder="Tu número con característica" />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className={labelCls}>Email {config.mercadopagoEnabled ? '*' : ''}</span>
              <input className={inputCls} value={form.email} onChange={set('email')} type="email" name="email" autoComplete="email" inputMode="email" placeholder="tu@email.com" />
            </label>
          </div>

          {/* 2. Entrega — retiro en el local + envío a domicilio (gateado por CP) */}
          <div className="mt-9">
            <SectionHeading n={2}>Entrega</SectionHeading>

            {/* Retiro en el local (radio): dirección + días en una línea; el horario
                de retiro se anida dentro de la opción cuando queda elegida. */}
            {localPickupMethods.length > 0 && (
              <div className="space-y-2">{localPickupMethods.map(renderPickupOption)}</div>
            )}

            {/* Separador hacia el envío a domicilio (sólo si conviven ambas modalidades) */}
            {localPickupMethods.length > 0 && hasDeliveryMethods && (
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[12px] text-subtle">o recibilo en tu domicilio</span>
                <span className="h-px flex-1 bg-line" />
              </div>
            )}

            {/* Envío a domicilio: confirmación de CP / calculador / opciones / sin cobertura */}
            {hasDeliveryMethods && (
              <div className="space-y-3">
                {/* CP confirmado: reemplaza al input por una línea con opción de cambiarlo */}
                {appliedCp && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                    <MapPin className="h-4 w-4 shrink-0 text-subtle" />
                    <span className="font-medium text-text">
                      {[form.city, form.province].filter(Boolean).join(', ') || 'Tu zona'}
                    </span>
                    <span className="text-subtle">·</span>
                    <span className="text-muted">CP {appliedCp}</span>
                    <button type="button" onClick={changeCp} className="ml-1 text-[13px] font-medium text-accent hover:underline">
                      Cambiar
                    </button>
                  </div>
                )}

                {/* Calculador de CP: input + "Ver opciones" (mismo peso visual que los inputs) */}
                {needsCpForDelivery && (
                  <div className="max-w-[440px]">
                    <label className="flex flex-col gap-1.5">
                      <span className={labelCls}>Ingresá tu código postal para ver las opciones de envío</span>
                      <div className="flex gap-2">
                        <input
                          className={inputCls}
                          value={cpInput}
                          onChange={(e) => { setCpInput(e.target.value); setError(''); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCp(); } }}
                          inputMode="numeric"
                          placeholder="Ej: 2000"
                        />
                        <button
                          type="button"
                          onClick={applyCp}
                          className="shrink-0 rounded-[8px] border border-line px-4 text-[14px] font-medium text-text transition-colors hover:border-accent hover:text-accent"
                        >
                          Ver opciones
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

                {/* Sin cobertura para la zona: en vez de una lista vacía, ofrecemos WhatsApp */}
                {noDeliveryForZone && (
                  <div className="rounded-[12px] border border-line px-4 py-3">
                    <p className="text-[13px] text-text">No hacemos envíos a tu zona todavía.</p>
                    {waHref ? (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline"
                      >
                        <MessageCircle className="h-4 w-4" /> Escribinos y lo coordinamos
                      </a>
                    ) : (
                      <p className="mt-1 text-[13px] text-muted">Contactanos y lo coordinamos.</p>
                    )}
                  </div>
                )}

                {/* Opciones de envío disponibles (radios): nombre, plazo y precio a la derecha */}
                {deliveryMethods.length > 0 && (
                  <div className="space-y-2">{deliveryMethods.map(renderDeliveryOption)}</div>
                )}

                {/* Campos de dirección: sólo si el método elegido requiere domicilio */}
                {requiresAddress && (
                  <div className="grid gap-4 pt-1 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className={labelCls}>Dirección *</span>
                      <input className={inputCls} value={form.address} onChange={set('address')} placeholder="Calle y número" />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className={labelCls}>Piso / depto</span>
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
                    {/* Horario para recibir — junto a la dirección de envío */}
                    <label className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className={labelCls}>
                        Horario para recibir el pedido{config.requireDeliveryTime ? ' *' : ' (opcional)'}
                      </span>
                      <input
                        className={inputCls}
                        value={form.deliveryTime}
                        onChange={set('deliveryTime')}
                        placeholder="Ej: de 9 a 13 hs, o después de las 18"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Notas (opcional) — sin numerar, colapsada por defecto */}
            <div className="mt-6">
              {showNotes || form.notes ? (
                <label className="flex flex-col gap-1.5">
                  <span className={labelCls}>Notas (opcional)</span>
                  <textarea
                    className={`${inputCls} min-h-[72px] resize-y`}
                    value={form.notes}
                    onChange={set('notes')}
                    placeholder="Aclaraciones para tu pedido"
                    autoFocus={showNotes && !form.notes}
                  />
                </label>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNotes(true)}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent transition-colors hover:opacity-80"
                >
                  <Plus size={15} /> Agregar una nota
                </button>
              )}
            </div>
          </div>

          {/* 3. Método de pago — movido desde el panel derecho */}
          {payMethods.length > 0 && (
            <div className="mt-9">
              <SectionHeading n={3}>Método de pago</SectionHeading>
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
                  return (
                    <RadioCard
                      key={m}
                      name="metodo-pago"
                      value={m}
                      checked={selected}
                      onChange={() => { setPayMethod(m); setError(''); }}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block text-[14px] font-medium text-text">{label}</span>
                          <span className="mt-0.5 block text-[13px] leading-snug text-subtle">{sub}</span>
                        </span>
                        {isCash && cashDiscountPct > 0 && (
                          <span className="shrink-0 rounded-full bg-[#27ae60] px-2.5 py-1 text-[11px] font-medium leading-none text-white">
                            {cashDiscountPct}% off
                          </span>
                        )}
                      </span>
                    </RadioCard>
                  );
                })}
              </div>

              {/* Transferencia directa: sólo anticipamos el monto; alias/CBU en la pantalla de éxito */}
              {transferManual && transferAccount && (
                <div className="mt-4 rounded-[12px] border border-line p-4">
                  <p className="text-[13px] font-medium text-text">Pago por transferencia</p>
                  <p className="mt-1.5 text-[13px] leading-snug text-muted">
                    Al confirmar el pedido te mostramos el alias y CBU para transferir{' '}
                    <span className="font-medium text-text">{formatPrice(transferTotal)}</span>. Queda como
                    pendiente de pago hasta que envíes el comprobante por WhatsApp.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ───────── Panel derecho: Tu pedido (sticky, top ~24px) ───────── */}
        <aside className="lg:sticky lg:top-6">
          <div className="rounded-[12px] border border-line bg-background p-5 sm:p-6">
            {/* Encabezado + Editar (vuelve al carrito) */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-body text-[16px] font-medium text-text">Tu pedido</h2>
              <button
                type="button"
                onClick={() => navigate('/carrito')}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-accent transition-opacity hover:opacity-80"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            </div>

            {/* Ítems del carrito: producto como línea principal, cantidad como subtítulo */}
            <div className="space-y-3 border-b border-line pb-4">
              {groupCartItems(pricedItems).map((row) => {
                const qtyLabel =
                  row.source === 'curva' || row.source === 'curva_surtida'
                    ? `${row.units} u.`
                    : `${row.units} ${row.units === 1 ? 'unidad' : 'unidades'}`;
                const subtitle = [row.detail, qtyLabel].filter(Boolean).join(' · ');
                return (
                  <div key={row.key} className="flex items-start justify-between gap-3 text-[13px]">
                    <div className="flex min-w-0 items-start gap-3">
                      {row.image ? (
                        <img
                          src={row.image}
                          alt={row.name}
                          loading="lazy"
                          className="h-14 w-14 shrink-0 rounded-[8px] border border-line object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[8px] border border-line bg-muted/10 text-subtle">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-text">{row.name}</p>
                        {subtitle && <p className="mt-0.5 text-[12px] text-subtle">{subtitle}</p>}
                      </div>
                    </div>
                    <span className="shrink-0 font-medium text-text">{formatPrice(row.lineTotal)}</span>
                  </div>
                );
              })}
            </div>

            {min.active && (
              <div className={`pt-3 text-[12px] font-medium ${min.ok ? 'text-emerald-600' : 'text-amber-600'}`}>
                {min.ok ? (
                  <p>Mínimo de compra alcanzado</p>
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

            {/* Cupón: colapsado tras un link. Al aplicar, se ve como estado, no como paso. */}
            <div className="border-b border-line py-4">
              {hasNonStackablePromo ? (
                <p className="text-[12px] leading-snug text-muted">
                  Este producto ya tiene un descuento promocional aplicado. No se puede combinar con cupones.
                </p>
              ) : appliedCoupon ? (
                <div
                  className={`flex items-center justify-between gap-2 rounded-[8px] border px-3 py-2 ${
                    discountAmount > 0 ? 'border-[#27ae60]/40' : 'border-amber-300'
                  }`}
                >
                  <div className="min-w-0">
                    {discountAmount > 0 ? (
                      <>
                        <p className="text-[12px] font-medium text-[#27ae60]">
                          Cupón {appliedCoupon.code.toUpperCase()} aplicado
                        </p>
                        <p className="text-[11px] text-[#27ae60]">
                          {appliedCoupon.discount_type === 'percent' ? `-${appliedCoupon.discount_value}% ` : ''}(-{formatPrice(discountAmount)})
                        </p>
                        {couponIsPartial && (
                          <p className="mt-0.5 text-[11px] leading-snug text-[#27ae60]">
                            Aplica sólo a: {couponEligibleNames.join(', ')}. El resto de los productos se cobran a precio normal.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-[12px] font-medium text-amber-700">
                        El cupón {appliedCoupon.code.toUpperCase()} no aplica a este monto.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={unapplyCoupon}
                    aria-label="Quitar cupón"
                    className="shrink-0 rounded-full p-1 text-current opacity-70 transition-opacity hover:opacity-100"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : showCoupon ? (
                <>
                  {/* Chip del cupón guardado (disponible / no aplicable): al tocarlo
                      se aplica de verdad. Es la otra vista del mismo estado que el input. */}
                  <CouponChip
                    items={pricedItems}
                    mode={priceMode}
                    storeType={effStoreType}
                    hasNonStackablePromo={false}
                    className="mb-2"
                  />
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
                      className="shrink-0 rounded-[8px] border border-line px-4 text-[14px] font-medium text-text transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {couponStatus === 'loading' ? '…' : 'Aplicar'}
                    </button>
                  </div>
                  {couponError && <p className="mt-2 text-[12px] font-medium text-red-600">{couponError}</p>}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCoupon(true)}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent transition-opacity hover:opacity-80"
                >
                  <Tag className="h-4 w-4" /> ¿Tenés un cupón?
                </button>
              )}
            </div>

            {/* Totales */}
            <div className="py-4">{summaryRows}</div>

            {/* Stock insuficiente / error — visibles también en mobile (fuera del bloque desktop) */}
            {stockIssues.length > 0 && (
              <div className="mb-3 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {stockIssues.length === 1 ? 'Un producto se quedó sin stock' : 'Hay productos sin stock'}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {stockIssues.map((s, idx) => (
                    <li key={`${s.name}-${s.size ?? ''}-${s.color ?? ''}-${idx}`} className="text-[13px] leading-snug text-red-700">
                      <span className="font-medium">{shortfallLabel(s)}</span>
                      <span className="text-red-600"> · {shortfallDetail(s)}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/carrito" className="mt-2 inline-block text-[13px] font-medium text-red-700 underline">
                  Ajustar el carrito
                </Link>
              </div>
            )}

            {error && (
              <p className="mb-3 rounded-[8px] bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{error}</p>
            )}

            {/* CTA + línea de confianza — sólo desktop (en mobile va la barra fija inferior) */}
            <div className="hidden lg:block">
              {payMethods.length > 0 ? (
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={ctaDisabled}
                  className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-primary py-3.5 text-[15px] font-medium text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading !== null ? (
                    <><Spinner size={16} /> {routing === 'wa' ? 'Procesando…' : 'Redirigiendo…'}</>
                  ) : (
                    'Confirmar pedido'
                  )}
                </button>
              ) : (
                <p className="text-[13px] text-subtle">Esta tienda todavía no tiene medios de pago configurados.</p>
              )}

              {mustQuoteShipping && payMethods.length > 0 && (
                <p className="mt-2 text-center text-[12px] text-muted">Calculá tu envío para continuar</p>
              )}

              <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-subtle">
                <Lock className="h-3.5 w-3.5 shrink-0" /> Compra protegida · Tus datos no se comparten
              </p>
            </div>

            {/* Contacto discreto (reemplaza al botón flotante de WhatsApp en el checkout) */}
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block text-center text-[12px] text-subtle transition-colors hover:text-accent"
              >
                ¿Dudas? Escribinos
              </a>
            )}
          </div>
        </aside>
      </div>

      {/* ───────── Barra fija inferior (mobile): total + CTA, detalle expandible ───────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-background lg:hidden">
        {mobileSummaryOpen && (
          <div className="max-h-[45vh] overflow-y-auto border-b border-line px-5 py-4">{summaryRows}</div>
        )}
        <div className="flex items-center gap-3 px-5 py-3">
          <button
            type="button"
            onClick={() => setMobileSummaryOpen((v) => !v)}
            aria-expanded={mobileSummaryOpen}
            className="flex flex-col text-left"
          >
            <span className="flex items-center gap-1 text-[11px] text-muted">
              {mobileSummaryOpen ? 'Ocultar' : 'Ver'} detalle
              <ChevronUp className={`h-3 w-3 transition-transform ${mobileSummaryOpen ? '' : 'rotate-180'}`} />
            </span>
            <span className="text-[18px] font-medium text-text">{formatPrice(orderTotal)}</span>
          </button>
          <div className="ml-auto min-w-0 max-w-[220px] flex-1">
            {payMethods.length > 0 ? (
              <button
                type="button"
                onClick={handlePay}
                disabled={ctaDisabled}
                className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-primary py-3 text-[14px] font-medium text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading !== null ? (
                  <><Spinner size={16} /> {routing === 'wa' ? 'Procesando…' : 'Redirigiendo…'}</>
                ) : (
                  'Confirmar pedido'
                )}
              </button>
            ) : (
              <p className="text-right text-[12px] text-subtle">Sin medios de pago</p>
            )}
          </div>
        </div>
        {mustQuoteShipping && payMethods.length > 0 && (
          <p className="px-5 pb-2 text-[11px] text-muted">Calculá tu envío para continuar</p>
        )}
      </div>
    </div>
  );
}
