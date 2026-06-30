import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle, MessageCircle } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useStore } from '@/context/StoreProvider';
import { flushPendingPurchase } from '@/lib/metaPixel';
import { Seo } from '@/components/Seo';
import { formatPrice } from '@/lib/utils';

type Variant = 'success' | 'failure' | 'pending';

const CONTENT: Record<Variant, { icon: typeof CheckCircle2; color: string; title: string; text: string }> = {
  success: {
    icon: CheckCircle2,
    color: 'text-accent',
    title: '¡Gracias por tu compra!',
    text: 'Recibimos tu pago. Te vamos a contactar para coordinar la entrega de tu pedido.',
  },
  pending: {
    icon: Clock,
    color: 'text-amber-500',
    title: 'Tu pago está siendo procesado',
    text: 'Apenas se acredite vas a recibir la confirmación. No hace falta que pagues de nuevo.',
  },
  failure: {
    icon: XCircle,
    color: 'text-red-500',
    title: 'Hubo un problema con el pago',
    text: 'No pudimos procesar tu pago. Podés intentar de nuevo o finalizar tu compra por WhatsApp.',
  },
};

// Bloque con los datos bancarios para que el cliente transfiera. Se muestra en la
// pantalla de éxito cuando el pedido se cerró por transferencia bancaria directa
// (sin pasarela ni coordinación por WhatsApp). El monto viene por query param.
function TransferDetails({ amount }: { amount: number | null }) {
  const config = useStore();
  const ta = config.transferAccount;
  const [copied, setCopied] = useState<string | null>(null);
  if (!ta) return null;

  const hasStructured = Boolean(ta.alias || ta.cbu);
  const copy = (value: string, key: string) => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    });
  };
  const copyBtn =
    'shrink-0 rounded-[7px] border border-line px-3 py-1.5 text-[12px] font-bold text-accent transition-colors hover:bg-accent hover:text-on-accent';

  return (
    <div className="mt-2 w-full max-w-[440px] rounded-[12px] border border-accent/40 bg-accent/5 p-4 text-left">
      <p className="mb-3 text-[13px] font-bold text-text">Datos para la transferencia</p>
      <div className="space-y-2.5">
        {ta.alias && (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Alias</p>
              <p className="truncate text-[14px] font-bold text-text">{ta.alias}</p>
            </div>
            <button type="button" onClick={() => copy(ta.alias, 'alias')} className={copyBtn}>
              {copied === 'alias' ? 'Copiado' : 'Copiar alias'}
            </button>
          </div>
        )}
        {ta.cbu && (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">CBU / CVU</p>
              <p className="truncate text-[14px] font-bold text-text">{ta.cbu}</p>
            </div>
            <button type="button" onClick={() => copy(ta.cbu, 'cbu')} className={copyBtn}>
              {copied === 'cbu' ? 'Copiado' : 'Copiar CBU'}
            </button>
          </div>
        )}
        {ta.holder && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Titular</p>
            <p className="truncate text-[13px] font-medium text-text">{ta.holder}</p>
          </div>
        )}
        {ta.cuit && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">CUIT</p>
            <p className="truncate text-[13px] font-medium text-text">{ta.cuit}</p>
          </div>
        )}
        {!hasStructured && ta.details && (
          <div className="flex items-start justify-between gap-3">
            <p className="whitespace-pre-line text-[13px] text-text">{ta.details}</p>
            <button type="button" onClick={() => copy(ta.details, 'details')} className={copyBtn}>
              {copied === 'details' ? 'Copiado' : 'Copiar datos'}
            </button>
          </div>
        )}
        {amount != null && amount > 0 && (
          <div className="flex items-center justify-between border-t border-line pt-2.5">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Monto a transferir</span>
            <span className="text-[16px] font-extrabold text-text">{formatPrice(amount)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckoutStatus({ variant }: { variant: Variant }) {
  const { clear } = useCart();
  const config = useStore();
  const [params] = useSearchParams();
  const orderId = params.get('order');
  // Transferencia bancaria directa: el checkout redirige acá con ?transfer=1 y el
  // monto. En ese caso mostramos los datos para transferir y un copy acorde, en
  // vez del "recibimos tu pago" (que todavía no ocurrió).
  const isTransfer = variant === 'success' && params.get('transfer') === '1';
  const totalParam = params.get('total');
  const transferAmount = totalParam ? Number(totalParam) : null;

  // Pedido cerrado por WhatsApp (efectivo / transferencia sin cuenta cargada): el
  // checkout YA registró el pedido y dejó el link de WhatsApp en sessionStorage. Acá
  // confirmamos "Pedido registrado" + N° y ofrecemos un botón para mandarlo. No
  // abrimos WhatsApp solos: que el cliente vea primero que su pedido quedó hecho.
  const isWhatsapp = variant === 'success' && params.get('method') === 'wa';
  const whatsappHref = isWhatsapp && orderId ? sessionStorage.getItem(`wa_order_${orderId}`) : null;

  const base = CONTENT[variant];
  const { icon: Icon, color } = base;
  const title = isTransfer || isWhatsapp ? '¡Pedido registrado!' : base.title;
  const text = isTransfer
    ? 'Para confirmar tu pedido, transferí el monto a los siguientes datos y envianos el comprobante. En cuanto lo recibamos lo preparamos.'
    : isWhatsapp
      ? whatsappHref
        ? 'Tu pedido quedó guardado. Envianoslo por WhatsApp para coordinar la entrega y el pago.'
        : 'Tu pedido quedó registrado. Te vamos a contactar para coordinar la entrega y el pago.'
      : base.text;

  // En una compra exitosa el carrito ya cumplió su función: lo vaciamos.
  useEffect(() => {
    if (variant === 'success') clear();
  }, [variant, clear]);

  // Meta Pixel: disparamos Purchase si quedó una compra pendiente (la dejó el
  // checkout antes de redirigir a la pasarela). Reintentamos un rato corto por
  // si el pixel todavía está cargando al volver de Mercado Pago / GoCuotas.
  useEffect(() => {
    if (variant !== 'success') return;
    let timer: number | undefined;
    let tries = 0;
    const attempt = () => {
      if (flushPendingPurchase()) return; // disparó, o no había nada pendiente
      if (++tries > 20) return; // ~2s esperando a que cargue el pixel
      timer = window.setTimeout(attempt, 100);
    };
    timer = window.setTimeout(attempt, 0);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [variant]);

  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-center gap-5 px-6 py-24 text-center">
      <Seo title={`${title} · ${config.name}`} slug={config.slug} noindex />
      <Icon size={64} className={isTransfer ? 'text-amber-500' : color} strokeWidth={1.5} />
      <h1 className="font-heading text-[28px] font-semibold uppercase tracking-[1px] text-text md:text-[34px]">{title}</h1>
      <p className="max-w-[440px] text-[15px] leading-relaxed text-muted">{text}</p>
      {orderId && (
        <p className="text-[12px] text-subtle">N° de pedido: {orderId.slice(0, 8).toUpperCase()}</p>
      )}
      {isTransfer && <TransferDetails amount={transferAmount} />}
      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center justify-center gap-2.5 rounded-[10px] bg-[#25D366] px-8 py-4 text-[15px] font-bold uppercase tracking-[0.5px] text-white shadow-sm transition-transform hover:scale-[1.02]"
        >
          <MessageCircle size={20} strokeWidth={2.2} />
          Enviar pedido por WhatsApp
        </a>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        {variant === 'failure' ? (
          <Link to="/checkout" className="rounded-[10px] bg-primary px-7 py-3.5 text-[14px] font-bold uppercase tracking-[0.5px] text-on-primary transition-all hover:bg-accent hover:text-on-accent">
            Reintentar
          </Link>
        ) : (
          <Link to="/productos" className="rounded-[10px] bg-primary px-7 py-3.5 text-[14px] font-bold uppercase tracking-[0.5px] text-on-primary transition-all hover:bg-accent hover:text-on-accent">
            Seguir comprando
          </Link>
        )}
        <Link to="/" className="text-[12px] uppercase tracking-wide text-subtle hover:text-accent">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

export function CheckoutSuccess() {
  return <CheckoutStatus variant="success" />;
}

export function CheckoutFailure() {
  return <CheckoutStatus variant="failure" />;
}

export function CheckoutPending() {
  return <CheckoutStatus variant="pending" />;
}
