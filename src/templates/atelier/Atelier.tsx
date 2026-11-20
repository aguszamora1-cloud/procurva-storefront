/**
 * ATELIER · moda editorial.
 *
 * Dirección de arte: papel cálido y tinta, una Didone (Bodoni Moda) sólo para
 * titulares y nombres grandes, Jost para todo lo demás. Navegación con palabras,
 * sin íconos. Composición asimétrica: la foto manda y el texto acompaña al costado.
 * En celular la portada es una foto a sangre con el título debajo y la ficha es
 * una galería que se desliza, con la bolsa fija abajo.
 */
import { useCallback, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { useProducts } from '@/hooks/useProducts';
import { useProduct } from '@/hooks/useProduct';
import { useHomeSections } from '@/hooks/useHomeSections';
import { useCategories } from '@/hooks/useCategories';
import { StoreImage } from '@/components/StoreImage';
import { Seo } from '@/components/Seo';
import { formatPrice, mainImage, productCategories, colorToHex } from '@/lib/utils';
import type { Product } from '@/lib/types';
import type { TemplateKit } from '../TemplateApp';
import {
  SORT_LABELS,
  cardHref,
  categoryHref,
  categoryImage,
  isSoldOut,
  secondImage,
  useCatalog,
  useContact,
  useHeading,
  useMenuLinks,
  usePdp,
  usePolicies,
  useHero,
  buyAction,
  sameText,
  type CatalogView,
  type SortKey,
} from '../shared/commerce';
import { PriceView } from '../shared/Price';
import { StoreMark, useCartView, useCloseOnRoute, useFitText, useOverlay, useScrolled, useSearchSubmit } from '../shared/ui';
import './atelier.css';

// ── Encabezado ────────────────────────────────────────────────────────────────
function AtelierHeader({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { itemCount, open } = useCartView();
  const { products } = useProducts();
  const { categories } = useCategories(products);
  const scrolled = useScrolled();
  return (
    <header className="at-header" data-scrolled={scrolled || undefined}>
      <div className="at-header__inner">
        <nav className="at-header__nav" aria-label="Principal">
          <button type="button" className="at-link at-only-mobile" onClick={onMenu}>
            Menú
          </button>
          <NavLink to="/productos" className="at-link at-only-desktop" end>
            Tienda
          </NavLink>
          {categories.slice(0, 3).map((c) => (
            <NavLink key={c.name} to={categoryHref(c.name)} className="at-link at-only-desktop">
              {c.name}
            </NavLink>
          ))}
          {categories.length > 3 && (
            <button type="button" className="at-link at-only-desktop" onClick={onMenu}>
              Más
            </button>
          )}
        </nav>
        <Link to="/" className="at-header__brand" aria-label="Inicio">
          <StoreMark className="at-header__logo" />
        </Link>
        <div className="at-header__tools">
          <button type="button" className="at-link at-only-desktop" onClick={onSearch}>
            Buscar
          </button>
          <button type="button" className="at-link" onClick={open} aria-label={`Bolsa, ${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}`}>
            Bolsa <span className="at-count">{itemCount}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function AtelierMenu({ open, close, onSearch }: { open: boolean; close: () => void; onSearch: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(open, close, ref);
  const { products } = useProducts();
  const { categories } = useCategories(products);
  const links = useMenuLinks();
  const contact = useContact();
  if (!open) return null;
  return (
    <div className="at-overlay" role="dialog" aria-modal="true" aria-label="Menú" ref={ref}>
      <div className="at-overlay__bar">
        <button type="button" className="at-link" onClick={close}>
          Cerrar
        </button>
        <button
          type="button"
          className="at-link"
          onClick={() => {
            close();
            onSearch();
          }}
        >
          Buscar
        </button>
      </div>
      <nav className="at-menu" aria-label="Categorías">
        <Link to="/productos" className="at-menu__item" onClick={close}>
          Toda la tienda
        </Link>
        {categories.map((c) => (
          <Link key={c.name} to={categoryHref(c.name)} className="at-menu__item" onClick={close}>
            {c.name}
            <sup>{c.count}</sup>
          </Link>
        ))}
      </nav>
      {(links.length > 0 || contact.length > 0) && (
        <div className="at-menu__foot">
          {links.map((l) =>
            l.external ? (
              <a key={l.label} href={l.to} className="at-link" target="_blank" rel="noreferrer">
                {l.label}
              </a>
            ) : (
              <Link key={l.label} to={l.to} className="at-link" onClick={close}>
                {l.label}
              </Link>
            ),
          )}
          {contact.map((c) => (
            <a key={c.href} href={c.href} className="at-link" target="_blank" rel="noreferrer">
              {c.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function AtelierSearch({ open, close }: { open: boolean; close: () => void }) {
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
    <div className="at-search" role="dialog" aria-modal="true" aria-label="Buscar" ref={ref}>
      <form onSubmit={onSubmit} className="at-search__form" role="search">
        <label htmlFor="at-q" className="at-eyebrow">
          Buscar en la tienda
        </label>
        <input id="at-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del producto" autoComplete="off" />
        <div className="at-search__actions">
          <button type="button" className="at-link" onClick={close}>
            Cerrar
          </button>
          <button type="submit" className="at-link">
            Buscar
          </button>
        </div>
      </form>
    </div>
  );
}

function AtelierFooter() {
  const config = useStore();
  const links = useMenuLinks();
  const contact = useContact();
  const policies = usePolicies();
  const year = new Date().getFullYear();
  return (
    <footer className="at-footer">
      <div className="at-footer__grid">
        <div>
          <p className="at-footer__name">{config.name}</p>
          {config.tagline && !sameText(config.tagline, config.name) && <p className="at-footer__tag">{config.tagline}</p>}
        </div>
        <nav aria-label="Tienda">
          <p className="at-eyebrow">Tienda</p>
          <Link to="/productos">Todos los productos</Link>
          <Link to="/carrito">Bolsa</Link>
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
            <p className="at-eyebrow">Ayuda</p>
            {policies.map((p) => (
              <details key={p.key} className="at-footer__policy">
                <summary>{p.title}</summary>
                <p>{p.body}</p>
              </details>
            ))}
          </div>
        )}
        {contact.length > 0 && (
          <div>
            <p className="at-eyebrow">Contacto</p>
            {contact.map((c) => (
              <a key={c.href} href={c.href} target="_blank" rel="noreferrer">
                {c.label}
              </a>
            ))}
          </div>
        )}
      </div>
      <p className="at-footer__legal">
        © {year} {config.name}
      </p>
    </footer>
  );
}

// ── Bolsa ─────────────────────────────────────────────────────────────────────
// Atelier no usa un cajón lateral: la bolsa despliega desde el encabezado como un
// panel del alto de su contenido (sin huecos), con fotos grandes y el total en serif.
function BagLines({ compact }: { compact?: boolean }) {
  const { lines, updateQty, removeItem } = useCartView();
  return (
    <ul className={`at-bag__lines${compact ? ' at-bag__lines--compact' : ''}`}>
      {lines.map(({ key, item, unit, total, before }) => (
        <li key={key} className="at-bag__line">
          <Link to={`/producto/${item.product_id}`} className="at-bag__thumb">
            {item.image_url ? <StoreImage src={item.image_url} alt="" transformWidth={300} width={150} height={200} /> : null}
          </Link>
          <div className="at-bag__info">
            <Link to={`/producto/${item.product_id}`} className="at-bag__name">
              {item.name}
            </Link>
            <p className="at-bag__meta">{[item.color, item.size && `Talle ${item.size}`].filter(Boolean).join(' · ')}</p>
            <div className="at-bag__qty" role="group" aria-label={`Cantidad de ${item.name}`}>
              <span className="at-bag__qlabel">Cantidad</span>
              <button type="button" onClick={() => updateQty(key, item.qty - 1)} aria-label={`Quitar una unidad de ${item.name}`}>
                −
              </button>
              <span aria-live="polite">{item.qty}</span>
              <button type="button" onClick={() => updateQty(key, item.qty + 1)} aria-label={`Sumar una unidad de ${item.name}`}>
                +
              </button>
            </div>
            <div className="at-bag__foot">
              <p className="at-bag__price">
                {formatPrice(total)}
                {before != null && <s>{formatPrice(before * item.qty)}</s>}
                {item.qty > 1 && <small>{formatPrice(unit)} c/u</small>}
              </p>
              <button type="button" className="at-bag__remove" onClick={() => removeItem(key)}>
                Quitar
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function BagSummary({ onContinue }: { onContinue?: () => void }) {
  const { subtotal, freeShippingLeft } = useCartView();
  return (
    <div className="at-bag__summary">
      <p className="at-bag__subtotal">
        <span>Subtotal</span>
        <span>{formatPrice(subtotal)}</span>
      </p>
      {freeShippingLeft != null && (
        <p className="at-bag__note">
          {freeShippingLeft > 0 ? `Te faltan ${formatPrice(freeShippingLeft)} para el envío gratis.` : 'Tu compra tiene envío gratis.'}
        </p>
      )}
      <p className="at-bag__note">El envío y los descuentos por medio de pago se calculan en el checkout.</p>
      <Link to="/checkout" className="at-button">
        Finalizar compra
      </Link>
      {onContinue && (
        <button type="button" className="at-link at-link--line at-bag__continue" onClick={onContinue}>
          Seguir comprando
        </button>
      )}
    </div>
  );
}

function AtelierBag() {
  const { isOpen, close, lines, itemCount } = useCartView();
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(isOpen, close, ref);
  useCloseOnRoute(close);
  if (!isOpen) return null;
  return (
    <div className="at-drawer" role="dialog" aria-modal="true" aria-label="Bolsa">
      <button type="button" className="at-drawer__scrim" aria-label="Cerrar la bolsa" onClick={close} tabIndex={-1} />
      <div className="at-drawer__panel" ref={ref}>
        <div className="at-drawer__head">
          <p className="at-drawer__title">
            Bolsa <span>{itemCount > 0 ? `(${itemCount})` : ''}</span>
          </p>
          <button type="button" className="at-link" onClick={close}>
            Cerrar
          </button>
        </div>
        <div className="at-drawer__body">
          {lines.length === 0 ? (
            <div className="at-empty">
              <p>Tu bolsa está vacía.</p>
              <Link to="/productos" className="at-link at-link--line" onClick={close}>
                Ver la tienda
              </Link>
            </div>
          ) : (
            <>
              <BagLines compact />
              <BagSummary onContinue={close} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AtelierShell({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const closeSearch = useCallback(() => setSearch(false), []);
  useCloseOnRoute(closeMenu);
  return (
    <div className="tpl-atelier">
      <a href="#at-main" className="at-skip">
        Ir al contenido
      </a>
      <AtelierHeader onMenu={() => setMenu(true)} onSearch={() => setSearch(true)} />
      <AtelierMenu open={menu} close={closeMenu} onSearch={() => setSearch(true)} />
      <AtelierSearch open={search} close={closeSearch} />
      <main id="at-main" className="at-main">
        {children}
      </main>
      <AtelierFooter />
      <AtelierBag />
    </div>
  );
}

// ── Tarjeta ───────────────────────────────────────────────────────────────────
function AtelierCard({ product, priority, size = 'md' }: { product: Product; priority?: boolean; size?: 'md' | 'lg' }) {
  const img = mainImage(product);
  const alt = secondImage(product);
  const soldOut = isSoldOut(product);
  const w = size === 'lg' ? 900 : 560;
  return (
    <article className={`at-card at-card--${size}`}>
      <Link to={cardHref(product)} className="at-card__media">
        {img ? (
          <StoreImage src={img} alt={product.name} transformWidth={w} width={600} height={800} loading={priority ? 'eager' : 'lazy'} />
        ) : (
          <span className="at-card__noimg">Sin foto</span>
        )}
        {alt && <StoreImage src={alt} alt="" aria-hidden="true" transformWidth={w} width={600} height={800} className="at-card__alt" />}
        {soldOut && <span className="at-card__flag">Agotado</span>}
      </Link>
      <div className="at-card__body">
        <Link to={cardHref(product)} className="at-card__name">
          {product.name}
        </Link>
        <PriceView product={product} cls="at-price" color={product.variant_color} />
      </div>
    </article>
  );
}

function CardSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="at-grid" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="at-skel">
          <div className="at-skel__img" />
          <div className="at-skel__line" />
          <div className="at-skel__line at-skel__line--short" />
        </div>
      ))}
    </div>
  );
}

// ── Home ──────────────────────────────────────────────────────────────────────
function AtelierHome() {
  const config = useStore();
  const { products, isLoading } = useProducts();
  const { featured, newArrivals, offers } = useHomeSections(products);
  const { categories } = useCategories(products);
  useFirstPaintGate('tpl-home', isLoading);
  const newTitle = useHeading('new_arrivals', 'Novedades');
  const featTitle = useHeading('featured', 'Lo más elegido');
  const offersTitle = useHeading('offers', 'Precios especiales');
  const news = useMemo(() => newArrivals.filter((p) => mainImage(p)).slice(0, 5), [newArrivals]);
  const hero = useHero();
  const coverName = useFitText<HTMLHeadingElement>(config.name, 32);
  const heroImg = hero.image ?? (news[0] ? mainImage(news[0]) : null);
  const heroMobile = hero.mobile ?? heroImg;
  const second = news.find((p) => mainImage(p) !== heroImg);
  const [heading, ...rest] = news;
  const rail = featured.slice(0, 8);
  const cta = hero.ctaText || 'Ver la tienda';
  const ctaNode = hero.ctaExternal ? (
    <a href={hero.ctaLink} target="_blank" rel="noreferrer" className="at-link at-link--line">
      {cta}
    </a>
  ) : (
    <Link to={hero.ctaLink} className="at-link at-link--line">
      {cta}
    </Link>
  );
  const bannerPicture = (
    <picture>
      {hero.mobile && <source media="(max-width: 899px)" srcSet={hero.mobile} />}
      <img src={hero.image ?? ''} alt="" fetchPriority="high" />
    </picture>
  );

  return (
    <>
      <Seo title={config.metaTitle || config.name} description={config.metaDescription || config.tagline || config.name} image={config.ogImageUrl} slug={config.slug} siteName={config.name} path="/" />
      {hero.image && !hero.hasText ? (
        // Portada con el texto dentro de la imagen: entera, en su proporción,
        // enmarcada como una tapa (nombre e índice real de la tienda al costado).
        <section className="at-cover" aria-labelledby="at-cover-title">
          <div className="at-cover__mast">
            <h1 id="at-cover-title" className="at-cover__name" ref={coverName}>
              {config.name}
            </h1>
            {config.tagline && !sameText(config.tagline, config.name) && <p className="at-hero__sub">{config.tagline}</p>}
            {categories.length > 0 && (
              <nav className="at-cover__index" aria-label="Categorías">
                {categories.slice(0, 6).map((c) => (
                  <Link key={c.name} to={categoryHref(c.name)}>
                    <span>{c.name}</span>
                    <span className="at-cover__count">{c.count}</span>
                  </Link>
                ))}
              </nav>
            )}
            <Link to="/productos" className="at-link at-link--line">
              Ver toda la tienda
            </Link>
          </div>
          <div className="at-cover__art">
            {config.heroCtaLink ? (
              hero.ctaExternal ? (
                <a href={hero.ctaLink} target="_blank" rel="noreferrer" aria-label={hero.ctaText || 'Ver productos'}>
                  {bannerPicture}
                </a>
              ) : (
                <Link to={hero.ctaLink} aria-label={hero.ctaText || 'Ver productos'}>{bannerPicture}</Link>
              )
            ) : (
              bannerPicture
            )}
          </div>
        </section>
      ) : (
        <section className="at-hero" aria-labelledby="at-hero-title">
          <div className="at-hero__main">
            {heroImg && (
              <picture>
                {heroMobile && <source media="(max-width: 899px)" srcSet={heroMobile} />}
                <img src={heroImg} alt="" fetchPriority="high" />
              </picture>
            )}
          </div>
          <div className="at-hero__text">
            <h1 id="at-hero-title" className="at-display">
              {hero.title}
            </h1>
            {hero.subtitle && <p className="at-hero__sub">{hero.subtitle}</p>}
            {ctaNode}
          </div>
          {second && (
            <Link to={cardHref(second)} className="at-hero__second">
              <StoreImage src={mainImage(second)} alt={second.name} transformWidth={600} width={600} height={800} loading="eager" />
              <span>{second.name}</span>
            </Link>
          )}
        </section>
      )}

      {isLoading ? (
        <section className="at-section">
          <CardSkeleton />
        </section>
      ) : (
        <>
          {heading && (
            <section className="at-section" aria-labelledby="at-new">
              <div className="at-section__head">
                <h2 id="at-new" className="at-title">
                  {newTitle}
                </h2>
                <Link to="/productos?orden=nuevos" className="at-link at-link--line">
                  Ver todo
                </Link>
              </div>
              <div className="at-edit">
                <div className="at-edit__lead">
                  <AtelierCard product={heading} size="lg" />
                </div>
                <div className="at-edit__rest">
                  {rest.slice(0, 4).map((p) => (
                    <AtelierCard key={p.card_key ?? p.id} product={p} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {categories.length > 1 && (
            <section className="at-section at-index" aria-labelledby="at-cats">
              <h2 id="at-cats" className="at-eyebrow">
                Categorías
              </h2>
              <ol className="at-index__list">
                {categories.slice(0, 8).map((c, i) => {
                  const img = categoryImage(c, products);
                  return (
                    <li key={c.name}>
                      <Link to={categoryHref(c.name)} className="at-index__item">
                        <span className="at-index__num">{String(i + 1).padStart(2, '0')}</span>
                        <span className="at-index__name">{c.name}</span>
                        <span className="at-index__count">{c.count}</span>
                        {img && <StoreImage src={img} alt="" transformWidth={400} width={300} height={400} className="at-index__peek" />}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {rail.length > 0 && (
            <section className="at-section" aria-labelledby="at-feat">
              <div className="at-section__head">
                <h2 id="at-feat" className="at-title">
                  {featTitle}
                </h2>
                <Link to="/productos" className="at-link at-link--line">
                  Ver todo
                </Link>
              </div>
              <div className="at-rail">
                {rail.map((p) => (
                  <AtelierCard key={p.card_key ?? p.id} product={p} />
                ))}
              </div>
            </section>
          )}

          {offers.length > 0 && (
            <section className="at-section" aria-labelledby="at-off">
              <div className="at-section__head">
                <h2 id="at-off" className="at-title">
                  {offersTitle}
                </h2>
                <Link to="/productos" className="at-link at-link--line">
                  Ver todo
                </Link>
              </div>
              <div className="at-grid">
                {offers.slice(0, 6).map((p) => (
                  <AtelierCard key={p.card_key ?? p.id} product={p} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

// ── Catálogo ──────────────────────────────────────────────────────────────────
function AtelierFilters({ open, close, view }: { open: boolean; close: () => void; view: CatalogView }) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(open, close, ref);
  if (!open) return null;
  return (
    <div className="at-overlay" role="dialog" aria-modal="true" aria-label="Filtrar y ordenar" ref={ref}>
      <div className="at-overlay__bar">
        <span className="at-eyebrow">Filtrar y ordenar</span>
        <button type="button" className="at-link" onClick={close}>
          Listo
        </button>
      </div>
      <nav className="at-menu at-menu--filters" aria-label="Categorías">
        <NavLink to="/productos" end className="at-menu__item" onClick={close}>
          Todo
        </NavLink>
        {view.categories.map((c) => (
          <NavLink key={c.name} to={categoryHref(c.name)} className="at-menu__item" onClick={close}>
            {c.name}
            <sup>{c.count}</sup>
          </NavLink>
        ))}
      </nav>
      {view.sizes.length > 1 && (
        <fieldset className="at-filterset">
          <legend className="at-eyebrow">Talle</legend>
          <div className="at-opt__sizes">
            {view.sizes.map((s) => (
              <button key={s} type="button" className="at-size" aria-pressed={view.size === s} onClick={() => view.setSize(view.size === s ? null : s)}>
                {s}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="at-filterset">
        <legend className="at-eyebrow">Orden</legend>
        <div className="at-filterset__sort">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <button key={k} type="button" className="at-link" aria-pressed={view.sort === k} onClick={() => view.setSort(k)}>
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function AtelierCatalog() {
  const config = useStore();
  const view = useCatalog();
  const [filters, setFilters] = useState(false);
  const closeFilters = useCallback(() => setFilters(false), []);
  useFirstPaintGate('tpl-catalog', view.isLoading);
  const title = view.category ?? (view.query ? `“${view.query}”` : 'Tienda');
  const active = [view.size && `Talle ${view.size}`, view.sort !== 'relevancia' && SORT_LABELS[view.sort]].filter(Boolean).join(' · ');
  return (
    <div className="at-catalog">
      <Seo title={`${view.category ?? 'Productos'} · ${config.name}`} description={config.metaDescription || config.name} slug={config.slug} siteName={config.name} path={view.category ? categoryHref(view.category) : '/productos'} />
      <div className="at-catalog__head">
        <h1 className="at-display at-display--page">{title}</h1>
        <p className="at-catalog__count">{view.isLoading ? ' ' : `${view.count} ${view.count === 1 ? 'producto' : 'productos'}`}</p>
      </div>
      <div className="at-catalog__mbar">
        <button type="button" className="at-link at-link--line" onClick={() => setFilters(true)}>
          Filtrar y ordenar
        </button>
        {active && <span>{active}</span>}
      </div>
      <div className="at-catalog__bar">
        <nav className="at-catalog__cats" aria-label="Categorías">
          <NavLink to="/productos" end className="at-link">
            Todo
          </NavLink>
          {view.categories.map((c) => (
            <NavLink key={c.name} to={categoryHref(c.name)} className="at-link">
              {c.name}
            </NavLink>
          ))}
        </nav>
        <div className="at-catalog__tools">
          {view.sizes.length > 1 && (
            <label className="at-select">
              <span>Talle</span>
              <select value={view.size ?? ''} onChange={(e) => view.setSize(e.target.value || null)}>
                <option value="">Todos</option>
                {view.sizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="at-select">
            <span>Orden</span>
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
        <CardSkeleton n={9} />
      ) : view.products.length === 0 ? (
        <div className="at-empty at-empty--page">
          <p>No hay productos {view.query ? 'que coincidan con la búsqueda' : 'en esta selección'}.</p>
          <Link to="/productos" className="at-link at-link--line">
            Ver toda la tienda
          </Link>
        </div>
      ) : (
        <div className="at-grid at-grid--catalog">
          {view.products.map((p, i) => (
            <AtelierCard key={p.card_key ?? p.id} product={p} priority={i < 3} />
          ))}
        </div>
      )}
      <AtelierFilters open={filters} close={closeFilters} view={view} />
    </div>
  );
}

// ── Ficha ─────────────────────────────────────────────────────────────────────
function AtelierGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  if (images.length === 0) return <div className="at-gallery at-gallery--empty">Sin fotos</div>;
  return (
    <div className="at-gallery">
      <div className="at-gallery__track" onScroll={onScroll} tabIndex={0} aria-label={`Fotos de ${name}`}>
        {images.map((src, i) => (
          <figure key={src} className="at-gallery__item">
            <StoreImage src={src} alt={i === 0 ? name : `${name}, foto ${i + 1}`} transformWidth={1200} width={900} height={1200} loading={i === 0 ? 'eager' : 'lazy'} />
          </figure>
        ))}
      </div>
      {images.length > 1 && (
        <p className="at-gallery__count" aria-hidden="true">
          {index + 1} / {images.length}
        </p>
      )}
    </div>
  );
}

function AtelierProductView({ product }: { product: Product }) {
  const config = useStore();
  const pdp = usePdp(product);
  const policies = usePolicies();
  const cats = productCategories(product);
  const cta = pdp.soldOut
    ? 'Agotado'
    : pdp.canAdd
      ? 'Agregar a la bolsa'
      : pdp.missing === 'ambos'
        ? 'Elegí color y talle'
        : pdp.missing === 'color'
          ? 'Elegí un color'
          : pdp.missing === 'talle'
            ? 'Elegí tu talle'
            : 'Sin stock';
  return (
    <div className="at-pdp">
      <Seo title={`${product.name} · ${config.name}`} description={product.description?.trim() || config.name} image={pdp.images[0]} slug={config.slug} siteName={config.name} path={`/producto/${product.id}`} />
      <AtelierGallery images={pdp.images} name={product.name} />
      <div className="at-pdp__info">
        <div className="at-pdp__sticky">
          <nav className="at-crumbs" aria-label="Ubicación">
            <Link to="/productos">Tienda</Link>
            {cats[0] && (
              <>
                <span aria-hidden="true"> / </span>
                <Link to={categoryHref(cats[0])}>{cats[0]}</Link>
              </>
            )}
          </nav>
          <h1 className="at-pdp__name">{product.name}</h1>
          <PriceView product={product} cls="at-price at-price--pdp" color={pdp.color} size={pdp.size} showInstallments />

          {pdp.colors.length > 0 && (
            <fieldset className="at-opt">
              <legend>
                Color <span>{pdp.color ?? ''}</span>
              </legend>
              <div className="at-opt__colors">
                {pdp.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="at-swatch"
                    aria-pressed={pdp.color === c}
                    aria-label={`${c}${pdp.colorDisabled(c) ? ', sin stock' : ''}`}
                    data-out={pdp.colorDisabled(c) || undefined}
                    onClick={() => pdp.setColor(c)}
                  >
                    <span style={{ backgroundColor: colorToHex(c) }} />
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {pdp.sizes.length > 0 && (
            <fieldset className="at-opt">
              <legend>Talle</legend>
              <div className="at-opt__sizes">
                {pdp.sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="at-size"
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

          {pdp.lowStock != null && <p className="at-pdp__low">Quedan {pdp.lowStock} en este talle.</p>}

          <div className="at-pdp__buy">
            <button type="button" className="at-button" onClick={buyAction(pdp, ".at-pdp")} disabled={pdp.soldOut || (!pdp.canAdd && !pdp.missing)}>
              {cta}
            </button>
          </div>

          <div className="at-pdp__details">
            {product.description?.trim() && (
              <details open>
                <summary>Descripción</summary>
                <p className="at-pdp__desc">{product.description.trim()}</p>
              </details>
            )}
            {policies.map((p) => (
              <details key={p.key}>
                <summary>{p.title}</summary>
                <p className="at-pdp__desc">{p.body}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AtelierProduct() {
  const { id } = useParams<{ id: string }>();
  const { product, isLoading } = useProduct(id);
  useFirstPaintGate('tpl-product', isLoading);
  if (isLoading)
    return (
      <div className="at-pdp" aria-busy="true">
        <div className="at-gallery">
          <div className="at-skel__img at-skel__img--tall" />
        </div>
        <div className="at-pdp__info">
          <div className="at-skel__line" />
          <div className="at-skel__line at-skel__line--short" />
        </div>
      </div>
    );
  if (!product)
    return (
      <div className="at-empty at-empty--page">
        <p>Este producto ya no está disponible.</p>
        <Link to="/productos" className="at-link at-link--line">
          Ver la tienda
        </Link>
      </div>
    );
  return <AtelierProductView product={product} />;
}

// ── Página de la bolsa ────────────────────────────────────────────────────────
function AtelierCart() {
  const { lines } = useCartView();
  return (
    <div className="at-cartpage">
      <h1 className="at-display at-display--page">Bolsa</h1>
      {lines.length === 0 ? (
        <div className="at-empty at-empty--page">
          <p>Tu bolsa está vacía.</p>
          <Link to="/productos" className="at-link at-link--line">
            Ver la tienda
          </Link>
        </div>
      ) : (
        <div className="at-cartpage__grid">
          <BagLines />
          <BagSummary />
        </div>
      )}
    </div>
  );
}

function AtelierNotice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="at-empty at-empty--page at-notice">
      <h1 className="at-display at-display--page">{title}</h1>
      {children}
    </div>
  );
}

export const atelierKit: TemplateKit = {
  Shell: AtelierShell,
  Home: AtelierHome,
  Catalog: AtelierCatalog,
  Product: AtelierProduct,
  Cart: AtelierCart,
  Notice: AtelierNotice,
  fontsHref:
    'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=Jost:wght@400;500&display=swap',
};
