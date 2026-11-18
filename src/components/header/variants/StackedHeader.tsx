import { useEffect, useRef, useState } from 'react';
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
 * Lugares del logo (header/logoMetrics), aprobados en F1.1c-D. Mástil de 112px:
 * más área y menos ancho máximo que Inline, para que los logos compactos
 * (Rosario Sportwear, Mayorista) tengan presencia y los horizontales finos no
 * dominen. Compacto: fila de 52px. Teléfono: fila de 60px.
 */
const LOGO_MAST: LogoSlot = { area: 8000, minH: 26, maxH: 60, maxW: 250, strictMaxH: 80 };
const LOGO_COMPACT: LogoSlot = { area: 2600, minH: 18, maxH: 36, maxW: 150, strictMaxH: 44 };
const LOGO_MOBILE: LogoSlot = { area: 2000, minH: 16, maxH: 36, maxW: 150, strictMaxH: 44 };

const FOCUS =
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-current';
/** Acciones de escritorio: versalitas chicas, un registro distinto del de la navegación. */
const ACTION = `inline-flex items-center gap-1 whitespace-nowrap text-[calc(11.5px_*_var(--font-scale,1))] font-medium uppercase tracking-[0.16em] text-on-surface decoration-1 underline-offset-[7px] hover:underline ${FOCUS}`;
/** Íconos de teléfono: área táctil de 44px, trazo fino. */
const ICON_BUTTON = `relative inline-flex h-11 w-11 items-center justify-center text-on-surface ${FOCUS}`;

/**
 * Encabezado Stacked · Mástil (editorial).
 *
 * Escritorio (lg, 1024px+): mástil de 112px con el logo solo y centrado; debajo,
 * una fila de 52px con la navegación centrada (apariencia editorial, banda a
 * todo el ancho para categorías y promociones) y las acciones en versalitas
 * chicas a la derecha. Columnas laterales fijas (200px; 240px desde 1280) para
 * que el centrado y "Más" no choquen con el logo chico ni con las acciones.
 *
 * Al desplazar: la fila de navegación es el ancla (`data-sticky-anchor`) que
 * Layout deja pegada; las franjas y el mástil se van con el scroll, sin cambiar
 * de alto (CLS 0). Cuando el mástil sale de la vista (IntersectionObserver, sin
 * escuchar el scroll) aparece el logo chico de la izquierda, sólo con opacidad.
 * Los tres logos (mástil, compacto, teléfono) se montan juntos desde el primer
 * render: comparten la medición y la descarga del archivo (un <img> creado más
 * tarde volvería a pedirlo: con caché HTTP sale de la caché, Storage responde
 * `public, max-age=3600`; sin caché, como en las pruebas con route(), se baja de nuevo).
 *
 * Teléfono y tablet: fila de 60px (ancla) con menú y búsqueda a la izquierda,
 * logo centrado y carrito a la derecha. El menú es el de Inline
 * (InlineMenuSheet) y la búsqueda la compartida.
 *
 * P0-2 B4: igual que F1.1c salvo la fila de secciones de 42px del teléfono, que
 * no fue aprobada y no se incorpora (ni su parámetro de desarrollo).
 */
export function StackedHeader() {
  const config = useStore();
  const { headerVars, menuOpen, setMenuOpen, searchOpen, setSearchOpen } = useHeader();
  const { itemCount, open: openCart } = useCart();
  const mastRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  // Compacto = el mástil ya no se ve (la fila quedó pegada arriba). Pegado, el
  // mástil termina justo en el borde de la ventana, y tocar el borde cuenta como
  // intersección: el margen de -1px lo deja afuera (y absorbe el redondeo del top).
  useEffect(() => {
    const el = mastRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { rootMargin: '-1px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <header className="bg-background">
      <div style={headerVars} className="bg-background">
        {/* Escritorio */}
        <div className="hidden lg:block">
          <div ref={mastRef} className="flex h-[112px] items-center justify-center px-10">
            <OpticalLogo slot={LOGO_MAST} strictH={config.logoHeight} className="max-w-[320px]" />
          </div>
          <div data-sticky-anchor="" className="relative border-y border-b-line border-t-line-soft">
            <div className="mx-auto grid h-[52px] max-w-[1600px] grid-cols-[200px_minmax(0,1fr)_200px] items-stretch px-8 xl:grid-cols-[240px_minmax(0,1fr)_240px] xl:px-10">
              <div
                className={`flex items-center transition-[opacity,visibility] duration-200 motion-reduce:transition-none ${
                  compact ? 'visible opacity-100' : 'invisible opacity-0'
                }`}
              >
                <OpticalLogo slot={LOGO_COMPACT} strictH={config.logoHeight} className="max-w-[150px]" />
              </div>
              <DesktopNav appearance="editorial" panels="band" />
              <div className="flex items-center justify-end gap-8">
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
          </div>
        </div>

        {/* Teléfono y tablet */}
        <div className="border-b border-line lg:hidden">
          <div data-sticky-anchor="" className="grid h-[60px] grid-cols-[1fr_auto_1fr] items-center px-1">
            <div className="flex items-center">
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
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                aria-label="Buscar productos"
                aria-expanded={searchOpen}
                className={ICON_BUTTON}
              >
                <Search className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
            <OpticalLogo slot={LOGO_MOBILE} strictH={config.logoHeight} className="max-w-[160px]" />
            <div className="flex items-center justify-end">
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
            </div>
          </div>
        </div>
      </div>

      <SearchPanel />
      <InlineMenuSheet />
    </header>
  );
}
