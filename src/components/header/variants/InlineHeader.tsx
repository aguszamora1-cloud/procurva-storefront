import { Search } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { DesktopNav } from '../DesktopNav';
import { useHeader } from '../HeaderContext';
import { InlineMenuSheet } from '../InlineMenuSheet';
import type { LogoSlot } from '../logoMetrics';
import { OpticalLogo } from '../OpticalLogo';
import { SearchPanel } from '../SearchPanel';

/**
 * Lugar del logo (header/logoMetrics): misma presencia para logos anchos y
 * cuadrados (área del contenido), con topes. strictMaxH: el archivo entero
 * cuando no se puede medir; entra en la barra (80 / 60 px).
 */
const LOGO_DESKTOP: LogoSlot = { area: 3000, minH: 18, maxH: 44, maxW: 200, strictMaxH: 56 };
const LOGO_MOBILE: LogoSlot = { area: 1800, minH: 16, maxH: 34, maxW: 150, strictMaxH: 40 };

const FOCUS =
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-current';
/** Acciones de escritorio en texto, mismo registro que la navegación. */
const ACTION = `inline-flex items-center gap-1 whitespace-nowrap text-[calc(12.5px_*_var(--font-scale,1))] font-medium uppercase tracking-[0.14em] text-on-surface decoration-1 underline-offset-[7px] hover:underline ${FOCUS}`;
/** Íconos de teléfono: área táctil de 44px, trazo fino. */
const ICON_BUTTON = `relative inline-flex h-11 w-11 items-center justify-center text-on-surface ${FOCUS}`;

/**
 * Encabezado Inline (minimalista / editorial).
 *
 * Escritorio (lg, 1024px+): una sola fila de 80px. Logo y navegación forman un
 * grupo a la izquierda (56px entre ellos; la columna del logo mide lo que mide
 * su contenido) y las acciones en texto van a la derecha ("Buscar",
 * "Carrito (n)"). Un filete inferior, sin sombra.
 *
 * Teléfono y tablet: barra propia de 60px. Logo a la izquierda; búsqueda,
 * carrito con su cantidad y menú a la derecha, con área táctil de 44px. El menú
 * es propio de Inline (InlineMenuSheet, pantalla completa).
 *
 * El logo se dimensiona por su contenido visible (OpticalLogo); la búsqueda es
 * la compartida (SearchPanel).
 */
export function InlineHeader() {
  const config = useStore();
  const { headerVars, menuOpen, setMenuOpen, searchOpen, setSearchOpen } = useHeader();
  const { itemCount, open: openCart } = useCart();

  return (
    <header className="border-b border-line bg-background">
      <div style={headerVars} className="bg-background">
        {/* Escritorio */}
        <div className="mx-auto hidden h-20 max-w-[1600px] grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-14 px-10 lg:grid">
          <OpticalLogo slot={LOGO_DESKTOP} strictH={config.logoHeight} className="max-w-[220px] self-center" />
          <DesktopNav />
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Buscar productos"
              aria-expanded={searchOpen}
              className={`${ACTION} ${searchOpen ? 'underline' : ''}`}
            >
              Buscar
            </button>
            <button type="button" onClick={openCart} aria-label="Abrir carrito" className={ACTION}>
              Carrito
              {itemCount > 0 && <span className="tabular-nums">({itemCount})</span>}
            </button>
          </div>
        </div>

        {/* Teléfono y tablet */}
        <div className="flex h-[60px] items-center justify-between gap-2 pl-4 pr-1 lg:hidden">
          <OpticalLogo slot={LOGO_MOBILE} strictH={config.logoHeight} className="max-w-[55%]" />
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Buscar productos"
              aria-expanded={searchOpen}
              className={ICON_BUTTON}
            >
              <Search className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button type="button" onClick={openCart} aria-label="Abrir carrito" className={ICON_BUTTON}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {itemCount > 0 && (
                <span className="absolute right-1 top-1.5 text-[calc(10px_*_var(--font-scale,1))] font-semibold leading-none tabular-nums">
                  {itemCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
              aria-expanded={menuOpen}
              className={ICON_BUTTON}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M4 9h16M4 15h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <SearchPanel />
      <InlineMenuSheet />
    </header>
  );
}
