/**
 * Atelier 2 · A1: base visual alrededor de cada página. Encabezado, menú de
 * celular, buscador y pie, con la paleta del comercio (palette.ts) e Inter.
 *
 * Sólo presentación. Los datos salen de los mismos hooks que usa Atelier 1
 * (productos, categorías, menú, contacto, políticas, carrito) y las piezas
 * compartidas son las mismas: barras superiores, popup del newsletter y botón de
 * WhatsApp. «Bolsa» abre la bolsa lateral (A6, Cart.tsx), como Atelier 1.
 */

import { useCallback, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronDown, Menu, Search, ShoppingBag, X } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { StoreImage } from '@/components/StoreImage';
import { categoryHref, categoryImage, sameText, useContact, useMenuLinks, usePolicies } from '../shared/commerce';
import { TemplateNewsletterPopup, TemplateTopBars } from '../shared/StoreContent';
import { TemplateWhatsApp } from '../shared/ClassicExtras';
import { StoreMark, useCartView, useCloseOnRoute, useOverlay, useScrolled, useSearchSubmit } from '../shared/ui';
import { useAtelier2Palette } from './palette';
import { Atelier2Bag } from './Cart';

/** Categorías que entran en la fila del encabezado de escritorio; el resto, en «Más» (menú). */
const NAV_CATEGORIES = 5;

function useStoreCategories() {
  const { products } = useProducts();
  const { categories } = useCategories(products);
  return { products, categories };
}

function Logo({ className = '' }: { className?: string }) {
  const { name } = useStore();
  return (
    <Link to="/" className={`a2-logo ${className}`} aria-label={`${name}, inicio`}>
      <StoreMark className="a2-logo__mark" />
    </Link>
  );
}

