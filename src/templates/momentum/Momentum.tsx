/**
 * MOMENTUM · indumentaria deportiva.
 *
 * Dirección de arte: blanco, tinta y el color de la marca del comercio para
 * comprar; rojo sólo para descuentos. Barlow Condensed en itálica para titulares
 * (ritmo deportivo), Barlow para leer. Pensada para convertir rápido: búsqueda
 * siempre visible, categorías con cantidad, solapas Más vendidos / Nuevos /
 * Ofertas, filtros por talle, talles con stock en cada tarjeta y beneficios
 * sólo si el comercio los tiene configurados. En celular: barra inferior de
 * navegación, filtros en hoja inferior y barra de compra fija.
 */
import { useCallback, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Home, LayoutGrid, Search, ShoppingBag, SlidersHorizontal, Tag, Truck, CreditCard, X } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { useProducts } from '@/hooks/useProducts';
import { useProduct } from '@/hooks/useProduct';
import { useHomeSections } from '@/hooks/useHomeSections';
import { useCategories } from '@/hooks/useCategories';
import { StoreImage } from '@/components/StoreImage';
import { Seo } from '@/components/Seo';
import { colorToHex, formatPrice, mainImage, productCategories } from '@/lib/utils';
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
  sameText,
  sizesInStock,
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
  sizeAvailability,
  useTplPrice,
  type CatalogView,
  type SortKey,
} from '../shared/commerce';
import { PriceView } from '../shared/Price';
import { MarqueeStrip, marqueeMessages } from '@/components/MarqueeStrip';
import { TemplateNewsletterPopup, TemplateTopBars, useStoreHomeExtras, type TemplateInk, type TemplateNatives } from '../shared/StoreContent';
import { StoreMark, unitsLabel, useCartView, useCloseOnRoute, useOverlay, type CartAmount } from '../shared/ui';
import './momentum.css';

const PAYMENT_LABELS: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  naranja: 'Naranja X',
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  gocuotas: 'GoCuotas',
};

/**
 * Beneficios REALES de la tienda: sólo lo que el comercio configuró (envío
 * gratis desde un monto y cuotas sin interés). La plantilla no calcula ni
 * promete nada por su cuenta. Se muestran una sola vez, en la franja superior.
 */
function useBenefits() {
  const c = useStore();
  return useMemo(() => {
    const list: { key: string; icon: ReactNode; title: string; text: string }[] = [];
    if (c.freeShippingFrom > 0)
      list.push({ key: 'envio', icon: <Truck />, title: 'Envío gratis', text: `desde ${formatPrice(c.freeShippingFrom)}` });
    if (c.installmentsCount >= 2)
      list.push({ key: 'cuotas', icon: <CreditCard />, title: `${c.installmentsCount} cuotas sin interés`, text: 'con tarjeta de crédito' });
    return list;
  }, [c.freeShippingFrom, c.installmentsCount]);
}

// ── Búsqueda (siempre visible) ────────────────────────────────────────────────
function SearchField({ id }: { id: string }) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [q, setQ] = useState(() => new URLSearchParams(search).get('q') ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = q.trim();
    navigate(t ? `/productos?q=${encodeURIComponent(t)}` : '/productos');
  };
  return (
    <form className="mo-search" role="search" onSubmit={submit}>
      <Search aria-hidden="true" />
      <label htmlFor={id} className="tpl-sr">
        Buscar productos
      </label>
      <input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar productos" autoComplete="off" enterKeyHint="search" />
      {q && (
        <button type="button" onClick={() => setQ('')} aria-label="Borrar la búsqueda">
          <X />
        </button>
      )}
    </form>
  );
}

// ── Encabezado ────────────────────────────────────────────────────────────────
function MomentumHeader() {
  const { itemCount, open } = useCartView();
  const { products } = useProducts();
  const { categories } = useCategories(products);
  const contact = useContact();
  const wa = contact.find((c) => c.label === 'WhatsApp');
  // Los anuncios del comercio (los de la barra de Classic) van en la barra de
  // arriba de Momentum, en lugar de los beneficios calculados: son el texto que
  // la tienda eligió publicar.
  const { announcement } = useStore();
  const messages = marqueeMessages(announcement);
  const util = useBenefits().map((b) => `${b.title} ${b.text}`);
  return (
    <header className="mo-header">
      {(messages.length > 0 || util.length > 0 || wa) && (
        <div className={messages.length > 0 ? 'mo-util mo-util--marquee' : 'mo-util'}>
          {messages.length > 0 ? <MarqueeStrip messages={messages} /> : <p>{util.join('  ·  ')}</p>}
          {wa && (
            <a href={wa.href} target="_blank" rel="noreferrer" className="mo-only-desktop">
              Consultas por WhatsApp
            </a>
          )}
        </div>
      )}
      <div className="mo-header__main">
        <Link to="/" className="mo-header__brand" aria-label="Inicio">
          <StoreMark className="mo-header__logo" />
        </Link>
        <div className="mo-only-desktop mo-header__search">
          <SearchField id="mo-q-desk" />
        </div>
        <button type="button" className="mo-header__cart" onClick={open} aria-label={`Carrito, ${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}`}>
          <ShoppingBag aria-hidden="true" />
          <span className="mo-only-desktop">Carrito</span>
          {itemCount > 0 && <span className="mo-badge">{itemCount}</span>}
        </button>
      </div>
      <nav className="mo-nav mo-only-desktop" aria-label="Categorías">
        <NavLink to="/productos" end>
          Todo
        </NavLink>
        {categories.slice(0, 8).map((c) => (
          <NavLink key={c.name} to={categoryHref(c.name)}>
            {c.name}
          </NavLink>
        ))}
      </nav>
      <div className="mo-only-mobile mo-header__msearch">
        <SearchField id="mo-q-mob" />
      </div>
    </header>
  );
}

