import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CartItem } from '@/lib/types';
import { cartLineKey } from '@/lib/cart';

const CART_STORAGE_KEY = 'procurva_storefront_cart_v1';

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  addItem: (item: CartItem) => void;
  removeItem: (lineKey: string) => void;
  updateQty: (lineKey: string, qty: number) => void;
  clear: () => void;
  itemCount: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

function loadFromStorage(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadFromStorage());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const key = cartLineKey(item);
      const idx = prev.findIndex((p) => cartLineKey(p) === key);
      if (idx >= 0) {
        const copy = [...prev];
        const cur = { ...copy[idx], qty: copy[idx].qty + item.qty };
        // En curva, acumulamos también la cantidad de curvas para mostrar/agrupar bien.
        if (item.source === 'curva') cur.curves = (copy[idx].curves ?? 0) + (item.curves ?? 0);
        copy[idx] = cur;
        return copy;
      }
      return [...prev, item];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((lineKey: string) => {
    setItems((prev) => prev.filter((p) => cartLineKey(p) !== lineKey));
  }, []);

  const updateQty = useCallback((lineKey: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((p) => (cartLineKey(p) === lineKey ? { ...p, qty: Math.max(0, qty) } : p))
        .filter((p) => p.qty > 0),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((sum, i) => sum + i.qty, 0);
    const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.qty, 0);
    return {
      items,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((v) => !v),
      addItem,
      removeItem,
      updateQty,
      clear,
      itemCount,
      subtotal,
    };
  }, [items, isOpen, addItem, removeItem, updateQty, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
