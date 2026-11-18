import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { promoPath } from '@/lib/promoPage';
import { useHeader } from './HeaderContext';
import { desktopNavEntries, isDisclosure, isPrimaryEntry, type NavEntry } from './navEntries';
import { bandGrid, fitCount } from './navOverflow';
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
 * Apariencia editorial (Stacked): la navegación en tipografía de lectura, sin
 * versalitas; lo secundario (páginas, links, seguimiento) apagado y después de
 * un respiro mayor. Las acciones del encabezado quedan en versalitas chicas:
 * dos registros distintos marcan la jerarquía.
 */
const ED_ITEM =
  'inline-flex h-full items-center gap-1.5 whitespace-nowrap text-[calc(15px_*_var(--font-scale,1))] font-medium tracking-[0.01em] decoration-1 underline-offset-[6px] transition-colors hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-current';
const ED_PRIMARY = 'text-on-surface';
const ED_SECONDARY = 'text-on-surface-muted hover:text-on-surface';
const ED_CHEVRON = 'h-2.5 w-2.5 shrink-0 opacity-60 transition-transform';
/** Respiro antes del grupo secundario (36 + 28 = 64px). */
const ED_SECONDARY_GAP = 'ml-7';

/**
 * Banda desplegable (Stacked): a todo el ancho del encabezado; el contenido
 * define su ancho y se centra, así pocas categorías no dejan un desierto. El
 * filete de arriba repite el de la fila (la banda se ubica dentro de su borde).
 */
const BAND =
  'absolute inset-x-0 top-full z-50 max-h-[70vh] overflow-y-auto border-y border-line bg-background text-on-surface';
const BAND_IN = 'mx-auto flex w-fit max-w-full justify-center gap-x-[72px] px-10 pb-[34px] pt-[30px]';
const BAND_TITLE =
  'mb-1.5 block font-heading text-[calc(24px_*_var(--font-scale,1))] font-medium leading-tight text-on-surface';
const BAND_COUNT = 'mb-[18px] block text-[calc(12.5px_*_var(--font-scale,1))] text-on-surface-muted';
const BAND_FOOT =
  'inline-flex items-center gap-1.5 text-[calc(11.5px_*_var(--font-scale,1))] font-medium uppercase tracking-[0.16em] text-on-surface decoration-1 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-current';

export type DesktopNavAppearance = 'inline' | 'editorial';
export type DesktopNavPanels = 'hang' | 'band';

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
 *
 * Por defecto, lo de Inline: versalitas y paneles colgantes. Stacked pide
 * `appearance="editorial"` (centrada, con jerarquía) y `panels="band"`
 * (categorías y promociones en una banda a todo el ancho; seguimiento y "Más"
 * siguen colgando de su entrada). Con la banda, el contenedor que la ubica es
 * el del encabezado (tiene que ser `relative`), no la navegación.
 */
