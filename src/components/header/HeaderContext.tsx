import {
  createContext,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { surfaceVars } from '@/lib/theme';
import { type HeaderNav, useHeaderNav } from './useHeaderNav';

/**
 * Estado del encabezado compartido por sus piezas (barra, búsqueda, menú
 * lateral, carrito). Es el mismo de antes de separar Navbar en piezas: cada
 * variante de encabezado arma su propia composición con estas piezas sin
 * duplicar la lógica comercial ni los efectos.
 */
interface HeaderContextValue {
  nav: HeaderNav;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean | ((v: boolean) => boolean)) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  submitSearch: (e: FormEvent) => void;
  scrolled: boolean;
  /** Fondo propio del encabezado (si el comercio lo eligió). undefined = lo de siempre. */
  headerVars: CSSProperties | undefined;
  /** Lleva a la sección Outfits del home (no tiene página propia) y cierra el menú. */
  goToOutfits: () => void;
}

const HeaderContext = createContext<HeaderContextValue | null>(null);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const config = useStore();
  const nav = useHeaderNav();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cerrar el menú y la búsqueda al cambiar de ruta (anima la salida porque queda montado).
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  // Al abrir la búsqueda, enfocar el input; Escape la cierra.
  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  // Enviar la búsqueda: navega al listado con ?q= y cierra la barra.
  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/productos?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
  };

  // Ir a la sección Outfits del home (sin página propia): scrollea al ancla,
  // reintentando si venimos de otra ruta hasta que la sección monte (datos async).
  const goToOutfits = () => {
    setMenuOpen(false);
    const scroll = () => {
      const el = document.getElementById('outfits');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      }
      return false;
    };
    if (location.pathname === '/') {
      scroll();
      return;
    }
    navigate('/');
    let tries = 0;
    const iv = window.setInterval(() => {
      if (scroll() || ++tries > 20) window.clearInterval(iv);
    }, 150);
  };

  // Mientras el menú está abierto: bloquear scroll del body y cerrar con Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  // Sombra del navbar sólo cuando el usuario ya scrolleó (en el top, sin sombra).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fondo propio del encabezado (si el comercio lo eligió). undefined = hereda
  // los tokens de la página, o sea, exactamente lo de siempre.
  const headerVars = config.headerBackground
    ? (surfaceVars(config.headerBackground) as CSSProperties)
    : undefined;

  return (
    <HeaderContext.Provider
      value={{
        nav,
        menuOpen,
        setMenuOpen,
        searchOpen,
        setSearchOpen,
        searchQuery,
        setSearchQuery,
        searchInputRef,
        submitSearch,
        scrolled,
        headerVars,
        goToOutfits,
      }}
    >
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader(): HeaderContextValue {
  const ctx = useContext(HeaderContext);
  if (!ctx) throw new Error('useHeader fuera de HeaderProvider');
  return ctx;
}
