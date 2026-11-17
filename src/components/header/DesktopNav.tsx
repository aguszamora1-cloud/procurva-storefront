import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { promoPath } from '@/lib/promoPage';
import { useHeader } from './HeaderContext';
import { desktopNavEntries, isDisclosure, type NavEntry } from './navEntries';
import { fitCount } from './navOverflow';
import { TrackingForm } from './TrackingForm';

/** Entrada de la barra: versalitas chicas con aire, subrayado fino para hover, activa y abierta. */
const ITEM =
  'inline-flex h-full items-center gap-1.5 whitespace-nowrap text-[calc(12.5px_*_var(--font-scale,1))] font-medium uppercase tracking-[0.14em] text-on-surface decoration-1 underline-offset-[7px] transition-colors hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-current';
const ITEM_ON = 'underline';
const CHEVRON = 'h-3 w-3 shrink-0 transition-transform';
/**
 * Panel desplegable: continúa la barra (sin borde arriba, esquinas sólo abajo),
 * cuelga de su borde inferior alineado con su entrada.
 */
const PANEL =
  'absolute left-0 top-full z-50 min-w-[260px] rounded-b-md border-x border-b border-line bg-background px-7 pb-7 pt-6 text-on-surface shadow-sm';
/** Título de la sección del panel: versalitas chicas, apagado. */
const PANEL_HEAD =
  'mb-4 block text-[calc(11px_*_var(--font-scale,1))] font-semibold uppercase tracking-[0.16em] text-on-surface-muted';
/** Links del panel: tipografía de lectura, color pleno, subrayado fino al pasar. */
const PANEL_LINK =
  'block py-[7px] text-[calc(15px_*_var(--font-scale,1))] leading-snug text-on-surface decoration-1 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-current';
/** Pie del panel ("Ver todas"), separado por un filete. */
const PANEL_FOOT =
  'mt-5 flex items-center gap-1.5 border-t border-line-soft pt-4 text-[calc(12px_*_var(--font-scale,1))] font-medium uppercase tracking-[0.14em] text-on-surface decoration-1 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-current';
/** Grupo dentro de "Más": separado del anterior por un filete. */
const MORE_GROUP = 'mt-5 border-t border-line-soft pt-5';
/** Separación entre entradas (gap-9 = 36px). Se mide del DOM; esto es sólo el default. */
const GAP_CLASS = 'gap-9';

/**
 * Navegación horizontal de escritorio (armados Inline y siguientes).
 *
 * - Mismos datos que el menú lateral (useHeaderNav): productos, categorías,
 *   promociones, outfits, páginas, links y seguimiento. Sin consultas nuevas.
 * - Desplegables con patrón "disclosure": botón con aria-expanded/aria-controls,
 *   panel inmediatamente después en el DOM (Tab entra solo), Escape cierra y
 *   devuelve el foco, clic afuera o salir con Tab cierra, y un cambio de ruta
 *   también. Se abren con clic, no al pasar el mouse: igual en pantallas táctiles.
 * - Lo que no entra en el ancho va a "Más" (medido con una fila invisible).
 */
