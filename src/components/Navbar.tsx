import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { instagramHref } from '@/lib/storeConfig';

const navLink = ({ isActive }: { isActive: boolean }) =>
  `text-[14px] tracking-[0.5px] font-semibold uppercase transition-colors ${
    isActive ? 'text-text' : 'text-muted hover:text-accent'
  }`;

const mobileNavLink = ({ isActive }: { isActive: boolean }) =>
  `block py-3 text-[14px] tracking-[1px] font-semibold uppercase transition-colors ${
    isActive ? 'text-text' : 'text-muted hover:text-accent'
  }`;

export function Navbar() {
  const config = useStore();
  const { itemCount, open } = useCart();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const ig = instagramHref(config.instagramUrl);

  // Nota: los outfits se muestran como sección en el home; no hay página /outfits
  // dedicada (la ruta no existe), por eso no se agrega al nav para evitar un 404.
  const navItems = [
    { label: 'INICIO', to: '/', end: true },
    { label: 'PRODUCTOS', to: '/productos', end: false },
    { label: 'CATEGORÍAS', to: '/categorias', end: false },
  ];

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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
        {/* Izquierda: hamburguesa (mobile) + nav (desktop) */}
        <div className="flex items-center justify-start">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            className="flex h-9 w-9 items-center justify-center text-text hover:text-accent md:hidden"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileOpen ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
          <nav className="hidden items-center gap-7 md:flex">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navLink}>
                {item.label}
              </NavLink>
            ))}
          </nav>
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
            <span className="truncate font-heading text-[18px] font-extrabold uppercase tracking-[1px] text-text md:text-[22px]">
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
              className="hidden text-[14px] font-semibold uppercase tracking-[0.5px] text-muted transition-colors hover:text-accent md:inline"
            >
              INSTAGRAM
            </a>
          )}
          <button
            type="button"
            onClick={open}
            aria-label="Abrir carrito"
            className="relative inline-flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[0.5px] text-text transition-colors hover:text-accent"
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

      {/* Menú mobile */}
      {mobileOpen && (
        <div className="border-t border-line bg-background md:hidden">
          <nav className="mx-auto max-w-none px-6 py-4">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={mobileNavLink}>
                {item.label}
              </NavLink>
            ))}
            {ig && (
              <a
                href={ig}
                target="_blank"
                rel="noreferrer"
                className="block border-t border-line py-3 text-[14px] font-semibold uppercase tracking-[1px] text-muted hover:text-accent"
              >
                INSTAGRAM
              </a>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
