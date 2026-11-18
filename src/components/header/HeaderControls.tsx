import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { useHeader } from './HeaderContext';

/**
 * Controles del encabezado que comparten las variantes: abrir el menú, abrir la
 * búsqueda, el logo y el carrito. Las clases son las del encabezado Classic.
 */

export function MenuButton() {
  const { menuOpen, setMenuOpen } = useHeader();
  return (
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
  );
}

export function SearchButton() {
  const { searchOpen, setSearchOpen } = useHeader();
  return (
    <button
      type="button"
      onClick={() => setSearchOpen((v) => !v)}
      aria-label="Buscar productos"
      aria-expanded={searchOpen}
      className="flex h-9 w-9 items-center justify-center text-on-surface hover:text-accent"
    >
      <Search className="h-[21px] w-[21px]" strokeWidth={2} />
    </button>
  );
}

export function HeaderLogo() {
  const config = useStore();
  return (
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
        <span className="truncate font-heading text-[calc(18px_*_var(--font-scale,1))] font-extrabold uppercase tracking-[1px] text-on-surface md:text-[calc(22px_*_var(--font-scale,1))]">
          {config.name}
        </span>
      )}
    </Link>
  );
}

export function CartButton() {
  const { itemCount, open } = useCart();
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Abrir carrito"
      className="relative inline-flex items-center gap-2 text-[calc(14px_*_var(--font-scale,1))] font-medium text-on-surface transition-colors hover:text-accent"
    >
      <svg className="sm:hidden" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      <span className="hidden sm:inline">Carrito</span>
      {itemCount > 0 && (
        <span className="shape-circle absolute -right-3 -top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center bg-accent px-1.5 py-0.5 text-[calc(10px_*_var(--font-scale,1))] font-bold leading-none text-on-accent sm:static sm:translate-y-0">
          {itemCount}
        </span>
      )}
    </button>
  );
}
