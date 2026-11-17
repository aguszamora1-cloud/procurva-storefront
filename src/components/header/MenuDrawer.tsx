import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { promoPath } from '@/lib/promoPage';
import { useHeader } from './HeaderContext';
import { TrackingForm } from './TrackingForm';

const drawerLink = ({ isActive }: { isActive: boolean }) =>
  `block py-3 text-[calc(15px_*_var(--font-scale,1))] font-medium transition-colors ${
    isActive ? 'text-accent' : 'text-on-surface hover:text-accent'
  }`;

/**
 * Menú lateral de navegación del encabezado Classic (fondo + panel que entra
 * desde la izquierda). Va adentro del <header> y SIN el fondo propio del
 * encabezado: sigue con los colores de la página. Otras variantes podrán traer
 * el suyo; esta pieza es la de siempre.
 */
export function MenuDrawer() {
  const { nav, menuOpen, setMenuOpen, goToOutfits } = useHeader();
  const { navItems, menuPromos, categories, showOutfitsLink, menuItems } = nav;
  const [catOpen, setCatOpen] = useState(true);
  const [promoOpen, setPromoOpen] = useState(true);
  // Id del buscador de seguimiento desplegado (uno por vez, como el acordeón de categorías).
  const [trackingOpen, setTrackingOpen] = useState<string | null>(null);

  return (
    <>
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
        className={`fixed left-0 top-0 z-50 flex h-dvh w-[300px] max-w-[82vw] flex-col bg-background transition-transform duration-300 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <span className="font-heading text-[calc(18px_*_var(--font-scale,1))] font-extrabold uppercase tracking-[1px] text-on-surface">Menú</span>
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

        <nav className="flex-1 overflow-y-auto px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMenuOpen(false)} className={drawerLink}>
              {item.label}
            </NavLink>
          ))}

          {/* Promociones vigentes: aparece sola cuando hay al menos una. No tiene
              página índice (el encabezado sólo despliega), cada promo lleva a la suya. */}
          {menuPromos.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setPromoOpen((v) => !v)}
                aria-expanded={promoOpen}
                className="flex w-full items-center justify-between py-3 text-left text-[calc(15px_*_var(--font-scale,1))] font-medium text-on-surface transition-colors hover:text-accent"
              >
                PROMOCIONES
                <ChevronDown className={`h-4 w-4 text-on-surface-muted transition-transform ${promoOpen ? 'rotate-180' : ''}`} />
              </button>
              {promoOpen && (
                <div className="mb-1 ml-1.5 border-l border-line-soft pl-3">
                  {menuPromos.map((p) => (
                    <Link
                      key={p.id}
                      to={promoPath(p)}
                      onClick={() => setMenuOpen(false)}
                      className="block py-2 text-[calc(14px_*_var(--font-scale,1))] text-on-surface-muted transition-colors hover:text-accent"
                    >
                      {p.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

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
                    className="block py-2 text-[calc(14px_*_var(--font-scale,1))] text-on-surface-muted transition-colors hover:text-accent"
                  >
                    {c}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Outfits: sólo si la tienda tiene la sección activa y hay outfits. */}
          {showOutfitsLink && (
            <button
              type="button"
              onClick={goToOutfits}
              className="block w-full py-3 text-left text-[calc(15px_*_var(--font-scale,1))] font-medium text-on-surface transition-colors hover:text-accent"
            >
              Outfits
            </button>
          )}

          {/* Ítems que agrega el comercio desde el editor visual (Menú de
              navegación). Van al final, después de los fijos. */}
          {menuItems.map((item) => {
            if (item.kind === 'tracking') {
              const open = trackingOpen === item.id;
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => setTrackingOpen(open ? null : item.id)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-2 py-3 text-left text-[calc(15px_*_var(--font-scale,1))] font-medium text-on-surface transition-colors hover:text-accent"
                  >
                    <span className="min-w-0 truncate">{item.label}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-on-surface-muted transition-transform ${
                        open ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {open && <TrackingForm item={item} />}
                </div>
              );
            }

            if (item.kind === 'page') {
              return (
                <NavLink
                  key={item.id}
                  to={`/pagina/${item.slug}`}
                  onClick={() => setMenuOpen(false)}
                  className={drawerLink}
                >
                  {item.label}
                </NavLink>
              );
            }

            // Link externo: <a> nativo. Un href absoluto por <Link> lo trataría
            // como ruta interna del SPA y terminaría en el 404 de la tienda.
            return item.external ? (
              <a
                key={item.id}
                href={item.url}
                target={item.newTab ? '_blank' : undefined}
                rel={item.newTab ? 'noopener noreferrer' : undefined}
                onClick={() => setMenuOpen(false)}
                className="block py-3 text-[calc(15px_*_var(--font-scale,1))] font-medium text-on-surface transition-colors hover:text-accent"
              >
                {item.label}
              </a>
            ) : (
              <NavLink key={item.id} to={item.url} onClick={() => setMenuOpen(false)} className={drawerLink}>
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