export function DesktopNav({
  appearance = 'inline',
  panels = 'hang',
}: { appearance?: DesktopNavAppearance; panels?: DesktopNavPanels } = {}) {
  const { nav, goToOutfits, searchOpen } = useHeader();
  const entries = desktopNavEntries(nav, promoPath);
  const location = useLocation();
  const baseId = useId();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [visible, setVisible] = useState(entries.length);
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const editorial = appearance === 'editorial';
  const band = panels === 'band';

  const chevron = editorial ? ED_CHEVRON : CHEVRON;
  /** Clase de una entrada de la barra (y de su gemela en la fila de medición). */
  const itemClass = (e: NavEntry | null) =>
    editorial ? `${ED_ITEM} ${e && !isPrimaryEntry(e) ? ED_SECONDARY : ED_PRIMARY}` : ITEM;
  /** La primera entrada secundaria (editorial) lleva el respiro mayor. */
  const firstSecondary = editorial ? entries.find((e) => !isPrimaryEntry(e))?.key : undefined;
  const liGap = (e: NavEntry) => (e.key === firstSecondary && entries.some(isPrimaryEntry) ? ED_SECONDARY_GAP : '');

  // Cuántas entradas entran. Se mide la fila invisible (todas las entradas + "Más")
  // contra el ancho útil de la barra (sin su padding), antes del paint y en cada
  // cambio de tamaño de la barra o de una entrada: cuando llega la fuente web, las
  // entradas cambian de ancho sin que la barra cambie, y hay que volver a medir.
  // Se observa cada entrada y no la fila: la fila está recortada al ancho de la
  // barra y con muchas entradas no cambia de tamaño aunque ellas sí.
  // El margen propio de una entrada cuenta como parte de ella.
  const signature = entries.map((e) => `${e.key}:${e.label}`).join('|');
  useLayoutEffect(() => {
    const navEl = navRef.current;
    const row = measureRef.current;
    if (!navEl || !row) return;
    const measure = () => {
      const items = Array.from(row.children) as HTMLElement[];
      const more = items.pop();
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const cs = getComputedStyle(navEl);
      const available = navEl.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      const widths = items.map((el) => el.offsetWidth + (parseFloat(getComputedStyle(el).marginLeft) || 0));
      setVisible(fitCount(widths, available, more?.offsetWidth ?? 0, gap));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(navEl);
    for (const item of Array.from(row.children)) ro.observe(item);
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

  /**
   * Disclosure: botón + panel. Cerrar al salir con Tab (el foco deja el <li>).
   * `asBand`: el panel es la banda (el <li> no lo ubica: lo ubica el encabezado).
   */
  const disclosure = (entry: NavEntry | null, key: string, label: string, panel: ReactNode, panelClass = '', asBand = false) => {
    const open = openKey === key;
    const panelId = `${baseId}-${key}`;
    return (
      <li
        key={key}
        className={`${asBand ? '' : 'relative '}flex h-full ${entry ? liGap(entry) : ''}`.trim()}
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
          className={`${itemClass(entry)} ${open ? ITEM_ON : ''}`}
        >
          {label}
          <ChevronDown aria-hidden="true" className={`${chevron} ${open ? 'rotate-180' : ''}`} strokeWidth={1.75} />
        </button>
        {open &&
          (asBand ? (
            <div id={panelId} className={BAND}>
              {panel}
            </div>
          ) : (
            <div id={panelId} className={`${PANEL} ${panelClass}`}>
              {panel}
            </div>
          ))}
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

  /** Lista en columnas de a 6 (bandGrid), de arriba hacia abajo. */
  const bandList = (links: { key: string; to: string; label: string }[]) => {
    const { rows } = bandGrid(links.length);
    return (
      <ul className="grid grid-flow-col gap-x-12" style={{ gridTemplateRows: `repeat(${rows}, auto)` }}>
        {links.map((l) => (
          <li key={l.key}>
            <Link to={l.to} className={`${PANEL_LINK} min-w-[150px]`}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    );
  };

  const promosEntry = entries.find((e): e is Extract<NavEntry, { kind: 'promos' }> => e.kind === 'promos');
  const categoriesBand = (categories: string[]) => (
    <div className={BAND_IN}>
      <div>
        <span className={BAND_TITLE}>Categorías</span>
        <span className={BAND_COUNT}>
          {categories.length} {categories.length === 1 ? 'categoría' : 'categorías'}
        </span>
        <Link to="/categorias" className={BAND_FOOT}>
          Ver todas
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Link>
      </div>
      {bandList(categories.map((c) => ({ key: c, to: `/categoria/${encodeURIComponent(c)}`, label: c })))}
      {promosEntry && (
        <div>
          <span className={PANEL_HEAD}>{promosEntry.label}</span>
          {promosPanel(promosEntry.promos)}
        </div>
      )}
    </div>
  );
  const promosBand = (label: string, promos: { id: string; name: string; to: string }[]) => (
    <div className={BAND_IN}>
      <span className={BAND_TITLE}>{label}</span>
      {bandList(promos.map((p) => ({ key: p.id, to: p.to, label: p.name })))}
    </div>
  );

  const renderEntry = (e: NavEntry) => {
    switch (e.kind) {
      case 'categories':
        return band
          ? disclosure(e, e.key, e.label, categoriesBand(e.categories), '', true)
          : disclosure(
              e,
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
        return band
          ? disclosure(e, e.key, e.label, promosBand(e.label, e.promos), '', true)
          : disclosure(
              e,
              e.key,
              e.label,
              <>
                <span className={PANEL_HEAD}>{e.label}</span>
                {promosPanel(e.promos)}
              </>,
            );
      case 'tracking':
        return disclosure(
          e,
          e.key,
          e.label,
          <>
            <span className={PANEL_HEAD}>{e.label}</span>
            <TrackingForm item={e.item} className="space-y-2" />
          </>,
          // Centrada, el seguimiento puede quedar cerca del borde derecho: cuelga hacia la izquierda.
          editorial ? 'left-auto right-0 w-[320px]' : 'w-[320px]',
        );
      case 'outfits':
        return (
          <li key={e.key} className={`flex h-full ${liGap(e)}`.trim()}>
            <button type="button" onClick={goToOutfits} className={itemClass(e)}>
              {e.label}
            </button>
          </li>
        );
      case 'external':
        return (
          <li key={e.key} className={`flex h-full ${liGap(e)}`.trim()}>
            <a
              href={e.url}
              target={e.newTab ? '_blank' : undefined}
              rel={e.newTab ? 'noopener noreferrer' : undefined}
              className={itemClass(e)}
            >
              {e.label}
            </a>
          </li>
        );
      case 'route':
        return (
          <li key={e.key} className={`flex h-full ${liGap(e)}`.trim()}>
            <NavLink to={e.to} end={e.end} className={({ isActive }) => `${itemClass(e)} ${isActive ? ITEM_ON : ''}`}>
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

  // Inline: la navegación ubica sus paneles. Editorial: centrada, con 24px de
  // aire contra el logo y las acciones; con banda, la ubica el encabezado.
  const navClass = editorial
    ? `${band ? '' : 'relative '}flex h-full min-w-0 items-stretch justify-center px-6`
    : 'relative flex h-full min-w-0 items-stretch';
  // "Más": en la barra centrada cuelga hacia la izquierda (no se sale por la derecha).
  const moreClass = editorial
    ? 'left-auto right-0 max-h-[70vh] w-[300px] overflow-y-auto'
    : 'max-h-[70vh] w-[300px] overflow-y-auto';

  return (
    <nav ref={navRef} aria-label="Principal" className={navClass}>
      <ul className={`flex h-full items-stretch ${GAP_CLASS}`}>
        {shown.map(renderEntry)}
        {rest.length > 0 && disclosure(null, 'mas', 'Más', morePanel, moreClass)}
      </ul>

      {/* Fila de medición: invisible, fuera del flujo y del árbol de accesibilidad.
          Recortada (overflow-hidden): con muchas entradas no agranda la página a lo
          ancho; las entradas no se achican (nowrap), así que se miden enteras. */}
      <ul
        ref={measureRef}
        aria-hidden="true"
        className={`pointer-events-none invisible absolute left-0 top-0 flex max-w-full overflow-hidden whitespace-nowrap ${GAP_CLASS}`}
      >
        {entries.map((e) => (
          <li key={e.key} className={`${itemClass(e)} ${editorial ? liGap(e) : ''}`.trim()}>
            {e.label}
            {isDisclosure(e) && <span className={chevron} />}
          </li>
        ))}
        <li className={itemClass(null)}>
          Más
          <span className={chevron} />
        </li>
      </ul>
    </nav>
  );
}
