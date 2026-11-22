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
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { transformedSrc } from '@/lib/images';
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
import { TierPicker, TierUnits, type ChoicesProps } from '../shared/TierPicker';
import {
  SORT_LABELS,
  brandOr,
  buyAction,
  cardHref,
  categoryHref,
  categoryImage,
  isNeutralColor,
  isSoldOut,
  secondImage,
  sizesInStock,
  splitContact,
  useCatalog,
  useContact,
  useHeading,
  useHero,
  useMenuLinks,
  usePdp,
  useTplTiers,
  tierBuyAction,
  tierStockNotice,
  usePolicies,
  useQtyPromoMessage,
  useTplPrice,
  type SortKey,
} from '../shared/commerce';
import { PriceView } from '../shared/Price';
import { StoreMark, unitsLabel, useCartView, useCloseOnRoute, useFitText, useOverlay, useSearchSubmit } from '../shared/ui';
import './distrito.css';


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
              Todo
              <small>[{products.length}]</small>
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.name}>
              <Link to={categoryHref(c.name)} onClick={close}>
                {c.name}
                <small>[{c.count}]</small>
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

/** Nombre gigante del pie: se achica hasta entrar en un renglón (nombres largos). */
function FitName({ text }: { text: string }) {
  const ref = useFitText<HTMLParagraphElement>(text);
  return (
    <p className="di-footer__name" aria-hidden="true" ref={ref}>
      {text}
    </p>
  );
}

