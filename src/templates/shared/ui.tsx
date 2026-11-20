import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { useCartPromos } from '@/hooks/useCartPromos';
import { cartLineKey } from '@/lib/cart';
import type { CartItem } from '@/lib/types';

/** ESC cierra, el fondo no scrollea y el foco entra al panel (y vuelve al cerrar). */
export function useOverlay(open: boolean, close: () => void, panel: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, [tabindex="0"]');
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('button, a[href], input')?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, close, panel]);
}

/** Cierra un panel cuando cambia la ruta. */
export function useCloseOnRoute(close: () => void) {
  const { pathname, search } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);
}

/** ¿Se scrolleó la página? (para la sombra o el cambio del encabezado). */
export function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > offset);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [offset]);
  return scrolled;
}

/** Buscar: lleva al catálogo con ?q=. */
export function useSearchSubmit() {
  const navigate = useNavigate();
  return (q: string) => {
    const t = q.trim();
    navigate(t ? `/productos?q=${encodeURIComponent(t)}` : '/productos');
  };
}

/** Logo real de la tienda; sin logo, su nombre como texto. */
export function StoreMark({ className, height }: { className?: string; height?: number }) {
  const { logoUrl, name } = useStore();
  if (logoUrl) return <img src={logoUrl} alt={name} className={className} style={height ? { height } : undefined} />;
  return <span className={className}>{name}</span>;
}

export interface CartLine {
  key: string;
  item: CartItem;
  unit: number;
  total: number;
  /** Precio unitario antes de promos (si hubo). */
  before: number | null;
}

/** Carrito con las promos por cantidad aplicadas (mismo cálculo que Classic). */
export function useCartView() {
  const cart = useCart();
  const { freeShippingFrom } = useStore();
  const { unitFinal, adjustedSubtotal } = useCartPromos();
  const lines: CartLine[] = cart.items.map((item) => {
    const unit = unitFinal(item);
    const original = item.unit_price_original ?? item.unit_price;
    return {
      key: cartLineKey(item),
      item,
      unit,
      total: unit * item.qty,
      before: original > unit ? original : null,
    };
  });
  const subtotal = adjustedSubtotal;
  const freeShippingLeft = freeShippingFrom > 0 ? Math.max(0, freeShippingFrom - subtotal) : null;
  return { ...cart, lines, subtotal, freeShippingFrom, freeShippingLeft };
}

/**
 * Achica la letra de un título hasta que entre en su renglón (nombres largos
 * sin espacios, como "DESDEABAJO.IND"). Nunca la agranda ni corta el texto.
 */
export function useFitText<T extends HTMLElement>(text: string, min = 24) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = '';
      const max = parseFloat(getComputedStyle(el).fontSize);
      const ratio = el.clientWidth / Math.max(1, el.scrollWidth);
      if (ratio < 1) el.style.fontSize = `${Math.max(min, Math.floor(max * ratio * 0.98))}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [text, min]);
  return ref;
}
