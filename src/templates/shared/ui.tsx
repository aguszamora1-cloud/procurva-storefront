import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { useCartPromos } from '@/hooks/useCartPromos';
import { useCartCoupon } from '@/hooks/useCartCoupon';
import { useCoupon } from '@/context/CouponContext';
import { buildCartRows, cartTotals } from './cartRows';
import { logoWeight } from './storeFacts';

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

/**
 * Logo real de la tienda; sin logo, su nombre como texto. Con imagen deja en
 * `--mark-k` su peso óptico (logoWeight): el CSS de cada plantilla calcula el
 * alto con eso y el ancho sale de la proporción original (`width: auto`), así que
 * nunca se deforma ni se recorta. Antes de medir (imagen cargando) vale 1.
 */
export function StoreMark({ className, height }: { className?: string; height?: number }) {
  const { logoUrl, name } = useStore();
  const [k, setK] = useState<number | null>(null);
  const ref = useRef<HTMLImageElement>(null);
  const measure = (img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth > 0) setK(logoWeight(img.naturalWidth, img.naturalHeight));
  };
  useLayoutEffect(() => measure(ref.current), [logoUrl]);
  if (logoUrl) {
    const style: Record<string, string | number> = {};
    if (height) style.height = height;
    if (k != null) style['--mark-k'] = k;
    return (
      <img
        ref={ref}
        src={logoUrl}
        alt={name}
        className={className}
        style={style as CSSProperties}
        onLoad={(e) => measure(e.currentTarget)}
      />
    );
  }
  return <span className={className}>{name}</span>;
}

export type { CartAmount, CartGroupKind, CartRow } from './cartRows';
export { unitsLabel } from './cartRows';

/**
 * Carrito de las plantillas con la agrupación y los precios de Classic (ver
 * cartRows.ts). A propósito NO devuelve `updateQty` ni `removeItem`: la única
 * forma de cambiar una cantidad desde una plantilla es `row.qty`, que sólo
 * existe en los productos sueltos.
 */
export function useCartView() {
  const { items, isOpen, open, close, itemCount, updateQty, removeItem } = useCart();
  const config = useStore();
  const { byLine } = useCartPromos();
  // Los mismos precios y cupón que Classic y el checkout (lib/cartAmounts).
  const coupon = useCartCoupon();
  const { savedCoupon } = useCoupon();
  const rows = buildCartRows(items, coupon.pricedItems, byLine, config, { updateQty, removeItem });
  return { isOpen, open, close, itemCount, rows, ...cartTotals(coupon, config, savedCoupon?.code ?? null) };
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
