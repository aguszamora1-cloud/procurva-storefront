/**
 * Atelier 2 · A3: catálogo (todos los productos, categoría y búsqueda).
 *
 * Datos y filtros: useCatalog, sin cambios. Los mismos parámetros de URL que
 * Atelier 1 y Classic (`?q=`, `?talle=`, `?orden=`, `/categoria/:name`), así que
 * los enlaces existentes siguen funcionando. Sólo los filtros que useCatalog
 * ofrece (talle y orden): ni precio ni color.
 *
 * «Mostrar más»: se dibujan las tarjetas de a tandas (PAGE). Las que no se
 * dibujan no existen en la página, así que tampoco se descargan sus fotos. La
 * lista, el orden y los filtros son los de useCatalog: la tanda sólo corta lo
 * que se ve. Al cambiar categoría, búsqueda, talle u orden se vuelve a la
 * primera tanda.
 *
 * Volver desde una ficha: al tocar una tarjeta se guarda en la sessionStorage
 * de la pestaña cuántas tandas había y la posición; al volver con «atrás» (POP)
 * se restauran una vez y se borran. Clave propia de Atelier 2 (`a2-catalogo:`),
 * no afecta a otras plantillas ni a Classic.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link, useLocation, useNavigationType } from 'react-router-dom';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { Seo } from '@/components/Seo';
import { SORT_LABELS, categoryHref, useCatalog, type SortKey } from '../shared/commerce';
import { useOverlay } from '../shared/ui';
import { Atelier2Card, Atelier2CardSkeleton } from './Card';

const PAGE = 24;
const RESTORE_PREFIX = 'a2-catalogo:';

interface Saved {
  shown: number;
  y: number;
}

function readSaved(key: string): Saved | null {
  try {
    const raw = sessionStorage.getItem(RESTORE_PREFIX + key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Saved>;
    return typeof v.shown === 'number' && typeof v.y === 'number' ? { shown: v.shown, y: v.y } : null;
  } catch {
    return null;
  }
}

function writeSaved(key: string, v: Saved | null) {
  try {
    if (v) sessionStorage.setItem(RESTORE_PREFIX + key, JSON.stringify(v));
    else sessionStorage.removeItem(RESTORE_PREFIX + key);
  } catch {
    /* sin sessionStorage: no se restaura, nada más */
  }
}

