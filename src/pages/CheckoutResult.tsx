import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useCart } from '@/context/CartContext';

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

function CheckoutStatus({ variant }: { variant: Variant }) {
  const { clear } = useCart();
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const { icon: Icon, color, title, text } = CONTENT[variant];

  // En una compra exitosa el carrito ya cumplió su función: lo vaciamos.
  useEffect(() => {
    if (variant === 'success') clear();
  }, [variant, clear]);

  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-center gap-5 px-6 py-24 text-center">
      <Icon size={64} className={color} strokeWidth={1.5} />
      <h1 className="font-heading text-[28px] font-semibold uppercase tracking-[1px] text-text md:text-[34px]">{title}</h1>
      <p className="max-w-[440px] text-[15px] leading-relaxed text-muted">{text}</p>
      {orderId && (
        <p className="text-[12px] text-subtle">N° de pedido: {orderId.slice(0, 8).toUpperCase()}</p>
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