/** Celular: navegación al alcance del pulgar. */
function TabBar({ onCategories }: { onCategories: () => void }) {
  const { itemCount, open } = useCartView();
  const { pathname } = useLocation();
  return (
    <nav className="mo-tabs" aria-label="Navegación">
      <Link to="/" aria-current={pathname === '/' ? 'page' : undefined}>
        <Home aria-hidden="true" />
        Inicio
      </Link>
      <button type="button" onClick={onCategories}>
        <LayoutGrid aria-hidden="true" />
        Categorías
      </button>
      <button
        type="button"
        onClick={() => {
          const el = document.getElementById('mo-q-mob');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          el?.focus();
        }}
      >
        <Search aria-hidden="true" />
        Buscar
      </button>
      <button type="button" onClick={open}>
        <span className="mo-tabs__icon">
          <ShoppingBag aria-hidden="true" />
          {itemCount > 0 && <span className="mo-badge">{itemCount}</span>}
        </span>
        Carrito
      </button>
    </nav>
  );
}

function Sheet({ open, close, title, children }: { open: boolean; close: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(open, close, ref);
  if (!open) return null;
  return (
    <div className="mo-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="mo-scrim" aria-label="Cerrar" tabIndex={-1} onClick={close} />
      <div className="mo-sheet__panel" ref={ref}>
        <div className="mo-sheet__head">
          <p>{title}</p>
          <button type="button" onClick={close} aria-label="Cerrar">
            <X />
          </button>
        </div>
        <div className="mo-sheet__body">{children}</div>
      </div>
    </div>
  );
}

function CategoriesSheet({ open, close }: { open: boolean; close: () => void }) {
  const { products } = useProducts();
  const { categories } = useCategories(products);
  const links = useMenuLinks();
  return (
    <Sheet open={open} close={close} title="Categorías">
      <ul className="mo-catlist">
        <li>
          <Link to="/productos" onClick={close}>
            Todos los productos <span>{products.length}</span>
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.name}>
            <Link to={categoryHref(c.name)} onClick={close}>
              {c.name} <span>{c.count}</span>
            </Link>
          </li>
        ))}
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
    </Sheet>
  );
}

function MomentumFooter() {
  const config = useStore();
  const links = useMenuLinks();
  const contact = useContact();
  const policies = usePolicies();
  const { products } = useProducts();
  const { categories } = useCategories(products);
  const payments = config.paymentMethods.map((m) => PAYMENT_LABELS[m] ?? m.charAt(0).toUpperCase() + m.slice(1));
  return (
    <footer className="mo-footer">
      <div className="mo-footer__grid">
        <div>
          <StoreMark className="mo-footer__logo" />
          {config.tagline && !sameText(config.tagline, config.name) && <p>{config.tagline}</p>}
        </div>
        {categories.length > 0 && (
          <nav aria-label="Categorías">
            <p className="mo-footer__title">Categorías</p>
            {categories.slice(0, 8).map((c) => (
              <Link key={c.name} to={categoryHref(c.name)}>
                {c.name}
              </Link>
            ))}
          </nav>
        )}
        <div>
          <p className="mo-footer__title">Ayuda</p>
          {policies.map((p) => (
            <details key={p.key} className="mo-footer__acc">
              <summary>{p.title}</summary>
              <p>{p.body}</p>
            </details>
          ))}
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
        </div>
        {contact.length > 0 && (
          <div>
            <p className="mo-footer__title">Contacto</p>
            {contact.map((c) => (
              <a key={c.href} href={c.href} target="_blank" rel="noreferrer">
                {c.label}
              </a>
            ))}
          </div>
        )}
      </div>
      {payments.length > 0 && (
        <p className="mo-footer__pay">
          <span>Medios de pago:</span> {payments.join(' · ')}
        </p>
      )}
      <p className="mo-footer__legal">
        © {new Date().getFullYear()} {config.name}
      </p>
    </footer>
  );
}

