/**
 * DISTRITO · streetwear y moda urbana.
 *
 * Dirección de arte: fondo negro, texto hueso, una sola familia (Archivo) usada
 * en tres anchos — comprimida y pesada para titulares enormes, normal para leer,
 * expandida para datos chicos. Un color de señal (la marca del comercio si se
 * lee sobre negro) para comprar y para ofertas. Grillas apretadas, numeración de
 * ingreso, ranking de lo más vendido. En celular: tira de categorías fija bajo el
 * encabezado, galería con barra de progreso y barra de compra con precio.
 */
import { useCallback, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { useProducts } from '@/hooks/useProducts';
import { useProduct } from '@/hooks/useProduct';
import { useHomeSections } from '@/hooks/useHomeSections';
import { useCategories } from '@/hooks/useCategories';
import { StoreImage } from '@/components/StoreImage';
import { Seo } from '@/components/Seo';
import { formatPrice, mainImage, productCategories } from '@/lib/utils';
import type { Product } from '@/lib/types';
import type { TemplateKit } from '../TemplateApp';
import {
  SORT_LABELS,
  brandOr,
  buyAction,
  cardHref,
  categoryHref,
  categoryImage,
  isSoldOut,
  secondImage,
  sizesInStock,
  useCatalog,
  useContact,
  useHeading,
  useHero,
  useMenuLinks,
  usePdp,
  usePolicies,
  useTplPrice,
  type SortKey,
} from '../shared/commerce';
import { PriceView } from '../shared/Price';
import { StoreMark, useCartView, useCloseOnRoute, useOverlay, useSearchSubmit } from '../shared/ui';
import './distrito.css';

const num = (i: number) => String(i + 1).padStart(3, '0');

// ── Encabezado ────────────────────────────────────────────────────────────────
function DistritoHeader({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { itemCount, open } = useCartView();
  const { products } = useProducts();
  const { categories } = useCategories(products);
  return (
    <header className="di-header">
      <div className="di-header__bar">
        <Link to="/" className="di-header__brand" aria-label="Inicio">
          <StoreMark className="di-header__logo" />
        </Link>
        <nav className="di-header__nav" aria-label="Principal">
          <NavLink to="/productos" end>
            Todo
          </NavLink>
          {categories.slice(0, 5).map((c) => (
            <NavLink key={c.name} to={categoryHref(c.name)}>
              {c.name}
            </NavLink>
          ))}
        </nav>
        <div className="di-header__tools">
          <button type="button" onClick={onSearch}>
            Buscar
          </button>
          <button type="button" onClick={open} aria-label={`Carrito, ${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}`}>
            <span className="di-only-desktop">Carrito </span>[{itemCount}]
          </button>
          <button type="button" className="di-only-mobile" onClick={onMenu}>
            Menú
          </button>
        </div>
      </div>
      {/* Celular: categorías siempre a mano, deslizando. */}
      {categories.length > 0 && (
        <nav className="di-strip di-only-mobile" aria-label="Categorías">
          <NavLink to="/productos" end>
            Todo
          </NavLink>
          {categories.map((c) => (
            <NavLink key={c.name} to={categoryHref(c.name)}>
              {c.name}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}

function DistritoMenu({ open, close }: { open: boolean; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(open, close, ref);
  const { products } = useProducts();
  const { categories } = useCategories(products);
  const links = useMenuLinks();
  const contact = useContact();
  if (!open) return null;
  return (
    <div className="di-menu" role="dialog" aria-modal="true" aria-label="Menú" ref={ref}>
      <div className="di-menu__bar">
        <span>Menú</span>
        <button type="button" onClick={close}>
          Cerrar
        </button>
      </div>
      <nav aria-label="Categorías">
        <ol className="di-menu__list">
          <li>
            <Link to="/productos" onClick={close}>
              <small>000</small>Todo
            </Link>
          </li>
          {categories.map((c, i) => (
            <li key={c.name}>
              <Link to={categoryHref(c.name)} onClick={close}>
                <small>{num(i)}</small>
                {c.name}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      <div className="di-menu__foot">
        {links.map((l) =>
          l.external ? (
            <a key={l.label} href={l.to} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          ) : (
            <Link key={l.label} to={l.to} onClick={close}>
              {l.label}
            </Link>
          ),
        )}
        {contact.map((c) => (
          <a key={c.href} href={c.href} target="_blank" rel="noreferrer">
            {c.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function DistritoSearch({ open, close }: { open: boolean; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(open, close, ref);
  const submit = useSearchSubmit();
  const [q, setQ] = useState('');
  if (!open) return null;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(q);
    close();
  };
  return (
    <div className="di-search" role="dialog" aria-modal="true" aria-label="Buscar" ref={ref}>
      <form onSubmit={onSubmit} role="search">
        <label htmlFor="di-q" className="tpl-sr">
          Buscar productos
        </label>
        <input id="di-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" autoComplete="off" />
        <button type="submit" className="di-search__go">
          Ir
        </button>
        <button type="button" className="di-search__close" onClick={close}>
          Cerrar
        </button>
      </form>
    </div>
  );
}

function DistritoFooter() {
  const config = useStore();
  const links = useMenuLinks();
  const contact = useContact();
  const policies = usePolicies();
  return (
    <footer className="di-footer">
      <p className="di-footer__name" aria-hidden="true">
        {config.name}
      </p>
      <div className="di-footer__cols">
        <nav aria-label="Tienda">
          <p className="di-meta">Tienda</p>
          <Link to="/productos">Todo</Link>
          <Link to="/carrito">Carrito</Link>
          {links.map((l) =>
            l.external ? (
              <a key={l.label} href={l.to} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            ) : (
              <Link key={l.label} to={l.to}>
                {l.label}
              </Link>
            ),
          )}
        </nav>
        {policies.length > 0 && (
          <div>
            <p className="di-meta">Info</p>
            {policies.map((p) => (
              <details key={p.key} className="di-acc">
                <summary>{p.title}</summary>
                <p>{p.body}</p>
              </details>
            ))}
          </div>
        )}
        {contact.length > 0 && (
          <div>
            <p className="di-meta">Seguinos</p>
            {contact.map((c) => (
              <a key={c.href} href={c.href} target="_blank" rel="noreferrer">
                {c.label}
              </a>
            ))}
          </div>
        )}
      </div>
      <p className="di-meta di-footer__legal">
        © {new Date().getFullYear()} {config.name}
      </p>
    </footer>
  );
}

// ── Carrito ───────────────────────────────────────────────────────────────────
function CartLines() {
  const { lines, updateQty, removeItem } = useCartView();
  return (
    <ul className="di-lines">
      {lines.map(({ key, item, unit, total, before }) => (
        <li key={key} className="di-line">
          <Link to={`/producto/${item.product_id}`} className="di-line__img">
            {item.image_url && <StoreImage src={item.image_url} alt="" transformWidth={240} width={160} height={200} />}
          </Link>
          <div className="di-line__info">
            <Link to={`/producto/${item.product_id}`} className="di-line__name">
              {item.name}
            </Link>
            <p className="di-meta">{[item.color, item.size].filter(Boolean).join(' / ')}</p>
            <div className="di-line__row">
              <div className="di-qty">
                <button type="button" onClick={() => updateQty(key, item.qty - 1)} aria-label={`Quitar una unidad de ${item.name}`}>
                  −
                </button>
                <span aria-live="polite">{item.qty}</span>
                <button type="button" onClick={() => updateQty(key, item.qty + 1)} aria-label={`Sumar una unidad de ${item.name}`}>
                  +
                </button>
              </div>
              <p className="di-line__price">
                {before != null && <s>{formatPrice(before * item.qty)}</s>}
                {formatPrice(total)}
              </p>
            </div>
            <div className="di-line__foot">
              {item.qty > 1 ? <p className="di-meta">{formatPrice(unit)} c/u</p> : <span />}
              <button type="button" className="di-line__remove" onClick={() => removeItem(key)}>
                Quitar
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CartSummary() {
  const { subtotal, freeShippingLeft, freeShippingFrom } = useCartView();
  const pct = freeShippingFrom > 0 ? Math.min(100, Math.round((subtotal / freeShippingFrom) * 100)) : 0;
  return (
    <div className="di-summary">
      {freeShippingLeft != null && (
        <div className="di-ship">
          <p>{freeShippingLeft > 0 ? `Sumá ${formatPrice(freeShippingLeft)} y el envío es gratis` : 'Envío gratis'}</p>
          <div className="di-ship__bar" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <p className="di-summary__row">
        <span>Subtotal</span>
        <span>{formatPrice(subtotal)}</span>
      </p>
      <p className="di-meta">Envío y descuentos por medio de pago, en el checkout.</p>
      <Link to="/checkout" className="di-cta di-cta--block">
        Ir a pagar
      </Link>
    </div>
  );
}

function DistritoCart() {
  const { isOpen, close, lines, itemCount } = useCartView();
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(isOpen, close, ref);
  useCloseOnRoute(close);
  if (!isOpen) return null;
  return (
    <div className="di-drawer" role="dialog" aria-modal="true" aria-label="Carrito">
      <button type="button" className="di-drawer__scrim" aria-label="Cerrar el carrito" onClick={close} tabIndex={-1} />
      <div className="di-drawer__panel" ref={ref}>
        <div className="di-drawer__head">
          <p>Carrito [{itemCount}]</p>
          <button type="button" onClick={close}>
            Cerrar
          </button>
        </div>
        {lines.length === 0 ? (
          <div className="di-empty">
            <p className="di-empty__big">Vacío</p>
            <Link to="/productos" className="di-cta di-cta--ghost" onClick={close}>
              Ver productos
            </Link>
          </div>
        ) : (
          <>
            <CartLines />
            <CartSummary />
          </>
        )}
      </div>
    </div>
  );
}

function DistritoShell({ children }: { children: ReactNode }) {
  const config = useStore();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const closeSearch = useCallback(() => setSearch(false), []);
  useCloseOnRoute(closeMenu);
  const signal = brandOr(config.colorAccent, '#0e0e0e', '#ff5b1f');
  return (
    <div className="tpl-distrito" style={{ '--di-signal': signal } as CSSProperties}>
      <a href="#di-main" className="di-skip">
        Ir al contenido
      </a>
      <DistritoHeader onMenu={() => setMenu(true)} onSearch={() => setSearch(true)} />
      <DistritoMenu open={menu} close={closeMenu} />
      <DistritoSearch open={search} close={closeSearch} />
      <main id="di-main" className="di-main">
        {children}
      </main>
      <DistritoFooter />
      <DistritoCart />
    </div>
  );
}

// ── Tarjeta ───────────────────────────────────────────────────────────────────
function DistritoCard({ product, index, priority }: { product: Product; index?: number; priority?: boolean }) {
  const img = mainImage(product);
  const alt = secondImage(product);
  const soldOut = isSoldOut(product);
  const sizes = soldOut ? [] : sizesInStock(product);
  const price = useTplPrice(product, { color: product.variant_color });
  return (
    <article className="di-card" data-soldout={soldOut || undefined}>
      <Link to={cardHref(product)} className="di-card__media">
        {img ? (
          <StoreImage src={img} alt={product.name} transformWidth={600} width={600} height={750} loading={priority ? 'eager' : 'lazy'} />
        ) : (
          <span className="di-card__noimg">Sin foto</span>
        )}
        {alt && <StoreImage src={alt} alt="" aria-hidden="true" transformWidth={600} width={600} height={750} className="di-card__alt" />}
        {index != null && <span className="di-card__num">{num(index)}</span>}
        {price && price.offPct > 0 && <span className="di-card__off">−{price.offPct}%</span>}
        {soldOut && <span className="di-card__out">Agotado</span>}
      </Link>
      <Link to={cardHref(product)} className="di-card__body">
        <h3 className="di-card__name">{product.name}</h3>
        <PriceView product={product} cls="di-price" color={product.variant_color} />
        {sizes.length > 0 && <p className="di-card__sizes">{sizes.join(' ')}</p>}
      </Link>
    </article>
  );
}

function GridSkeleton({ n = 8 }: { n?: number }) {
  return (
    <div className="di-grid" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="di-skel" />
      ))}
    </div>
  );
}

// ── Home ──────────────────────────────────────────────────────────────────────
function DistritoHome() {
  const config = useStore();
  const { products, isLoading } = useProducts();
  const { featured, newArrivals, offers } = useHomeSections(products);
  const { categories } = useCategories(products);
  useFirstPaintGate('tpl-home', isLoading);
  const hero = useHero();
  const newTitle = useHeading('new_arrivals', 'Últimos ingresos');
  const featTitle = useHeading('featured', 'Lo más vendido');
  const offersTitle = useHeading('offers', 'Ofertas');
  const drop = useMemo(() => newArrivals.slice(0, 8), [newArrivals]);
  const fallbackImg = drop.find((p) => mainImage(p));
  const heroImg = hero.image ?? (fallbackImg ? mainImage(fallbackImg) : null);
  const ranking = featured.slice(0, 5);
  const cta = hero.ctaText || 'Ver todo';

  return (
    <>
      <Seo title={config.metaTitle || config.name} description={config.metaDescription || config.tagline || config.name} image={config.ogImageUrl} slug={config.slug} siteName={config.name} path="/" />
      {hero.image && !hero.hasText ? (
        <section className="di-banner" aria-label="Portada">
          <h1 className="tpl-sr">{config.name}</h1>
          <Link to={hero.ctaExternal ? '/productos' : hero.ctaLink}>
            <picture>
              {hero.mobile && <source media="(max-width: 899px)" srcSet={hero.mobile} />}
              <img src={hero.image} alt="" fetchPriority="high" />
            </picture>
          </Link>
        </section>
      ) : (
        <section className="di-hero" aria-labelledby="di-hero-title">
          {heroImg && (
            <picture className="di-hero__img">
              {hero.mobile && <source media="(max-width: 899px)" srcSet={hero.mobile} />}
              <img src={heroImg} alt="" fetchPriority="high" />
            </picture>
          )}
          <div className="di-hero__text">
            {hero.subtitle && <p className="di-meta">{hero.subtitle}</p>}
            <h1 id="di-hero-title" className="di-giant">
              {hero.title}
            </h1>
            {hero.ctaExternal ? (
              <a href={hero.ctaLink} className="di-cta" target="_blank" rel="noreferrer">
                {cta}
              </a>
            ) : (
              <Link to={hero.ctaLink} className="di-cta">
                {cta}
              </Link>
            )}
          </div>
        </section>
      )}

      {isLoading ? (
        <section className="di-section">
          <GridSkeleton />
        </section>
      ) : (
        <>
          {drop.length > 0 && (
            <section className="di-section" aria-labelledby="di-new">
              <div className="di-head">
                <h2 id="di-new" className="di-title">
                  {newTitle}
                </h2>
                <Link to="/productos?orden=nuevos" className="di-more">
                  Ver todo [{new Set(products.map((p) => p.id)).size}]
                </Link>
              </div>
              <div className="di-grid">
                {drop.map((p, i) => (
                  <DistritoCard key={p.card_key ?? p.id} product={p} index={i} priority={i < 4} />
                ))}
              </div>
            </section>
          )}

          {categories.length > 0 && (
            <section className="di-section" aria-labelledby="di-cats">
              <div className="di-head">
                <h2 id="di-cats" className="di-title">
                  Categorías
                </h2>
              </div>
              <div className="di-cats" data-count={Math.min(categories.length, 5)}>
                {categories.slice(0, 5).map((c) => {
                  const img = categoryImage(c, products);
                  return (
                    <Link key={c.name} to={categoryHref(c.name)} className="di-cat">
                      {img && <StoreImage src={img} alt="" transformWidth={900} width={900} height={1100} />}
                      <span className="di-cat__name">{c.name}</span>
                      <span className="di-cat__count">[{c.count}]</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {offers.length > 0 && (
            <section className="di-band" aria-labelledby="di-off">
              <div className="di-head">
                <h2 id="di-off" className="di-title">
                  {offersTitle}
                </h2>
                <Link to="/productos" className="di-more">
                  Ver todo
                </Link>
              </div>
              <div className="di-rail">
                {offers.slice(0, 10).map((p) => (
                  <DistritoCard key={p.card_key ?? p.id} product={p} />
                ))}
              </div>
            </section>
          )}

          {ranking.length > 2 && (
            <section className="di-section" aria-labelledby="di-rank">
              <div className="di-head">
                <h2 id="di-rank" className="di-title">
                  {featTitle}
                </h2>
              </div>
              <ol className="di-rank">
                {ranking.map((p, i) => (
                  <li key={p.card_key ?? p.id}>
                    <Link to={cardHref(p)} className="di-rank__item">
                      <span className="di-rank__n">{i + 1}</span>
                      <span className="di-rank__img">
                        {mainImage(p) && <StoreImage src={mainImage(p)} alt="" transformWidth={300} width={200} height={250} />}
                      </span>
                      <span className="di-rank__name">{p.name}</span>
                      <PriceView product={p} cls="di-price di-price--rank" color={p.variant_color} />
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </>
  );
}

// ── Catálogo ──────────────────────────────────────────────────────────────────
function DistritoCatalog() {
  const config = useStore();
  const view = useCatalog();
  useFirstPaintGate('tpl-catalog', view.isLoading);
  const title = view.category ?? (view.query ? view.query : 'Todo');
  return (
    <div className="di-catalog">
      <Seo title={`${view.category ?? 'Productos'} · ${config.name}`} description={config.metaDescription || config.name} slug={config.slug} siteName={config.name} path={view.category ? categoryHref(view.category) : '/productos'} />
      <div className="di-catalog__head">
        {view.query && <p className="di-meta">Resultados para</p>}
        <h1 className="di-giant di-giant--page">{title}</h1>
        <p className="di-meta">{view.isLoading ? ' ' : `[${view.count}] productos`}</p>
      </div>
      <div className="di-filters">
        <nav className="di-chips di-only-desktop" aria-label="Categorías">
          <NavLink to="/productos" end>
            Todo
          </NavLink>
          {view.categories.map((c) => (
            <NavLink key={c.name} to={categoryHref(c.name)}>
              {c.name}
            </NavLink>
          ))}
        </nav>
        <div className="di-filters__tools">
          {view.sizes.length > 1 && (
            <div className="di-sizes" role="group" aria-label="Filtrar por talle">
              {view.sizes.map((s) => (
                <button key={s} type="button" aria-pressed={view.size === s} onClick={() => view.setSize(view.size === s ? null : s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <label className="di-sort">
            <span className="tpl-sr">Ordenar</span>
            <select value={view.sort} onChange={(e) => view.setSort(e.target.value as SortKey)}>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {view.isLoading ? (
        <GridSkeleton n={12} />
      ) : view.products.length === 0 ? (
        <div className="di-empty">
          <p className="di-empty__big">Nada por acá</p>
          <p>{view.size ? 'No hay productos en ese talle.' : 'No encontramos productos con esa búsqueda.'}</p>
          <Link to="/productos" className="di-cta di-cta--ghost">
            Ver todo
          </Link>
        </div>
      ) : (
        <div className="di-grid">
          {view.products.map((p, i) => (
            <DistritoCard key={p.card_key ?? p.id} product={p} priority={i < 4} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Ficha ─────────────────────────────────────────────────────────────────────
function DistritoGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  if (images.length === 0) return <div className="di-gallery di-gallery--empty">Sin fotos</div>;
  return (
    <div className="di-gallery">
      {images.length > 1 && (
        <div className="di-gallery__progress" aria-hidden="true">
          {images.map((src, i) => (
            <span key={src} data-on={i <= index || undefined} />
          ))}
        </div>
      )}
      <div
        className="di-gallery__track"
        tabIndex={0}
        aria-label={`Fotos de ${name}`}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollWidth > el.clientWidth + 4) setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {images.map((src, i) => (
          <figure key={src}>
            <StoreImage src={src} alt={i === 0 ? name : `${name}, foto ${i + 1}`} transformWidth={1000} width={800} height={1000} loading={i < 2 ? 'eager' : 'lazy'} />
          </figure>
        ))}
      </div>
    </div>
  );
}

function DistritoProductView({ product }: { product: Product }) {
  const config = useStore();
  const pdp = usePdp(product);
  const policies = usePolicies();
  const cats = productCategories(product);
  const price = useTplPrice(product, { color: pdp.color, size: pdp.size });
  const cta = pdp.soldOut
    ? 'Agotado'
    : pdp.canAdd
      ? 'Agregar al carrito'
      : pdp.missing === 'ambos'
        ? 'Elegí color y talle'
        : pdp.missing === 'color'
          ? 'Elegí color'
          : pdp.missing === 'talle'
            ? 'Elegí talle'
            : 'Sin stock';
  return (
    <div className="di-pdp">
      <Seo title={`${product.name} · ${config.name}`} description={product.description?.trim() || config.name} image={pdp.images[0]} slug={config.slug} siteName={config.name} path={`/producto/${product.id}`} />
      <DistritoGallery images={pdp.images} name={product.name} />
      <div className="di-pdp__info">
        <div className="di-pdp__sticky">
          {cats[0] && (
            <Link to={categoryHref(cats[0])} className="di-meta di-pdp__cat">
              {cats[0]}
            </Link>
          )}
          <h1 className="di-pdp__name">{product.name}</h1>
          <PriceView product={product} cls="di-price di-price--pdp" color={pdp.color} size={pdp.size} showInstallments />

          {pdp.colors.length > 0 && (
            <fieldset className="di-opt">
              <legend>
                Color <b>{pdp.color ?? '—'}</b>
              </legend>
              <div className="di-opt__row">
                {pdp.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="di-chipbtn"
                    aria-pressed={pdp.color === c}
                    data-out={pdp.colorDisabled(c) || undefined}
                    aria-label={`${c}${pdp.colorDisabled(c) ? ', sin stock' : ''}`}
                    onClick={() => pdp.setColor(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {pdp.sizes.length > 0 && (
            <fieldset className="di-opt">
              <legend>
                Talle <b>{pdp.size ?? '—'}</b>
              </legend>
              <div className="di-opt__sizes">
                {pdp.sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={pdp.size === s}
                    disabled={pdp.sizeDisabled(s)}
                    aria-label={`Talle ${s}${pdp.sizeDisabled(s) ? ', sin stock' : ''}`}
                    onClick={() => pdp.setSize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {pdp.lowStock != null && <p className="di-low">Últimas {pdp.lowStock} unidades en este talle</p>}

          <div className="di-buy">
            {price && <p className="di-buy__price di-only-mobile">{formatPrice(price.big)}</p>}
            <button type="button" className="di-cta di-cta--block" onClick={buyAction(pdp, '.di-pdp')} disabled={pdp.soldOut || (!pdp.canAdd && !pdp.missing)}>
              {cta}
            </button>
          </div>

          <div className="di-pdp__more">
            {product.description?.trim() && (
              <details className="di-acc" open>
                <summary>Detalle</summary>
                <p>{product.description.trim()}</p>
              </details>
            )}
            {policies.map((p) => (
              <details key={p.key} className="di-acc">
                <summary>{p.title}</summary>
                <p>{p.body}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DistritoProduct() {
  const { id } = useParams<{ id: string }>();
  const { product, isLoading } = useProduct(id);
  useFirstPaintGate('tpl-product', isLoading);
  if (isLoading)
    return (
      <div className="di-pdp" aria-busy="true">
        <div className="di-skel di-skel--tall" />
        <div className="di-pdp__info" />
      </div>
    );
  if (!product)
    return (
      <div className="di-empty">
        <p className="di-empty__big">No está más</p>
        <Link to="/productos" className="di-cta di-cta--ghost">
          Ver productos
        </Link>
      </div>
    );
  return <DistritoProductView product={product} />;
}

function DistritoCartPage() {
  const { lines, itemCount } = useCartView();
  return (
    <div className="di-cartpage">
      <h1 className="di-giant di-giant--page">Carrito [{itemCount}]</h1>
      {lines.length === 0 ? (
        <div className="di-empty">
          <p className="di-empty__big">Vacío</p>
          <Link to="/productos" className="di-cta di-cta--ghost">
            Ver productos
          </Link>
        </div>
      ) : (
        <div className="di-cartpage__grid">
          <CartLines />
          <CartSummary />
        </div>
      )}
    </div>
  );
}

function DistritoNotice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="di-empty di-notice">
      <h1 className="di-giant di-giant--page">{title}</h1>
      {children}
    </div>
  );
}

export const distritoKit: TemplateKit = {
  Shell: DistritoShell,
  Home: DistritoHome,
  Catalog: DistritoCatalog,
  Product: DistritoProduct,
  Cart: DistritoCartPage,
  Notice: DistritoNotice,
  fontsHref: 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&display=swap',
};