function Header({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { itemCount, open: openBag } = useCartView();
  const { categories } = useStoreCategories();
  const compact = useScrolled(24);
  const bagLabel = `Bolsa, ${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}`;
  return (
    <header className="a2-hd" data-compact={compact || undefined}>
      <div className="a2-wrap a2-hd__row">
        <div className="a2-hd__l">
          <button type="button" className="a2-ib a2-only-m" onClick={onMenu} aria-label="Abrir menú">
            <Menu aria-hidden="true" />
          </button>
          <button type="button" className="a2-hd__tool a2-only-d" onClick={onSearch}>
            <Search aria-hidden="true" />
            <span>Buscar</span>
          </button>
        </div>
        <Logo />
        <div className="a2-hd__r">
          <button type="button" className="a2-ib a2-only-m" onClick={onSearch} aria-label="Buscar">
            <Search aria-hidden="true" />
          </button>
          <button type="button" className="a2-hd__tool a2-hd__bag" aria-label={bagLabel} aria-haspopup="dialog" onClick={openBag}>
            <ShoppingBag aria-hidden="true" />
            <span className="a2-only-d">Bolsa</span>
            {itemCount > 0 && (
              <b className="a2-hd__n" aria-hidden="true">
                {itemCount}
              </b>
            )}
          </button>
        </div>
      </div>
      {categories.length > 0 && (
        <nav className="a2-wrap a2-hd__nav a2-only-d" aria-label="Categorías">
          <NavLink to="/productos" end>
            Todo
          </NavLink>
          {categories.slice(0, NAV_CATEGORIES).map((c) => (
            <NavLink key={c.name} to={categoryHref(c.name)}>
              {c.name}
            </NavLink>
          ))}
          {categories.length > NAV_CATEGORIES && (
            <button type="button" onClick={onMenu}>
              Más
            </button>
          )}
        </nav>
      )}
    </header>
  );
}

function Policies({ className }: { className: string }) {
  const policies = usePolicies();
  if (policies.length === 0) return null;
  return (
    <div className={className}>
      {policies.map((p) => (
        <details key={p.key} className="a2-acc">
          <summary>
            {p.title}
            <ChevronDown aria-hidden="true" />
          </summary>
          <p>{p.body}</p>
        </details>
      ))}
    </div>
  );
}

function MenuSheet({ open, close }: { open: boolean; close: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useOverlay(open, close, ref);
  const { products, categories } = useStoreCategories();
  const links = useMenuLinks();
  const contact = useContact();
  const submit = useSearchSubmit();
  const [q, setQ] = useState('');
  if (!open) return null;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(q);
    close();
  };
  return (
    <>
      <div className="a2-scrim" onClick={close} aria-hidden="true" />
      <aside className="a2-sheet a2-sheet--l a2-mnu" role="dialog" aria-modal="true" aria-label="Menú" ref={ref}>
        <div className="a2-sheet__h">
          <Logo />
          <button type="button" className="a2-ib" onClick={close} aria-label="Cerrar menú">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="a2-sheet__b">
          <form className="a2-mnu__s" role="search" onSubmit={onSubmit}>
            <Search aria-hidden="true" />
            <label htmlFor="a2-mnu-q" className="a2-sr">
              Buscar productos
            </label>
            <input id="a2-mnu-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar productos" autoComplete="off" />
          </form>
          <ul className="a2-mnu__l">
            <li>
              <Link to="/productos" onClick={close} className="a2-mnu__all">
                <span className="a2-mnu__t">Todos los productos</span>
                <span className="a2-muted">{products.length}</span>
              </Link>
            </li>
            {categories.map((c) => {
              const img = categoryImage(c, products);
              return (
                <li key={c.name}>
                  <Link to={categoryHref(c.name)} onClick={close}>
                    <span className="a2-mnu__img">{img && <StoreImage src={img} alt="" transformWidth={120} width={48} height={60} />}</span>
                    <span className="a2-mnu__t">{c.name}</span>
                    <span className="a2-muted">{c.count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {links.length > 0 && (
            <ul className="a2-mnu__x">
              {links.map((l) => (
                <li key={l.label}>
                  {l.external ? (
                    <a href={l.to} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  ) : (
                    <Link to={l.to} onClick={close}>
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Policies className="a2-mnu__h" />
          {contact.length > 0 && (
            <ul className="a2-mnu__x">
              {contact.map((c) => (
                <li key={c.href}>
                  <a href={c.href} target="_blank" rel="noreferrer">
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

function SearchPanel({ open, close }: { open: boolean; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(open, close, ref);
  const { categories } = useStoreCategories();
  const submit = useSearchSubmit();
  const [q, setQ] = useState('');
  if (!open) return null;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(q);
    close();
  };
  return (
    <>
      <div className="a2-scrim" onClick={close} aria-hidden="true" />
      <div className="a2-srch" role="dialog" aria-modal="true" aria-label="Buscar" ref={ref}>
        <form className="a2-wrap a2-srch__f" role="search" onSubmit={onSubmit}>
          <Search aria-hidden="true" />
          <label htmlFor="a2-srch-q" className="a2-sr">
            Buscar en la tienda
          </label>
          <input id="a2-srch-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="¿Qué estás buscando?" autoComplete="off" />
          <button type="button" className="a2-ib" onClick={close} aria-label="Cerrar búsqueda">
            <X aria-hidden="true" />
          </button>
        </form>
        {categories.length > 0 && (
          <div className="a2-wrap a2-srch__r">
            <p className="a2-muted">Categorías</p>
            <div className="a2-chips">
              {categories.map((c) => (
                <Link key={c.name} to={categoryHref(c.name)} className="a2-chip" onClick={close}>
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Footer() {
  const config = useStore();
  const { categories } = useStoreCategories();
  const links = useMenuLinks();
  const contact = useContact();
  const line = config.tagline && !sameText(config.tagline, config.name) ? config.tagline : config.shippingMessage;
  const year = new Date().getFullYear();
  return (
    <footer className="a2-ft">
      <div className="a2-wrap a2-ft__in">
        <div className="a2-ft__b">
          <Logo className="a2-logo--ft" />
          {line && <p>{line}</p>}
        </div>
        <nav aria-label="Tienda">
          <h2 className="a2-ft__t">Tienda</h2>
          <ul>
            <li>
              <Link to="/productos">Todos los productos</Link>
            </li>
            {categories.map((c) => (
              <li key={c.name}>
                <Link to={categoryHref(c.name)}>{c.name}</Link>
              </li>
            ))}
            {links.map((l) => (
              <li key={l.label}>
                {l.external ? (
                  <a href={l.to} target="_blank" rel="noreferrer">
                    {l.label}
                  </a>
                ) : (
                  <Link to={l.to}>{l.label}</Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <FooterHelp />
        {contact.length > 0 && (
          <div>
            <h2 className="a2-ft__t">Seguinos</h2>
            <ul>
              {contact.map((c) => (
                <li key={c.href}>
                  <a href={c.href} target="_blank" rel="noreferrer">
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="a2-wrap a2-ft__legal">
        © {year} {config.name}
      </div>
    </footer>
  );
}

function FooterHelp() {
  const policies = usePolicies();
  if (policies.length === 0) return null;
  return (
    <div>
      <h2 className="a2-ft__t">Ayuda</h2>
      <Policies className="a2-ft__h" />
    </div>
  );
}

export function Atelier2Shell({ children }: { children: ReactNode }) {
  const { vars, ink } = useAtelier2Palette();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const closeSearch = useCallback(() => setSearch(false), []);
  useCloseOnRoute(closeMenu);
  useCloseOnRoute(closeSearch);
  return (
    <div className="tpl-atelier2 a2" data-atelier2="a1" style={vars}>
      <a href="#a2-main" className="a2-skip">
        Ir al contenido
      </a>
      <TemplateTopBars ink={ink} />
      <Header onMenu={() => setMenu(true)} onSearch={() => setSearch(true)} />
      <MenuSheet open={menu} close={closeMenu} />
      <SearchPanel open={search} close={closeSearch} />
      <main id="a2-main" className="a2-main">
        {children}
      </main>
      <Footer />
      <Atelier2Bag />
      <TemplateNewsletterPopup ink={ink} />
      <TemplateWhatsApp />
    </div>
  );
}