// ── Carrito ───────────────────────────────────────────────────────────────────
function ShipProgress() {
  const { freeShippingLeft, freeShippingPct: pct } = useCartView();
  if (freeShippingLeft == null) return null;
  return (
    <div className="mo-ship">
      <p>
        <Truck aria-hidden="true" />
        {freeShippingLeft > 0 ? (
          <>
            Te faltan <b>{formatPrice(freeShippingLeft)}</b> para el envío gratis
          </>
        ) : (
          <b>Tenés envío gratis</b>
        )}
      </p>
      <div className="mo-ship__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance hacia el envío gratis">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CartLines() {
  const { rows } = useCartView();
  return (
    <ul className="mo-lines">
      {rows.map((row) => (
        <li key={row.key} className="mo-line" data-group={row.group ?? undefined}>
          <Link to={`/producto/${row.productId}`} className="mo-line__img" tabIndex={-1} aria-hidden="true">
            {row.image && <StoreImage src={row.image} alt="" transformWidth={200} width={120} height={120} />}
          </Link>
          <div className="mo-line__info">
            <div className="mo-line__top">
              <Link to={`/producto/${row.productId}`} className="mo-line__name">
                {row.name}
              </Link>
              <button type="button" className="mo-line__x" onClick={row.remove} aria-label={`Quitar ${row.name}${row.group ? ' (todo el grupo)' : ''}`}>
                <X />
              </button>
            </div>
            {row.item ? (
              <p className="mo-line__meta">{[row.item.color, row.item.size && `Talle ${row.item.size}`].filter(Boolean).join(' · ')}</p>
            ) : (
              row.detail && <p className="mo-line__group">{row.detail}</p>
            )}
            <div className="mo-line__row">
              {row.qty ? (
                <div className="mo-qty">
                  <button type="button" onClick={row.qty.dec} aria-label={`Quitar una unidad de ${row.name}`}>
                    −
                  </button>
                  <span aria-live="polite">{row.units}</span>
                  <button type="button" onClick={row.qty.inc} aria-label={`Sumar una unidad de ${row.name}`}>
                    +
                  </button>
                </div>
              ) : (
                <span className="mo-qty mo-qty--fixed">{unitsLabel(row.units)}</span>
              )}
              <p className="mo-line__price">
                {row.price.strike != null && <s>{formatPrice(row.price.strike)}</s>}
                {formatPrice(row.price.big)}
                {row.price.small != null && (
                  <small>
                    {formatPrice(row.price.small)} {row.price.smallLabel}
                  </small>
                )}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CartSummary() {
  const { subtotal, couponCode } = useCartView();
  return (
    <div className="mo-summary">
      <SubtotalLines subtotal={subtotal} couponCode={couponCode} />
      <p className="mo-summary__note">El envío y los descuentos por medio de pago se calculan en el siguiente paso.</p>
      <Link to="/checkout" className="mo-btn mo-btn--block">
        Iniciar compra
      </Link>
    </div>
  );
}

/** Subtotal del resumen y del carrito lateral (con el cupón tachando el de antes). */
function SubtotalLines({ subtotal, couponCode }: { subtotal: CartAmount; couponCode: string | null }) {
  return (
    <>
      <p className="mo-summary__row">
        <span>Subtotal</span>
        <b>
          {subtotal.strike != null && (
            <s>
              <span className="tpl-sr">Antes </span>
              {formatPrice(subtotal.strike)}
            </s>
          )}
          {formatPrice(subtotal.big)}
        </b>
      </p>
      {subtotal.small != null && (
        <p className="mo-summary__small">
          {formatPrice(subtotal.small)} {subtotal.smallLabel}
        </p>
      )}
      {couponCode && <p className="mo-summary__small">Con el cupón {couponCode}</p>}
    </>
  );
}

function MomentumCart() {
  const { isOpen, close, rows, itemCount, subtotal, couponCode } = useCartView();
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(isOpen, close, ref);
  useCloseOnRoute(close);
  if (!isOpen) return null;
  return (
    <div className="mo-drawer" role="dialog" aria-modal="true" aria-label="Carrito">
      <button type="button" className="mo-scrim" aria-label="Cerrar el carrito" tabIndex={-1} onClick={close} />
      <div className="mo-drawer__panel" ref={ref}>
        <span className="mo-drawer__grip" aria-hidden="true" />
        <div className="mo-drawer__head">
          <p>
            Tu carrito <span>({itemCount})</span>
          </p>
          <button type="button" onClick={close} aria-label="Cerrar el carrito">
            <X />
          </button>
        </div>
        {rows.length === 0 ? (
          <div className="mo-empty">
            <ShoppingBag aria-hidden="true" />
            <p>Todavía no agregaste productos.</p>
            <Link to="/productos" className="mo-btn" onClick={close}>
              Ver productos
            </Link>
          </div>
        ) : (
          <>
            <div className="mo-drawer__top">
              <SubtotalLines subtotal={subtotal} couponCode={couponCode} />
              <ShipProgress />
              <Link to="/checkout" className="mo-btn mo-btn--block">
                Iniciar compra
              </Link>
              <p className="mo-summary__note">El envío y los descuentos por medio de pago se calculan en el siguiente paso.</p>
            </div>
            <div className="mo-drawer__lines">
              <p className="mo-drawer__label">Productos</p>
              <CartLines />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Color de marca: el primario o el acento del comercio si tienen tono y se leen sobre blanco; si no, el azul propio. */
function momentumBrand(primary: string, accent: string): string {
  const pick = (c: string) => (isNeutralColor(c) ? null : brandOr(c, '#ffffff', ''));
  return pick(primary) || pick(accent) || '#1546d6';
}

/**
 * Paleta de Momentum para el contenido del comercio (secciones personalizadas,
 * reseñas, newsletter): blanco, tinta y la marca como acento; Barlow; esquinas
 * suaves como las de la plantilla.
 */
function useMomentumInk(): TemplateInk {
  const { colorPrimary, colorAccent } = useStore();
  const accent = momentumBrand(colorPrimary, colorAccent);
  return useMemo(
    () => ({
      background: '#ffffff',
      text: '#12151a',
      primary: '#f2f3f5',
      accent,
      secondary: '#f2f3f5',
      headingFamily: 'Barlow',
      bodyFamily: 'Barlow',
      headingStack: "'Barlow', system-ui, sans-serif",
      bodyStack: "'Barlow', system-ui, sans-serif",
      corners: 'rounded',
      buttonCorners: 'rounded',
      titleAlign: 'left',
    }),
    [accent],
  );
}

function MomentumShell({ children }: { children: ReactNode }) {
  const config = useStore();
  const [cats, setCats] = useState(false);
  const closeCats = useCallback(() => setCats(false), []);
  useCloseOnRoute(closeCats);
  // T3: en el checkout (el de Classic) la barra de pestañas taparía su barra fija
  // de «Confirmar pedido» en el celular, y además distrae al pagar: no se muestra.
  const inCheckout = useLocation().pathname === '/checkout';
  const brand = momentumBrand(config.colorPrimary, config.colorAccent);
  const ink = useMomentumInk();
  return (
    <div className="tpl-momentum" data-checkout={inCheckout || undefined} style={{ '--mo-brand': brand } as CSSProperties}>
      <a href="#mo-main" className="mo-skip">
        Ir al contenido
      </a>
      <TemplateTopBars ink={ink} announcement={false} />
      <MomentumHeader />
      <main id="mo-main" className="mo-main">
        {children}
      </main>
      <MomentumFooter />
      {!inCheckout && <TabBar onCategories={() => setCats(true)} />}
      <CategoriesSheet open={cats} close={closeCats} />
      <MomentumCart />
      <TemplateNewsletterPopup ink={ink} />
    </div>
  );
}

// ── Tarjeta ───────────────────────────────────────────────────────────────────
function MomentumCard({ product, priority }: { product: Product; priority?: boolean }) {
  const img = mainImage(product);
  const soldOut = isSoldOut(product);
  const sizes = soldOut ? [] : sizesInStock(product);
  const price = useTplPrice(product, { color: product.variant_color });
  return (
    <article className="mo-card">
      <Link to={cardHref(product)} className="mo-card__link">
        <div className="mo-card__media">
          {img ? (
            <StoreImage src={img} alt={product.name} transformWidth={500} width={500} height={500} loading={priority ? 'eager' : 'lazy'} />
          ) : (
            <span className="mo-card__noimg">Sin foto</span>
          )}
          {price && price.offPct > 0 && <span className="mo-card__off">−{price.offPct}%</span>}
          {soldOut && <span className="mo-card__out">Sin stock</span>}
        </div>
        <div className="mo-card__body">
          <h3 className="mo-card__name">{product.name}</h3>
          <PriceView product={product} cls="mo-price" color={product.variant_color} />
        </div>
      </Link>
      {sizes.length > 0 && (
        <p className="mo-card__sizes" aria-label={`Talles disponibles: ${sizes.join(', ')}`}>
          {sizes.slice(0, 6).map((s) => (
            <span key={s}>{s}</span>
          ))}
          {sizes.length > 6 && <span>+{sizes.length - 6}</span>}
        </p>
      )}
    </article>
  );
}

function GridSkeleton({ n = 8 }: { n?: number }) {
  return (
    <div className="mo-grid" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i}>
          <div className="mo-skel mo-skel--img" />
          <div className="mo-skel mo-skel--line" />
          <div className="mo-skel mo-skel--line mo-skel--short" />
        </div>
      ))}
    </div>
  );
}

// ── Home ──────────────────────────────────────────────────────────────────────
type TabKey = 'featured' | 'new' | 'offers';

/**
 * Bloques propios del home de Momentum, en el orden en que los pinta. Las
 * pestañas cubren Destacados, Nuevos y Ofertas (ver useStoreHomeExtras). Con
 * portada de banner las categorías van dentro de la portada.
 */
const MOMENTUM_NATIVES: TemplateNatives = [['hero'], ['categories'], ['featured', 'new_arrivals', 'offers']];

function MomentumHome() {
  const config = useStore();
  const { products, isLoading } = useProducts();
  const { featured, newArrivals, offers } = useHomeSections(products);
  const { categories } = useCategories(products);
  useFirstPaintGate('tpl-home', isLoading);
  const store = useStoreHomeExtras(MOMENTUM_NATIVES, useMomentumInk());
  const hero = useHero();
  const bannerMode = Boolean(hero.image && !hero.hasText);
  const titles: Record<TabKey, string> = {
    featured: useHeading('featured', 'Más vendidos'),
    new: useHeading('new_arrivals', 'Nuevos'),
    offers: useHeading('offers', 'Ofertas'),
  };
  const lists: Record<TabKey, Product[]> = { featured, new: newArrivals, offers };
  const tabOn: Record<TabKey, boolean> = { featured: store.on('featured'), new: store.on('new_arrivals'), offers: store.on('offers') };
  const tabs = (['featured', 'new', 'offers'] as TabKey[]).filter((k) => tabOn[k] && lists[k].length > 0);
  const [tab, setTab] = useState<TabKey>('featured');
  const active = tabs.includes(tab) ? tab : tabs[0];
  const fallback = newArrivals.find((p) => mainImage(p));
  const heroImg = hero.image ?? (fallback ? mainImage(fallback) : null);
  const cta = hero.ctaText || 'Ver productos';
  const ctaEl = hero.ctaExternal ? (
    <a href={hero.ctaLink} className="mo-btn" target="_blank" rel="noreferrer">
      {cta}
    </a>
  ) : (
    <Link to={hero.ctaLink} className="mo-btn">
      {cta}
    </Link>
  );

  return (
    <>
      <Seo title={config.metaTitle || config.name} description={config.metaDescription || config.tagline || config.name} image={config.ogImageUrl} slug={config.slug} siteName={config.name} path="/" />
      {store.slot(0)}
      {bannerMode ? (
        <section className="mo-stage" aria-label="Portada">
          <h1 className="tpl-sr">{config.name}</h1>
          {categories.length > 0 && (
            <nav className="mo-quick" aria-label="Categorías">
              {categories.slice(0, 10).map((c) => {
                const img = categoryImage(c, products);
                return (
                  <Link key={c.name} to={categoryHref(c.name)}>
                    <span className="mo-quick__img">{img && <StoreImage src={img} alt="" transformWidth={160} width={64} height={64} />}</span>
                    {c.name}
                  </Link>
                );
              })}
            </nav>
          )}
          <div className="mo-stage__grid">
            <div className="mo-banner">
              <Link to={hero.ctaExternal ? '/productos' : hero.ctaLink} aria-label={hero.ctaText || 'Ver productos'}>
                <picture>
                  {hero.mobile && <source media="(max-width: 899px)" srcSet={hero.mobile} />}
                  <img src={hero.image ?? ''} alt="" fetchPriority="high" />
                </picture>
              </Link>
            </div>
            {categories.length > 0 && (
              <div className="mo-stage__side">
                <p className="mo-stage__title">Comprá por categoría</p>
                {categories.slice(0, 4).map((c) => {
                  const img = categoryImage(c, products);
                  return (
                    <Link key={c.name} to={categoryHref(c.name)} className="mo-tile">
                      <span className="mo-tile__img">{img && <StoreImage src={img} alt="" transformWidth={240} width={120} height={120} />}</span>
                      <span className="mo-tile__text">
                        <b>{c.name}</b>
                        <span>{c.count} productos</span>
                      </span>
                      <ChevronRight aria-hidden="true" />
                    </Link>
                  );
                })}
                <Link to="/productos" className="mo-more">
                  Ver todos los productos <ChevronRight aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="mo-hero" aria-labelledby="mo-hero-title">
          <div className="mo-hero__text">
            <h1 id="mo-hero-title" className="mo-display">
              {hero.title}
            </h1>
            {hero.subtitle && <p>{hero.subtitle}</p>}
            {ctaEl}
          </div>
          {heroImg && (
            <picture className="mo-hero__img">
              {hero.mobile && <source media="(max-width: 899px)" srcSet={hero.mobile} />}
              <img src={heroImg} alt="" fetchPriority="high" />
            </picture>
          )}
        </section>
      )}
      {store.slot(1)}

      {!bannerMode && store.on('categories') && categories.length > 0 && (
        <section className="mo-section" aria-labelledby="mo-cats">
          <div className="mo-head">
            <h2 id="mo-cats" className="mo-title">
              Comprá por categoría
            </h2>
            <Link to="/productos" className="mo-more">
              Ver todo <ChevronRight aria-hidden="true" />
            </Link>
          </div>
          <div className="mo-cats">
            {categories.slice(0, 8).map((c) => {
              const img = categoryImage(c, products);
              return (
                <Link key={c.name} to={categoryHref(c.name)} className="mo-cat">
                  <span className="mo-cat__img">{img && <StoreImage src={img} alt="" transformWidth={400} width={300} height={300} />}</span>
                  <span className="mo-cat__name">{c.name}</span>
                  <span className="mo-cat__count">{c.count} productos</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
      {!isLoading && store.slot(2)}

      <section className="mo-section" aria-label="Productos">
        {isLoading ? (
          <GridSkeleton />
        ) : (
          tabs.length > 0 &&
          active && (
            <>
              <div className="mo-head mo-head--tabs">
                <div className="mo-segment" role="tablist" aria-label="Productos">
                  {tabs.map((k) => (
                    <button key={k} type="button" role="tab" id={`mo-tab-${k}`} aria-selected={active === k} aria-controls="mo-tabpanel" onClick={() => setTab(k)} data-sale={k === 'offers' || undefined}>
                      {titles[k]}
                    </button>
                  ))}
                </div>
                <Link to={active === 'new' ? '/productos?orden=nuevos' : '/productos'} className="mo-more mo-only-desktop">
                  Ver todo <ChevronRight aria-hidden="true" />
                </Link>
              </div>
              <div id="mo-tabpanel" role="tabpanel" aria-labelledby={`mo-tab-${active}`} className="mo-grid">
                {lists[active].slice(0, 8).map((p, i) => (
                  <MomentumCard key={p.card_key ?? p.id} product={p} priority={i < 4} />
                ))}
              </div>
              <Link to="/productos" className="mo-btn mo-btn--ghost mo-btn--center">
                Ver todos los productos
              </Link>
            </>
          )
        )}
      </section>
      {!isLoading && store.slot(3)}
    </>
  );
}

// ── Catálogo ──────────────────────────────────────────────────────────────────
function Filters({ view, onPick }: { view: CatalogView; onPick?: () => void }) {
  return (
    <>
      <div className="mo-filter">
        <p className="mo-filter__title">Categoría</p>
        <ul>
          <li>
            <NavLink to="/productos" end onClick={onPick}>
              Todos <span>{view.all.length}</span>
            </NavLink>
          </li>
          {view.categories.map((c) => (
            <li key={c.name}>
              <NavLink to={categoryHref(c.name)} onClick={onPick}>
                {c.name} <span>{c.count}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
      {view.sizes.length > 1 && (
        <div className="mo-filter">
          <p className="mo-filter__title">Talle</p>
          <div className="mo-filter__sizes" role="group" aria-label="Talle">
            {view.sizes.map((s) => (
              <button key={s} type="button" aria-pressed={view.size === s} onClick={() => view.setSize(view.size === s ? null : s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function MomentumCatalog() {
  const config = useStore();
  const view = useCatalog();
  const [sheet, setSheet] = useState(false);
  const closeSheet = useCallback(() => setSheet(false), []);
  useFirstPaintGate('tpl-catalog', view.isLoading);
  const title = view.category ?? (view.query ? `Resultados para “${view.query}”` : 'Todos los productos');
  return (
    <div className="mo-catalog">
      <Seo title={`${view.category ?? 'Productos'} · ${config.name}`} description={config.metaDescription || config.name} slug={config.slug} siteName={config.name} path={view.category ? categoryHref(view.category) : '/productos'} />
      <nav className="mo-crumbs" aria-label="Ubicación">
        <Link to="/">Inicio</Link>
        <ChevronRight aria-hidden="true" />
        <Link to="/productos">Productos</Link>
        {view.category && (
          <>
            <ChevronRight aria-hidden="true" />
            <span aria-current="page">{view.category}</span>
          </>
        )}
      </nav>
      <div className="mo-catalog__layout">
        <aside className="mo-catalog__side mo-only-desktop" aria-label="Filtros">
          <Filters view={view} />
        </aside>
        <div>
          <div className="mo-catalog__top">
            <div>
              <h1 className="mo-display mo-display--page">{title}</h1>
              <nav className="mo-pills mo-only-mobile" aria-label="Categorías">
                <NavLink to="/productos" end>
                  Todos <span>{view.all.length}</span>
                </NavLink>
                {view.categories.map((c) => (
                  <NavLink key={c.name} to={categoryHref(c.name)}>
                    {c.name} <span>{c.count}</span>
                  </NavLink>
                ))}
              </nav>
              <p className="mo-catalog__count">{view.isLoading ? ' ' : `${view.count} ${view.count === 1 ? "producto" : "productos"}`}</p>
            </div>
            <label className="mo-sort mo-only-desktop">
              Ordenar por
              <select value={view.sort} onChange={(e) => view.setSort(e.target.value as SortKey)}>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SORT_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mo-mbar mo-only-mobile">
            <button type="button" onClick={() => setSheet(true)}>
              <SlidersHorizontal aria-hidden="true" /> Filtrar{view.size ? ' (1)' : ''}
            </button>
            <label>
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
          {view.size && (
            <p className="mo-active">
              <button type="button" onClick={() => view.setSize(null)}>
                Talle {view.size} <X aria-hidden="true" />
                <span className="tpl-sr">Quitar el filtro</span>
              </button>
            </p>
          )}
          {view.isLoading ? (
            <GridSkeleton n={9} />
          ) : view.products.length === 0 ? (
            <div className="mo-empty">
              <Search aria-hidden="true" />
              <p>No encontramos productos{view.query ? ` para “${view.query}”` : view.size ? ` en talle ${view.size}` : ''}.</p>
              <Link to="/productos" className="mo-btn">
                Ver todos los productos
              </Link>
            </div>
          ) : (
            <div className="mo-grid mo-grid--catalog">
              {view.products.map((p, i) => (
                <MomentumCard key={p.card_key ?? p.id} product={p} priority={i < 3} />
              ))}
            </div>
          )}
        </div>
      </div>
      <Sheet open={sheet} close={closeSheet} title="Filtrar">
        <Filters view={view} onPick={closeSheet} />
        <button type="button" className="mo-btn mo-btn--block" onClick={closeSheet}>
          Ver {view.count} productos
        </button>
      </Sheet>
    </div>
  );
}

// ── Ficha ─────────────────────────────────────────────────────────────────────
// Escritorio: fotos en grilla de dos columnas (sin miniaturas) y un recuadro de
// compra fijo a la derecha: precio, promo, disponibilidad real por talle y
// botón. Los detalles van debajo, a todo el ancho. Celular: igual que en P1.1b.
const GALLERY_FIRST = 6;

function MomentumGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [all, setAll] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  if (images.length === 0) return <div className="mo-gallery mo-gallery--empty">Sin fotos</div>;
  const hidden = all ? 0 : Math.max(0, images.length - GALLERY_FIRST);
  return (
    <div className="mo-gallery" data-n={images.length > 2 ? 'many' : images.length}>
      <div className="mo-gallery__main">
        <div
          ref={track}
          className="mo-gallery__track"
          tabIndex={0}
          aria-label={`Fotos de ${name}`}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollWidth > el.clientWidth + 4) setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {images.map((src, i) => (
            <figure key={src} data-more={(!all && i >= GALLERY_FIRST) || undefined}>
              <StoreImage src={src} alt={i === 0 ? name : `${name}, foto ${i + 1}`} transformWidth={1000} width={900} height={900} loading={i < 2 ? 'eager' : 'lazy'} />
            </figure>
          ))}
        </div>
        {images.length > 1 && (
          <div className="mo-gallery__dots mo-only-mobile" aria-hidden="true">
            {images.map((src, i) => (
              <span key={src} data-on={i === index || undefined} />
            ))}
          </div>
        )}
      </div>
      {hidden > 0 && (
        <button type="button" className="mo-gallery__all mo-only-desktop" onClick={() => setAll(true)}>
          Ver {hidden} {hidden === 1 ? 'foto más' : 'fotos más'}
        </button>
      )}
    </div>
  );
}

/** Color y talle de Momentum: los usan la ficha y cada unidad de un «Lleva N». */
function MomentumChoices({ colors, sizes, color, size, onColor, onSize, colorDisabled, sizeDisabled }: ChoicesProps) {
  return (
    <>
      {colors.length > 0 && (
        <fieldset className="mo-opt">
          <legend>
            Color: <b>{color ?? 'elegí uno'}</b>
          </legend>
          <div className="mo-opt__colors">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={color === c}
                data-out={colorDisabled(c) || undefined}
                aria-label={`${c}${colorDisabled(c) ? ', sin stock' : ''}`}
                title={c}
                onClick={() => onColor(c)}
              >
                <span style={{ backgroundColor: colorToHex(c) }} />
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {sizes.length > 0 && (
        <fieldset className="mo-opt">
          <legend>
            Talle: <b>{size ?? 'elegí uno'}</b>
          </legend>
          <div className="mo-opt__sizes">
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
    </>
  );
}

function MomentumProductView({ product }: { product: Product }) {
  const config = useStore();
  const pdp = usePdp(product);
  const tier = useTplTiers(product, pdp);
  const notice = tierStockNotice(tier);
  const policies = usePolicies();
  const promo = useQtyPromoMessage(product, pdp.color);
  const cats = productCategories(product);
  const price = useTplPrice(product, { color: pdp.color, size: pdp.size });
  const benefits = useBenefits().filter((b) => b.key === 'envio');
  const [inStock, total] = sizeAvailability(pdp);
  const description = product.description?.trim() ?? '';
  // Disponibilidad con los datos reales de stock (nunca un número inventado).
  // Agotado: lo dice el botón, sin repetirlo acá.
  // Con filas por unidad cada unidad tiene su variante: la línea de disponibilidad
  // del selector único no aplica (el aviso del escalón explica si falta stock).
  const stock: { state: 'ok' | 'low' | 'out'; text: string } | null = pdp.soldOut || tier.perUnitOpen
    ? null
    : pdp.lowStock != null
      ? { state: 'low', text: pdp.lowStock === 1 ? 'Queda 1 unidad en este talle' : `Quedan ${pdp.lowStock} unidades en este talle` }
      : pdp.variant
        ? (pdp.variant.stock ?? 0) > 0
          ? { state: 'ok', text: 'En stock' }
          : { state: 'out', text: 'Sin stock en esta combinación' }
        : total > 1
          ? { state: inStock > 0 ? 'ok' : 'out', text: `Disponible en ${inStock} de ${total} talles${pdp.color && pdp.colors.length > 1 ? ` en ${pdp.color}` : ''}` }
          : null;
  const tierCta = tier.tierValid ? `Agregar ${tier.tierUnits} al carrito` : notice ? 'Sin stock suficiente' : 'Elegí las variantes';
  const cta = pdp.soldOut
    ? 'Sin stock'
    : pdp.canAdd
      ? 'Agregar al carrito'
      : pdp.missing === 'ambos'
        ? 'Elegí color y talle'
        : pdp.missing === 'color'
          ? 'Elegí un color'
          : pdp.missing === 'talle'
            ? 'Elegí tu talle'
            : 'Sin stock';
  return (
    <div className="mo-pdp">
      <Seo title={`${product.name} · ${config.name}`} description={description || config.name} image={pdp.images[0]} slug={config.slug} siteName={config.name} path={`/producto/${product.id}`} />
      <nav className="mo-crumbs" aria-label="Ubicación">
        <Link to="/">Inicio</Link>
        <ChevronRight aria-hidden="true" />
        {cats[0] ? <Link to={categoryHref(cats[0])}>{cats[0]}</Link> : <Link to="/productos">Productos</Link>}
      </nav>
      <div className="mo-pdp__grid">
        <MomentumGallery images={pdp.images} name={product.name} />
        <div className="mo-pdp__info">
          <div className="mo-buybox">
            <h1 className="mo-pdp__name">{product.name}</h1>
            <div className="mo-pdp__price">
              {price && price.offPct > 0 && <span className="mo-pdp__off">−{price.offPct}%</span>}
              <PriceView product={product} cls="mo-price mo-price--pdp" color={pdp.color} size={pdp.size} showInstallments />
            </div>
            {promo && (
              <p className="mo-pdp__promo">
                <Tag aria-hidden="true" />
                {promo}
              </p>
            )}

            <TierPicker tier={tier} prefix="mo" />
            {!tier.perUnitOpen && (
              <MomentumChoices
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
            <TierUnits tier={tier} pdp={pdp} prefix="mo" Choices={MomentumChoices} />
            {notice && (
              <p className="mo-stock" data-state="out" role="status">
                <span aria-hidden="true" />
                {notice}
              </p>
            )}
            {stock && (
              <p className="mo-stock" data-state={stock.state} role="status">
                <span aria-hidden="true" />
                {stock.text}
              </p>
            )}

            <div className="mo-buy">
              {price && (
                <p className="mo-buy__price mo-only-mobile">
                  {formatPrice(price.big)}
                  {tier.inTierMode ? (
                    <small>
                      Lleva {tier.tierUnits}
                      {tier.tierVariantLabel ? ` · ${tier.tierVariantLabel}` : ''}
                    </small>
                  ) : (
                    price.bigLabel && <small>{price.bigLabel}</small>
                  )}
                </p>
              )}
              {tier.inTierMode ? (
                <button type="button" className="mo-btn mo-btn--block mo-btn--big" onClick={tierBuyAction(tier, '.mo-pdp')} disabled={!tier.tierValid && tier.tierIssue?.kind !== 'unit'}>
                  <ShoppingBag aria-hidden="true" />
                  {tierCta}
                </button>
              ) : (
                <button type="button" className="mo-btn mo-btn--block mo-btn--big" onClick={buyAction(pdp, '.mo-pdp')} disabled={pdp.soldOut || (!pdp.canAdd && !pdp.missing)}>
                  <ShoppingBag aria-hidden="true" />
                  {cta}
                </button>
              )}
            </div>

            {benefits.length > 0 && (
              <ul className="mo-pdp__benefits">
                {benefits.map((b) => (
                  <li key={b.title}>
                    {b.icon}
                    <span>
                      <b>{b.title}</b> {b.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {(description || policies.length > 0) && (
        <section className="mo-pdp__details" aria-label="Detalles del producto">
          <div className="mo-pdp__acc">
            {description && (
              <details open className="mo-pdp__desc">
                <summary>Descripción</summary>
                <p>{description}</p>
              </details>
            )}
            {policies.length > 0 && (
              <div className="mo-pdp__policies">
                {policies.map((p) => (
                  <details key={p.key}>
                    <summary>{p.title}</summary>
                    <p>{p.body}</p>
                  </details>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function MomentumProduct() {
  const { id } = useParams<{ id: string }>();
  const { product, isLoading } = useProduct(id);
  useFirstPaintGate('tpl-product', isLoading);
  if (isLoading)
    return (
      <div className="mo-pdp" aria-busy="true">
        <div className="mo-pdp__grid">
          <div className="mo-skel mo-skel--img" />
          <div>
            <div className="mo-skel mo-skel--line" />
            <div className="mo-skel mo-skel--line mo-skel--short" />
          </div>
        </div>
      </div>
    );
  if (!product)
    return (
      <div className="mo-empty mo-empty--page">
        <Search aria-hidden="true" />
        <p>Este producto ya no está disponible.</p>
        <Link to="/productos" className="mo-btn">
          Ver productos
        </Link>
      </div>
    );
  return <MomentumProductView product={product} />;
}

function MomentumCartPage() {
  const { rows, itemCount } = useCartView();
  return (
    <div className="mo-cartpage">
      <h1 className="mo-display mo-display--page">
        Tu carrito <span>({itemCount})</span>
      </h1>
      {rows.length === 0 ? (
        <div className="mo-empty mo-empty--page">
          <ShoppingBag aria-hidden="true" />
          <p>Todavía no agregaste productos.</p>
          <Link to="/productos" className="mo-btn">
            Ver productos
          </Link>
        </div>
      ) : (
        <div className="mo-cartpage__grid">
          <div>
            <ShipProgress />
            <CartLines />
          </div>
          <CartSummary />
        </div>
      )}
    </div>
  );
}

function MomentumNotice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mo-empty mo-empty--page mo-notice">
      <h1 className="mo-display mo-display--page">{title}</h1>
      {children}
    </div>
  );
}

export const momentumKit: TemplateKit = {
  Shell: MomentumShell,
  Home: MomentumHome,
  Catalog: MomentumCatalog,
  Product: MomentumProduct,
  Cart: MomentumCartPage,
  Notice: MomentumNotice,
  fontsHref:
    'https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@1,700;1,800&family=Barlow:wght@400;500;600;700;800&display=swap',
};