export function DesktopNav() {
  const { nav, goToOutfits, searchOpen } = useHeader();
  const entries = desktopNavEntries(nav, promoPath);
  const location = useLocation();
  const baseId = useId();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [visible, setVisible] = useState(entries.length);
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());

  // Cuántas entradas entran. Se mide la fila invisible (todas las entradas + "Más")
  // contra el ancho real de la barra, antes del paint y en cada cambio de tamaño.
  const signature = entries.map((e) => `${e.key}:${e.label}`).join('|');
  useLayoutEffect(() => {
    const navEl = navRef.current;
    const row = measureRef.current;
    if (!navEl || !row) return;
    const measure = () => {
      const items = Array.from(row.children) as HTMLElement[];
      const more = items.pop();
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      setVisible(fitCount(items.map((el) => el.offsetWidth), navEl.clientWidth, more?.offsetWidth ?? 0, gap));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(navEl);
    return () => ro.disconnect();
  }, [signature]);

  // Un panel abierto se cierra al navegar, al abrir la búsqueda y al tocar afuera.
  useEffect(() => setOpenKey(null), [location.pathname, searchOpen]);
  useEffect(() => {
    if (!openKey) return;
    const onPointer = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenKey(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      triggers.current.get(openKey)?.focus();
      setOpenKey(null);
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [openKey]);

  const shown = entries.slice(0, visible);
  const rest = entries.slice(visible);
  const toggle = (key: string) => setOpenKey((k) => (k === key ? null : key));

  /** Disclosure: botón + panel. Cerrar al salir con Tab (el foco deja el <li>). */
  const disclosure = (key: string, label: string, panel: ReactNode, panelClass = '') => {
    const open = openKey === key;
    const panelId = `${baseId}-${key}`;
    return (
      <li
        key={key}
        className="relative flex h-full"
        onBlur={(e) => {
          if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpenKey(null);
        }}
      >
        <button
          ref={(el) => {
            if (el) triggers.current.set(key, el);
            else triggers.current.delete(key);
          }}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => toggle(key)}
          className={`${ITEM} ${open ? ITEM_ON : ''}`}
        >
          {label}
          <ChevronDown aria-hidden="true" className={`${CHEVRON} ${open ? 'rotate-180' : ''}`} strokeWidth={1.75} />
        </button>
        {open && (
          <div id={panelId} className={`${PANEL} ${panelClass}`}>
            {panel}
          </div>
        )}
      </li>
    );
  };

  const categoryList = (categories: string[]) => (
    <ul className={categories.length > 16 ? 'columns-3 gap-12' : categories.length > 8 ? 'columns-2 gap-12' : ''}>
      {categories.map((c) => (
        <li key={c} className="break-inside-avoid">
          <Link to={`/categoria/${encodeURIComponent(c)}`} className={PANEL_LINK}>
            {c}
          </Link>
        </li>
      ))}
    </ul>
  );

  const seeAll = (
    <Link to="/categorias" className={PANEL_FOOT}>
      Ver todas
      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
    </Link>
  );

  const promosPanel = (promos: { id: string; name: string; to: string }[]) => (
    <ul>
      {promos.map((p) => (
        <li key={p.id}>
          <Link to={p.to} className={PANEL_LINK}>
            {p.name}
          </Link>
        </li>
      ))}
    </ul>
  );

  const renderEntry = (e: NavEntry) => {
    switch (e.kind) {
      case 'categories':
        return disclosure(
          e.key,
          e.label,
          <>
            <span className={PANEL_HEAD}>{e.label}</span>
            {categoryList(e.categories)}
            {seeAll}
          </>,
          e.categories.length > 16 ? 'min-w-[620px]' : e.categories.length > 8 ? 'min-w-[440px]' : '',
        );
      case 'promos':
        return disclosure(
          e.key,
          e.label,
          <>
            <span className={PANEL_HEAD}>{e.label}</span>
            {promosPanel(e.promos)}
          </>,
        );
      case 'tracking':
        return disclosure(
          e.key,
          e.label,
          <>
            <span className={PANEL_HEAD}>{e.label}</span>
            <TrackingForm item={e.item} className="space-y-2" />
          </>,
          'w-[320px]',
        );
      case 'outfits':
        return (
          <li key={e.key} className="flex h-full">
            <button type="button" onClick={goToOutfits} className={ITEM}>
              {e.label}
            </button>
          </li>
        );
      case 'external':
        return (
          <li key={e.key} className="flex h-full">
            <a
              href={e.url}
              target={e.newTab ? '_blank' : undefined}
              rel={e.newTab ? 'noopener noreferrer' : undefined}
              className={ITEM}
            >
              {e.label}
            </a>
          </li>
        );
      case 'route':
        return (
          <li key={e.key} className="flex h-full">
            <NavLink to={e.to} end={e.end} className={({ isActive }) => `${ITEM} ${isActive ? ITEM_ON : ''}`}>
              {e.label}
            </NavLink>
          </li>
        );
    }
  };

  /**
   * Lo que no entró, dentro de "Más": primero los links sueltos, después los
   * grupos (categorías, promociones, seguimiento), cada uno con su título y
   * separado por un filete.
   */
  const restSorted = [...rest.filter((e) => !isDisclosure(e)), ...rest.filter(isDisclosure)];
  const morePanel = (
    <ul>
      {restSorted.map((e, i) => (
        <li key={e.key}>
          {e.kind === 'route' && (
            <Link to={e.to} className={PANEL_LINK}>
              {e.label}
            </Link>
          )}
          {e.kind === 'external' && (
            <a
              href={e.url}
              target={e.newTab ? '_blank' : undefined}
              rel={e.newTab ? 'noopener noreferrer' : undefined}
              className={PANEL_LINK}
            >
              {e.label}
            </a>
          )}
          {e.kind === 'outfits' && (
            <button type="button" onClick={goToOutfits} className={`${PANEL_LINK} w-full text-left`}>
              {e.label}
            </button>
          )}
          {e.kind === 'categories' && (
            <div className={i === 0 ? '' : MORE_GROUP}>
              <span className={PANEL_HEAD}>{e.label}</span>
              {categoryList(e.categories)}
              {seeAll}
            </div>
          )}
          {e.kind === 'promos' && (
            <div className={i === 0 ? '' : MORE_GROUP}>
              <span className={PANEL_HEAD}>{e.label}</span>
              {promosPanel(e.promos)}
            </div>
          )}
          {e.kind === 'tracking' && (
            <div className={i === 0 ? '' : MORE_GROUP}>
              <span className={PANEL_HEAD}>{e.label}</span>
              <TrackingForm item={e.item} className="space-y-2" />
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <nav ref={navRef} aria-label="Principal" className="relative flex h-full min-w-0 items-stretch">
      <ul className={`flex h-full items-stretch ${GAP_CLASS}`}>
        {shown.map(renderEntry)}
        {rest.length > 0 && disclosure('mas', 'Más', morePanel, 'max-h-[70vh] w-[300px] overflow-y-auto')}
      </ul>

      {/* Fila de medición: invisible, fuera del flujo y del árbol de accesibilidad. */}
      <ul
        ref={measureRef}
        aria-hidden="true"
        className={`pointer-events-none invisible absolute left-0 top-0 flex whitespace-nowrap ${GAP_CLASS}`}
      >
        {entries.map((e) => (
          <li key={e.key} className={ITEM}>
            {e.label}
            {isDisclosure(e) && <span className={CHEVRON} />}
          </li>
        ))}
        <li className={ITEM}>
          Más
          <span className={CHEVRON} />
        </li>
      </ul>
    </nav>
  );
}