function DistritoFooter() {
  const config = useStore();
  const links = useMenuLinks();
  const { social, direct } = splitContact(useContact());
  const policies = usePolicies();
  return (
    <footer className="di-footer">
      <FitName text={config.name} />
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
        {direct.length > 0 && (
          <div>
            <p className="di-meta">Contacto</p>
            {direct.map((c) => (
              <a key={c.href} href={c.href} target="_blank" rel="noreferrer">
                {c.label}
              </a>
            ))}
          </div>
        )}
        {social.length > 0 && (
          <div>
            <p className="di-meta">Seguinos</p>
            {social.map((c) => (
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
  const { rows } = useCartView();
  return (
    <ul className="di-lines">
      {rows.map((row) => (
        <li key={row.key} className="di-line" data-group={row.group ?? undefined}>
          <Link to={`/producto/${row.productId}`} className="di-line__img" tabIndex={-1} aria-hidden="true">
            {row.image && <StoreImage src={row.image} alt="" transformWidth={200} width={120} height={150} />}
          </Link>
          <div className="di-line__info">
            <Link to={`/producto/${row.productId}`} className="di-line__name">
              {row.name}
            </Link>
            {row.item ? (
              <p className="di-meta">
                {[row.item.color, row.item.size].filter(Boolean).join(' / ')}
                {row.unit != null ? ` · ${formatPrice(row.unit)} c/u` : ''}
              </p>
            ) : (
              row.detail && <p className="di-line__group">{row.detail}</p>
            )}
            <div className="di-line__row">
              {row.qty ? (
                <div className="di-qty">
                  <button type="button" onClick={row.qty.dec} aria-label={`Quitar una unidad de ${row.name}`}>
                    −
                  </button>
                  <span aria-live="polite">{row.units}</span>
                  <button type="button" onClick={row.qty.inc} aria-label={`Sumar una unidad de ${row.name}`}>
                    +
                  </button>
                </div>
              ) : (
                <span className="di-qty di-qty--fixed">{unitsLabel(row.units)}</span>
              )}
              <button type="button" className="di-line__remove" onClick={row.remove} aria-label={`Quitar ${row.name}${row.group ? ' (todo el grupo)' : ''}`}>
                Quitar
              </button>
            </div>
          </div>
          <p className="di-line__price">
            {row.price.strike != null && <s>{formatPrice(row.price.strike)}</s>}
            {formatPrice(row.price.big)}
            {row.price.small != null && (
              <small>
                {formatPrice(row.price.small)} {row.price.smallLabel}
              </small>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ShipBlock() {
  const { freeShippingLeft, freeShippingPct: pct } = useCartView();
  if (freeShippingLeft == null) return null;
  return (
    <div className="di-ship">
      <p>{freeShippingLeft > 0 ? `Sumá ${formatPrice(freeShippingLeft)} y el envío es gratis` : 'Envío gratis'}</p>
      <div className="di-ship__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance hacia el envío gratis">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CartSummary() {
  const { subtotal, couponCode } = useCartView();
  return (
    <div className="di-summary">
      <p className="di-summary__row">
        <span>Subtotal</span>
        <span>
          {subtotal.strike != null && (
            <s>
              <span className="tpl-sr">Antes </span>
              {formatPrice(subtotal.strike)}
            </s>
          )}
          {formatPrice(subtotal.big)}
        </span>
      </p>
      {subtotal.small != null && (
        <p className="di-summary__small">
          {formatPrice(subtotal.small)} {subtotal.smallLabel}
        </p>
      )}
      {couponCode && <p className="di-summary__small">Con el cupón {couponCode}</p>}
      <p className="di-meta">Envío y descuentos por medio de pago, en el checkout.</p>
      <Link to="/checkout" className="di-cta di-cta--block">
        Ir a pagar
      </Link>
    </div>
  );
}

/** Debajo de los productos: los últimos ingresos que no están en el carrito y las categorías (datos reales). */
function KeepLooking({ onPick }: { onPick: () => void }) {
  const { products } = useProducts();
  const { categories } = useCategories(products);
  const { rows } = useCartView();
  const inCart = new Set(rows.map((r) => r.productId));
  const fresh = products
    .filter((p) => !inCart.has(p.id) && mainImage(p) && !isSoldOut(p))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 8);
  if (categories.length === 0 && fresh.length === 0) return null;
  return (
    <>
      {fresh.length > 0 && (
        <section className="di-keep__fresh" aria-label="Últimos ingresos">
          <p className="di-meta">Últimos ingresos</p>
          <div className="di-keep__rail">
            {fresh.map((p) => (
              <Link key={p.id} to={cardHref(p)} onClick={onPick} className="di-keep__item">
                <StoreImage src={mainImage(p)} alt="" transformWidth={240} width={120} height={150} />
                <span>{p.name}</span>
                <PriceView product={p} cls="di-price di-price--mini" />
              </Link>
            ))}
          </div>
        </section>
      )}
      {categories.length > 0 && (
    <nav className="di-keep" aria-label="Seguí mirando">
      <p className="di-meta">Seguí mirando</p>
      <div>
        {categories.slice(0, 8).map((c) => (
          <Link key={c.name} to={categoryHref(c.name)} onClick={onPick}>
            {c.name}
          </Link>
        ))}
      </div>
    </nav>
      )}
    </>
  );
}

function DistritoCart() {
  const { isOpen, close, rows, itemCount } = useCartView();
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
        {rows.length === 0 ? (
          <div className="di-drawer__scroll">
            <div className="di-empty">
              <p className="di-empty__big">Vacío</p>
              <Link to="/productos" className="di-cta di-cta--ghost" onClick={close}>
                Ver productos
              </Link>
            </div>
            <KeepLooking onPick={close} />
          </div>
        ) : (
          <>
            <ShipBlock />
            <div className="di-drawer__scroll">
              <CartLines />
              <KeepLooking onPick={close} />
            </div>
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
  // Acento de señal: el del comercio si tiene tono y se lee sobre negro; si es
  // blanco, negro o gris, el naranja propio de Distrito (si no, pierde identidad).
  const signal = isNeutralColor(config.colorAccent) ? '#ff5b1f' : brandOr(config.colorAccent, '#0e0e0e', '#ff5b1f');
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
function DistritoCard({ product, priority }: { product: Product; priority?: boolean }) {
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
/** Tira horizontal de productos (ingresos debajo del banner). */
function DropRail({ products, title, id }: { products: Product[]; title: string; id: string }) {
  return (
    <section className="di-drop" aria-labelledby={id}>
      <div className="di-drop__head">
        <h2 id={id} className="di-title">
          {title}
        </h2>
        <Link to="/productos?orden=nuevos" className="di-more">
          Ver todo
        </Link>
      </div>
      <div className="di-drop__rail">
        {products.map((p, i) => (
          <DistritoCard key={p.card_key ?? p.id} product={p} priority={i < 4} />
        ))}
      </div>
    </section>
  );
}

function DistritoHome() {
  const config = useStore();
  const { products, isLoading } = useProducts();
  const { featured, newArrivals, offers } = useHomeSections(products);
  const { categories } = useCategories(products);
  useFirstPaintGate('tpl-home', isLoading);
  const hero = useHero();
  const newTitle = useHeading('new_arrivals', 'Últimos ingresos');
  const featTitle = useHeading('featured', 'Destacados');
  const offersTitle = useHeading('offers', 'Ofertas');
  const drop = useMemo(() => newArrivals.slice(0, 10), [newArrivals]);
  const fallbackImg = drop.find((p) => mainImage(p));
  const heroImg = hero.image ?? (fallbackImg ? mainImage(fallbackImg) : null);
  const bannerMode = Boolean(hero.image && !hero.hasText);
  const featuredIds = new Set(drop.map((p) => p.card_key ?? p.id));
  const picks = featured.filter((p) => !featuredIds.has(p.card_key ?? p.id)).slice(0, 3);
  const cta = hero.ctaText || 'Ver todo';

  return (
    <>
      <Seo title={config.metaTitle || config.name} description={config.metaDescription || config.tagline || config.name} image={config.ogImageUrl} slug={config.slug} siteName={config.name} path="/" />
      {bannerMode ? (
        // Banner del comercio entero sobre una franja negra a sangre; debajo,
        // en la misma pantalla, arranca la tira de ingresos.
        <section className="di-banner" aria-label="Portada">
          <h1 className="tpl-sr">{config.name}</h1>
          <Link to={hero.ctaExternal ? '/productos' : hero.ctaLink} aria-label={hero.ctaText || 'Ver productos'}>
            <picture>
              {hero.mobile && <source media="(max-width: 899px)" srcSet={hero.mobile} />}
              <img src={hero.image ?? ''} alt="" fetchPriority="high" />
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
          {drop.length > 0 && <DropRail products={drop} title={newTitle} id="di-new" />}

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

          {picks.length > 0 && (
            <section className="di-section" aria-labelledby="di-feat">
              <div className="di-head">
                <h2 id="di-feat" className="di-title">
                  {featTitle}
                </h2>
                <Link to="/productos" className="di-more">
                  Ver todo
                </Link>
              </div>
              <div className="di-picks">
                {picks.map((p) => (
                  <Link key={p.card_key ?? p.id} to={cardHref(p)} className="di-pick">
                    {mainImage(p) && <StoreImage src={mainImage(p)} alt="" transformWidth={900} width={900} height={1125} />}
                    <span className="di-pick__text">
                      <span className="di-pick__name">{p.name}</span>
                      <PriceView product={p} cls="di-price di-price--pick" color={p.variant_color} />
                    </span>
                  </Link>
                ))}
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
// Escritorio: el nombre en una franja de ancho completo, las fotos en una tira
// horizontal a sangre y, debajo, la compra en columnas (color · talle · botón).
// Celular: igual que en P1.1b (fotos, nombre, opciones, barra fija).
function DistritoGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [edge, setEdge] = useState<'start' | 'end' | 'mid' | 'none'>('start');
  const track = useRef<HTMLDivElement>(null);
  const few = images.length < 3;
  const update = (el: HTMLDivElement) => {
    if (el.scrollWidth <= el.clientWidth + 4) return setEdge('none');
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
    setEdge(el.scrollLeft < 8 ? 'start' : el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 ? 'end' : 'mid');
  };
  const move = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: 'smooth' });
  };
  if (images.length === 0) return <div className="di-gallery di-gallery--empty">Sin fotos</div>;
  return (
    <div className="di-gallery" data-few={few || undefined}>
      {images.length > 1 && (
        <div className="di-gallery__progress" aria-hidden="true">
          {images.map((src, i) => (
            <span key={src} data-on={i <= index || undefined} />
          ))}
        </div>
      )}
      <div ref={track} className="di-gallery__track" tabIndex={0} aria-label={`Fotos de ${name}`} onScroll={(e) => update(e.currentTarget)}>
        {images.map((src, i) => (
          <figure key={src} style={few ? ({ '--di-bg': `url("${transformedSrc(src, { width: 200 })}")` } as CSSProperties) : undefined}>
            <StoreImage src={src} alt={i === 0 ? name : `${name}, foto ${i + 1}`} transformWidth={1000} width={800} height={1000} loading={i < 3 ? 'eager' : 'lazy'} />
          </figure>
        ))}
      </div>
      {!few && edge !== 'none' && (
        <div className="di-gallery__nav di-only-desktop">
          <button type="button" aria-label="Fotos anteriores" disabled={edge === 'start'} onClick={() => move(-1)}>
            <ArrowLeft aria-hidden="true" />
          </button>
          <button type="button" aria-label="Más fotos" disabled={edge === 'end'} onClick={() => move(1)}>
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Color y talle de Distrito: los usan la ficha y cada unidad de un «Lleva N». */
function DistritoChoices({ colors, sizes, color, size, onColor, onSize, colorDisabled, sizeDisabled }: ChoicesProps) {
  if (colors.length === 0 && sizes.length === 0) return null;
  return (
    <div className="di-pdp__pick" data-cols={colors.length > 0 && sizes.length > 0 ? 2 : 1}>
      {colors.length > 0 && (
        <fieldset className="di-opt">
          <legend>
            Color <b>{color ?? '—'}</b>
          </legend>
          <div className="di-opt__row">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                className="di-chipbtn"
                aria-pressed={color === c}
                data-out={colorDisabled(c) || undefined}
                aria-label={`${c}${colorDisabled(c) ? ', sin stock' : ''}`}
                onClick={() => onColor(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {sizes.length > 0 && (
        <fieldset className="di-opt">
          <legend>
            Talle <b>{size ?? '—'}</b>
          </legend>
          <div className="di-opt__sizes">
            {sizes.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={size === s}
                disabled={sizeDisabled(s)}
                aria-label={`Talle ${s}${sizeDisabled(s) ? ', sin stock' : ''}`}
                onClick={() => onSize(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

function DistritoProductView({ product }: { product: Product }) {
  const config = useStore();
  const pdp = usePdp(product);
  const tier = useTplTiers(product, pdp);
  const notice = tierStockNotice(tier);
  const policies = usePolicies();
  const promo = useQtyPromoMessage(product, pdp.color);
  const cats = productCategories(product);
  const price = useTplPrice(product, { color: pdp.color, size: pdp.size });
  const tierCta = tier.tierValid ? `Agregar ${tier.tierUnits} al carrito` : notice ? 'Sin stock suficiente' : 'Elegí las variantes';
  const description = product.description?.trim() ?? '';
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
      <Seo title={`${product.name} · ${config.name}`} description={description || config.name} image={pdp.images[0]} slug={config.slug} siteName={config.name} path={`/producto/${product.id}`} />
      <header className="di-pdp__head">
        <div className="di-pdp__title">
          {cats[0] && (
            <Link to={categoryHref(cats[0])} className="di-meta di-pdp__cat">
              {cats[0]}
            </Link>
          )}
          <h1 className="di-pdp__name">{product.name}</h1>
        </div>
        <PriceView product={product} cls="di-price di-price--pdp" color={pdp.color} size={pdp.size} showInstallments />
      </header>
      <DistritoGallery images={pdp.images} name={product.name} />
      <div className="di-pdp__col">
        <div className="di-pdp__info">
          <div className="di-pdp__sticky">
            <div className="di-pdp__choose">
              <TierPicker tier={tier} prefix="di" />
              {!tier.perUnitOpen && (
                <DistritoChoices
                  colors={pdp.colors}
                  sizes={pdp.sizes}
                  color={pdp.color}
                  size={pdp.size}
                  onColor={pdp.setColor}
                  onSize={pdp.setSize}
                  colorDisabled={pdp.colorDisabled}
                  sizeDisabled={pdp.sizeDisabled}
                />
              )}
              <TierUnits tier={tier} pdp={pdp} prefix="di" Choices={DistritoChoices} />
            </div>
            <div className="di-pdp__act">
              {promo && <p className="di-pdp__promo">{promo}</p>}
              {notice && (
                <p className="di-pdp__notice" role="status">
                  {notice}
                </p>
              )}
              {!tier.perUnitOpen && pdp.lowStock != null && <p className="di-low">{pdp.lowStock === 1 ? 'Última unidad en este talle' : `Últimas ${pdp.lowStock} unidades en este talle`}</p>}
              <div className="di-buy">
                {price && (
                  <p className="di-buy__price di-only-mobile">
                    {formatPrice(price.big)}
                    {tier.inTierMode && (
                      <small>
                        Lleva {tier.tierUnits}
                        {tier.tierVariantLabel ? ` · ${tier.tierVariantLabel}` : ''}
                      </small>
                    )}
                  </p>
                )}
                {tier.inTierMode ? (
                  <button type="button" className="di-cta di-cta--block" onClick={tierBuyAction(tier, '.di-pdp')} disabled={!tier.tierValid && tier.tierIssue?.kind !== 'unit'}>
                    {tierCta}
                  </button>
                ) : (
                  <button type="button" className="di-cta di-cta--block" onClick={buyAction(pdp, '.di-pdp')} disabled={pdp.soldOut || (!pdp.canAdd && !pdp.missing)}>
                    {cta}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {(description || policies.length > 0) && (
          <div className="di-pdp__more">
            {description && (
              <details className="di-acc di-acc--lead" open>
                <summary>Detalle</summary>
                <p>{description}</p>
              </details>
            )}
            {policies.length > 0 && (
              <div className="di-pdp__policies">
                {policies.map((p) => (
                  <details key={p.key} className="di-acc">
                    <summary>{p.title}</summary>
                    <p>{p.body}</p>
                  </details>
                ))}
              </div>
            )}
          </div>
        )}
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
  const { rows, itemCount } = useCartView();
  return (
    <div className="di-cartpage">
      <h1 className="di-giant di-giant--page">Carrito [{itemCount}]</h1>
      {rows.length === 0 ? (
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
