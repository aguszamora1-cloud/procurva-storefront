import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { instagramHref } from '@/lib/storeConfig';

const drawerLink = ({ isActive }: { isActive: boolean }) =>
  `block py-3 text-[15px] tracking-[1px] font-semibold uppercase transition-colors ${
    isActive ? 'text-accent' : 'text-on-surface hover:text-accent'
  }`;

interface CategoryOrderRow {
  category_name: string;
  visible: boolean | null;
}

export function Navbar() {
  const config = useStore();
  const { itemCount, open } = useCart();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [scrolled, setScrolled] = useState(false);

  const ig = instagramHref(config.instagramUrl);

  // Links principales del menú. (Outfits se muestra como sección del home, no
  // tiene página propia, así que no se agrega para evitar un 404.)
  const navItems = [
    { label: 'INICIO', to: '/', end: true },
    { label: 'PRODUCTOS', to: '/productos', end: false },
  ];

  // Subcategorías del menú: categorías activas del comercio (tabla liviana,
  // un solo fetch mientras el navbar está montado).
  useEffect(() => {
    const cid = config.companyId;
    if (!cid) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('catalog_category_order')
        .select('category_name, sort_order, visible')
        .eq('company_id', cid)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      const rows = (data as CategoryOrderRow[] | null) ?? [];
      setCategories(rows.filter((r) => r.visible !== false).map((r) => r.category_name));
    })();
    return () => {
      cancelled = true;
    };
  }, [config.companyId]);

  // Cerrar el menú al cambiar de ruta (anima la salida porque queda montado).
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

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

  return (
    <header
      className={`border-b border-line bg-background transition-shadow duration-200 ${
        scrolled ? 'shadow-md' : ''
      }`}
    >
      <div className="mx-auto grid max-w-none grid-cols-3 items-center gap-2 px-4 py-3 md:px-6">
        {/* Izquierda: hamburguesa (desktop + mobile) */}
        <div className="flex items-center justify-start">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center text-on-surface hover:text-accent"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>

        {/* Centro: logo */}
        <Link to="/" className="flex min-w-0 items-center justify-center" aria-label={config.name}>
          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt={config.name}
              style={{ height: config.logoHeight }}
              className="w-auto max-w-full object-contain"
              loading="eager"
            />
          ) : (
            <span className="truncate font-heading text-[18px] font-extrabold uppercase tracking-[1px] text-on-surface md:text-[22px]">
              {config.name}
            </span>
          )}
        </Link>

        {/* Derecha: instagram (desktop) + carrito */}
        <div className="flex items-center justify-end gap-3 md:gap-6">
          {ig && (
            <a
              href={ig}
              target="_blank"
              rel="noreferrer"
              className="hidden text-[14px] font-semibold uppercase tracking-[0.5px] text-on-surface-muted transition-colors hover:text-accent md:inline"
            >
              INSTAGRAM
            </a>
          )}
          <button
            type="button"
            onClick={open}
            aria-label="Abrir carrito"
            className="relative inline-flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[0.5px] text-on-surface transition-colors hover:text-accent"
          >
            <svg className="sm:hidden" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span className="hidden sm:inline">CARRITO</span>
            {itemCount > 0 && (
              <span className="shape-circle absolute -right-3 -top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-on-accent sm:static sm:translate-y-0">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Overlay del menú (cierra al tocar fuera) */}
      <div
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Drawer de navegación (slide in desde la izquierda) */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        className={`fixed left-0 top-0 z-50 flex h-full w-[300px] max-w-[82vw] flex-col bg-background transition-transform duration-300 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <span className="font-heading text-[18px] font-extrabold uppercase tracking-[1px] text-on-surface">Menú</span>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
            className="flex h-8 w-8 items-center justify-center text-on-surface hover:text-accent"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-6 py-4">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMenuOpen(false)} className={drawerLink}>
              {item.label}
            </NavLink>
          ))}

          {/* Categorías (con subcategorías expandibles si las hay) */}
          <div>
            <div className="flex items-center justify-between">
              <NavLink to="/categorias" onClick={() => setMenuOpen(false)} className={drawerLink}>
                CATEGORÍAS
              </NavLink>
              {categories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCatOpen((v) => !v)}
                  aria-label={catOpen ? 'Colapsar categorías' : 'Expandir categorías'}
                  aria-expanded={catOpen}
                  className="p-2 text-on-surface-muted hover:text-accent"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${catOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
            {categories.length > 0 && catOpen && (
              <div className="mb-1 ml-1.5 border-l border-line-soft pl-3">
                {categories.map((c) => (
                  <Link
                    key={c}
                    to={`/categoria/${encodeURIComponent(c)}`}
                    onClick={() => setMenuOpen(false)}
                    className="block py-2 text-[13px] font-medium uppercase tracking-[0.5px] text-on-surface-muted transition-colors hover:text-accent"
                  >
                    {c}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Instagram dentro del menú (también accesible en mobile) */}
          {ig && (
            <a
              href={ig}
              target="_blank"
              rel="noreferrer"
              onClick={() => setMenuOpen(false)}
              className="mt-2 block border-t border-line py-3 text-[14px] font-semibold uppercase tracking-[1px] text-on-surface-muted hover:text-accent"
            >
              INSTAGRAM
            </a>
          )}
        </nav>
      </aside>
    </header>
  );
}
