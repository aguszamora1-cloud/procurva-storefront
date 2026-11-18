import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { promoPath } from '@/lib/promoPage';
import { useHeader } from './HeaderContext';
import { desktopNavEntries, type NavEntry } from './navEntries';
import { TrackingForm } from './TrackingForm';

const FOCUS =
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-current';
/** Navegación principal: títulos grandes, peso medio, en minúscula, con filete. */
const PRIMARY = `flex w-full items-center justify-between gap-4 py-4 text-left font-heading text-[calc(26px_*_var(--font-scale,1))] font-medium leading-tight tracking-[-0.01em] text-on-surface ${FOCUS}`;
/** Sublista de un grupo desplegado. */
const SUB = `block py-2 text-[calc(16px_*_var(--font-scale,1))] leading-snug text-on-surface ${FOCUS}`;
/** Enlaces secundarios (páginas y links del comercio): más chicos, sin filete. */
const SECONDARY = `flex w-full items-center justify-between gap-3 py-2.5 text-left text-[calc(15px_*_var(--font-scale,1))] text-on-surface ${FOCUS}`;
const LABEL = 'text-[calc(11px_*_var(--font-scale,1))] font-semibold uppercase tracking-[0.18em] text-on-surface-muted';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';

/** Signo del desplegable: + cerrado, − abierto. */
const Sign = ({ open }: { open: boolean }) => (
  <span aria-hidden="true" className="w-5 text-center font-body text-[calc(22px_*_var(--font-scale,1))] font-light leading-none">
    {open ? '−' : '+'}
  </span>
);

/**
 * Menú de teléfono del encabezado Inline: pantalla completa, entra desde la
 * derecha. Mismos datos y orden que la navegación de escritorio
 * (desktopNavEntries): principal (Productos, Categorías, Promociones, Outfits)
 * en títulos grandes; páginas, links y seguimiento como secundarios.
 *
 * Accesibilidad: diálogo modal; al abrir, el foco va al botón de cerrar; Tab y
 * Shift+Tab quedan adentro; Escape (HeaderContext) cierra y el foco vuelve a
 * donde estaba. Cerrado queda `inert`: fuera del orden de tabulación. El scroll
 * del body lo bloquea HeaderContext; el contenido largo scrollea adentro, con
 * la barra de cierre fija arriba (también con el teclado del teléfono abierto).
 */
export function InlineMenuSheet() {
  const { nav, menuOpen, setMenuOpen, goToOutfits } = useHeader();
  const entries = desktopNavEntries(nav, promoPath);
  const primary = entries.filter((e) => ['productos', 'categorias', 'promociones', 'outfits'].includes(e.key));
  const secondary = entries.filter((e) => !primary.includes(e));
  const baseId = useId();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  // Foco: al abrir, al botón de cerrar; al cerrar, de vuelta a donde estaba.
  useEffect(() => {
    if (menuOpen) {
      returnTo.current = document.activeElement as HTMLElement | null;
      const raf = requestAnimationFrame(() => closeRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
    const back = returnTo.current;
    returnTo.current = null;
    if (back && back.isConnected) back.focus();
    setOpenKey(null);
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  // Tab encerrado en el panel.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !sheetRef.current) return;
    const items = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const group = (key: string, label: string, body: ReactNode, className: string, signClass = '') => {
    const open = openKey === key;
    const id = `${baseId}-${key}`;
    return (
      <>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpenKey(open ? null : key)}
          className={className}
        >
          <span className="min-w-0">{label}</span>
          <span className={signClass}>
            <Sign open={open} />
          </span>
        </button>
        {open && <div id={id}>{body}</div>}
      </>
    );
  };

  const renderPrimary = (e: NavEntry) => {
    switch (e.kind) {
      case 'categories':
        return group(
          e.key,
          e.label,
          <ul className="pb-5">
            {e.categories.map((c) => (
              <li key={c}>
                <Link to={`/categoria/${encodeURIComponent(c)}`} onClick={close} className={SUB}>
                  {c}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/categorias"
                onClick={close}
                className={`mt-2 inline-flex items-center gap-1.5 py-2 text-[calc(12px_*_var(--font-scale,1))] font-medium uppercase tracking-[0.14em] text-on-surface ${FOCUS}`}
              >
                Ver todas
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Link>
            </li>
          </ul>,
          PRIMARY,
        );
      case 'promos':
        return group(
          e.key,
          e.label,
          <ul className="pb-5">
            {e.promos.map((p) => (
              <li key={p.id}>
                <Link to={p.to} onClick={close} className={SUB}>
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>,
          PRIMARY,
        );
      case 'outfits':
        return (
          <button type="button" onClick={goToOutfits} className={PRIMARY}>
            {e.label}
          </button>
        );
      case 'route':
        return (
          <Link to={e.to} onClick={close} className={PRIMARY}>
            {e.label}
          </Link>
        );
      default:
        return null;
    }
  };

  const renderSecondary = (e: NavEntry) => {
    switch (e.kind) {
      case 'tracking':
        return group(e.key, e.label, <TrackingForm item={e.item} className="space-y-2 pb-4 pt-1" />, SECONDARY);
      case 'external':
        return (
          <a
            href={e.url}
            target={e.newTab ? '_blank' : undefined}
            rel={e.newTab ? 'noopener noreferrer' : undefined}
            onClick={close}
            className={SECONDARY}
          >
            {e.label}
          </a>
        );
      case 'route':
        return (
          <Link to={e.to} onClick={close} className={SECONDARY}>
            {e.label}
          </Link>
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="Menú de navegación"
      inert={!menuOpen}
      onKeyDown={onKeyDown}
      // Cerrado: además de inert, invisible al terminar de salir, así queda fuera
      // del árbol de accesibilidad y del Tab también donde inert no se respeta.
      // Al ABRIR la visibilidad cambia al instante (sin transición): si no, el
      // primer frame lo encuentra oculto y no se le puede dar el foco.
      className={`fixed inset-x-0 top-0 z-50 flex h-dvh flex-col bg-background text-on-surface duration-300 ${
        menuOpen ? 'visible translate-x-0 transition-transform' : 'invisible translate-x-full transition-[transform,visibility]'
      }`}
    >
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-line pl-5 pr-1">
        <span className={LABEL}>Menú</span>
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Cerrar menú"
          className={`inline-flex h-11 w-11 items-center justify-center text-on-surface ${FOCUS}`}
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      <nav aria-label="Menú" className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <ul>
          {primary.map((e) => (
            <li key={e.key} className="border-b border-line-soft">
              {renderPrimary(e)}
            </li>
          ))}
        </ul>
        {secondary.length > 0 && (
          <ul className="mt-8">
            {secondary.map((e) => (
              <li key={e.key}>{renderSecondary(e)}</li>
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}