function SizeSheet({ open, close, sizes, size, setSize, count }: { open: boolean; close: () => void; sizes: string[]; size: string | null; setSize: (s: string | null) => void; count: number }) {
  const ref = useRef<HTMLElement>(null);
  useOverlay(open, close, ref);
  if (!open) return null;
  return (
    <>
      <div className="a2-scrim" onClick={close} aria-hidden="true" />
      <aside className="a2-sheet a2-sheet--l a2-flt" role="dialog" aria-modal="true" aria-labelledby="a2-flt-t" ref={ref}>
        <div className="a2-sheet__h">
          <h2 id="a2-flt-t">Filtrar</h2>
          <button type="button" className="a2-ib" onClick={close} aria-label="Cerrar filtros">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="a2-sheet__b">
          <fieldset className="a2-flt__g">
            <legend>Talle</legend>
            <div className="a2-opts">
              {sizes.map((s) => (
                <button key={s} type="button" className="a2-opt" aria-pressed={size === s} onClick={() => setSize(size === s ? null : s)}>
                  {s}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="a2-sheet__f">
          {size && (
            <button type="button" className="a2-btn a2-btn--line" onClick={() => setSize(null)}>
              Quitar talle
            </button>
          )}
          <button type="button" className="a2-btn" onClick={close}>
            Ver {count} {count === 1 ? 'producto' : 'productos'}
          </button>
        </div>
      </aside>
    </>
  );
}

export function Atelier2Catalog() {
  const config = useStore();
  const view = useCatalog();
  const { pathname, search } = useLocation();
  const navType = useNavigationType();
  const [filters, setFilters] = useState(false);
  const closeFilters = useCallback(() => setFilters(false), []);
  useFirstPaintGate('tpl-catalog', view.isLoading);

  // La tanda depende de la vista: otra categoría, búsqueda, talle u orden empieza de cero.
  const viewKey = `${pathname}?${search}`;
  const [paging, setPaging] = useState<{ key: string; shown: number }>(() => {
    const saved = navType === 'POP' ? readSaved(viewKey) : null;
    return { key: viewKey, shown: saved ? Math.max(PAGE, saved.shown) : PAGE };
  });
  const shown = paging.key === viewKey ? paging.shown : PAGE;
  const total = view.products.length;
  const visible = useMemo(() => view.products.slice(0, shown), [view.products, shown]);

  // Volver con «atrás»: una sola vez, cuando ya están los productos.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || view.isLoading) return;
    restored.current = true;
    const saved = navType === 'POP' ? readSaved(viewKey) : null;
    writeSaved(viewKey, null);
    if (saved) requestAnimationFrame(() => window.scrollTo({ top: saved.y, left: 0, behavior: 'auto' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.isLoading]);

  // Al abrir una ficha desde la grilla, se recuerda dónde estaba.
  const remember = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a')) writeSaved(viewKey, { shown, y: window.scrollY });
  };

  const more = () => setPaging({ key: viewKey, shown: shown + PAGE });

  const title = view.query ? `Resultados para «${view.query}»` : view.category ?? 'Todos los productos';
  const filtersOn = view.sizes.length > 1;

  return (
    <div className="a2-cat">
      <Seo
        title={`${view.category ?? 'Productos'} · ${config.name}`}
        description={config.metaDescription || config.name}
        slug={config.slug}
        siteName={config.name}
        path={view.category ? categoryHref(view.category) : '/productos'}
      />
      <section className="a2-wrap a2-cat__h">
        <nav className="a2-crumbs" aria-label="Ruta">
          <Link to="/">Inicio</Link>
          <span aria-hidden="true">/</span>
          {view.category ? (
            <>
              <Link to="/productos">Productos</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{view.category}</span>
            </>
          ) : (
            <span aria-current="page">Productos</span>
          )}
        </nav>
        <h1>{title}</h1>
        <p className="a2-muted" aria-live="polite">
          {view.isLoading ? ' ' : `${view.count} ${view.count === 1 ? 'producto' : 'productos'}`}
        </p>
      </section>

      {!view.query && view.categories.length > 1 && (
        <nav className="a2-wrap a2-catchips" aria-label="Categorías">
          <Link to="/productos" className="a2-chip" aria-current={!view.category ? 'page' : undefined}>
            Todo
          </Link>
          {view.categories.map((c) => (
            <Link key={c.name} to={categoryHref(c.name)} className="a2-chip" aria-current={view.category === c.name ? 'page' : undefined}>
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      {(view.isLoading || total > 0 || view.size) && (
      <div className="a2-tools">
        <div className="a2-wrap a2-tools__in">
          {filtersOn && (
            <button type="button" className="a2-tools__f" onClick={() => setFilters(true)}>
              <SlidersHorizontal aria-hidden="true" />
              Filtrar
              {view.size && <b aria-label="1 filtro activo">1</b>}
            </button>
          )}
          <div className="a2-tools__a">
            {view.size && (
              <button type="button" className="a2-chip a2-chip--x" onClick={() => view.setSize(null)} aria-label={`Quitar talle ${view.size}`}>
                Talle {view.size}
                <X aria-hidden="true" />
              </button>
            )}
          </div>
          <label className="a2-tools__s">
            <span className="a2-sr">Ordenar</span>
            <select value={view.sort} onChange={(e) => view.setSort(e.target.value as SortKey)}>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" />
          </label>
        </div>
      </div>
      )}

      <section className="a2-wrap a2-cat__b" aria-label="Productos">
        {view.isLoading ? (
          <Atelier2CardSkeleton n={8} />
        ) : total === 0 ? (
          <div className="a2-empty">
            <p>{view.query ? `No encontramos productos para «${view.query}».` : view.size ? `No hay productos en talle ${view.size} en esta selección.` : 'Todavía no hay productos en esta selección.'}</p>
            {view.size ? (
              <button type="button" className="a2-btn a2-btn--line" onClick={() => view.setSize(null)}>
                Quitar el filtro de talle
              </button>
            ) : (
              <Link to="/productos" className="a2-btn a2-btn--line">
                Ver todos los productos
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="a2-grid a2-grid--cat" onClickCapture={remember}>
              {visible.map((p, i) => (
                <Atelier2Card key={p.card_key ?? p.id} product={p} priority={i < 4} />
              ))}
            </div>
            {shown < total && (
              <div className="a2-more">
                <button type="button" className="a2-btn a2-btn--line" onClick={more}>
                  Mostrar más
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {filtersOn && <SizeSheet open={filters} close={closeFilters} sizes={view.sizes} size={view.size} setSize={view.setSize} count={view.count} />}
    </div>
  );
}
