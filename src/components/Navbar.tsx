import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Instagram, Menu, ShoppingBag, X } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { instagramHref } from '@/lib/storeConfig';

const NAV_ITEMS = [
  { label: 'Inicio', to: '/' },
  { label: 'Productos', to: '/productos' },
  { label: 'Categorías', to: '/categorias' },
];

export function Navbar() {
  const config = useStore();
  const { itemCount, open } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  const ig = instagramHref(config.instagramUrl);

  return (
    <>
      {config.topBarText && (
        <div className="bg-primary text-[var(--color-on-primary)]">
          <div className="mx-auto max-w-7xl overflow-hidden px-4 py-2 text-center">
            <span
              className={`subtitle-label inline-block whitespace-nowrap ${
                config.topBarAnimated ? 'animate-marquee' : ''
              }`}
            >
              {config.topBarText}
            </span>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-line bg-background/90 backdrop-blur-md">
        <nav className="mx-auto grid max-w-7xl grid-cols-3 items-center px-4 py-3 md:py-4">
          {/* Izquierda: hamburguesa (mobile) + nav (desktop) */}
          <div className="flex items-center justify-start gap-6">
            <button
              type="button"
              aria-label="Abrir menú"
              className="md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div className="hidden items-center gap-6 md:flex">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `nav-link transition-colors hover:text-accent ${
                      isActive ? 'text-accent' : 'text-text'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          {/* Centro: logo */}
          <div className="flex items-center justify-center">
            <Link to="/" className="flex items-center justify-center">
              {config.logoUrl ? (
                <img
                  src={config.logoUrl}
                  alt={config.name}
                  style={{ height: config.logoHeight }}
                  className="w-auto object-contain"
                />
              ) : (
                <span className="font-heading text-lg font-extrabold uppercase tracking-tight">
                  {config.name}
                </span>
              )}
            </Link>
          </div>

          {/* Derecha: instagram + carrito */}
          <div className="flex items-center justify-end gap-4">
            {ig && (
              <a
                href={ig}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="hidden text-text transition-colors hover:text-accent md:block"
              >
                <Instagram size={20} />
              </a>
            )}
            <button
              type="button"
              aria-label="Abrir carrito"
              onClick={open}
              className="relative text-text transition-colors hover:text-accent"
            >
              <ShoppingBag size={22} />
              {itemCount > 0 && (
                <span className="shape-circle absolute -right-2 -top-2 flex h-5 min-w-[1.25rem] items-center justify-center bg-accent px-1 text-[0.65rem] font-bold text-[var(--color-on-accent)]">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </nav>

        {/* Menú mobile */}
        {menuOpen && (
          <div className="animate-fade-in border-t border-line bg-background md:hidden">
            <div className="flex flex-col px-4 py-2">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `nav-link py-3 ${isActive ? 'text-accent' : 'text-text'}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              {ig && (
                <a
                  href={ig}
                  target="_blank"
                  rel="noreferrer"
                  className="nav-link flex items-center gap-2 py-3 text-text"
                >
                  <Instagram size={18} /> Instagram
                </a>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
