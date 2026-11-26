/**
 * Atelier 2 · A4: ficha de producto (minorista; el mayorista sigue en la ficha
 * de Classic, ver TemplateApp).
 *
 * Sin lógica comercial propia. Todo sale de las mismas piezas que Atelier 1 y
 * Classic:
 *  - variantes, stock, fotos por color y agregar 1: usePdp;
 *  - escalones «Lleva N» y talle por unidad: useTplTiers (= useTierPurchase de
 *    Classic), TierPicker, TierUnits, tierBuyAction y tierStockNotice;
 *  - precio: PriceView (useTplPrice → getPriceInfo, priceFor, resolvePricePair);
 *  - promoción por cantidad: el mismo texto que Classic (useQtyPromoMessage); el
 *    descuento lo aplica el carrito común;
 *  - cupón, guía de talles, probador, complementarios, «Es parte de un look»,
 *    calculadora de envío, videos, reseñas y secciones personalizadas: los
 *    componentes de Classic, sin cambios, dentro de StoreSurface.
 *
 * «Comprar ahora»: lo mismo que Classic (pages/ProductDetail.tsx, handleBuyNow):
 * la acción de agregar, cerrar la bolsa y /checkout. Sólo si se puede agregar.
 *
 * Diseño de la ficha del editor (product_layout): se respeta la VISIBILIDAD de
 * cada bloque; color, talle y agregar no se ocultan (CORE_RIGHT_IDS, como en
 * Classic). La zona «debajo del producto» sigue el orden del editor. La columna
 * de compra usa el orden fijo de Atelier v2.1: el orden configurable de esa
 * columna queda pendiente (bloqueo documentado para publicar, A4_ENTREGA.md).
 *
 * Valores por defecto (facts.ts): las cuotas, la promesa de envío y las
 * insignias de confianza se muestran sólo cuando se distinguen de lo que
 * storeConfig completa solo. «N personas están viendo» no se muestra: Classic
 * calcula ese número a partir del id del producto, no es un dato real.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronDown, Ruler, Tag, Truck, X } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { useCartView } from '../shared/ui';
import { usePromotions } from '@/context/PromotionsContext';
import { useProduct } from '@/hooks/useProduct';
import { useProductBadges } from '@/hooks/useProductBadges';
import { useProductDetailCustomSections } from '@/hooks/useProductDetailCustomSections';
import { useRelatedProducts } from '@/hooks/useRelatedProducts';
import { Seo } from '@/components/Seo';
import { StoreImage } from '@/components/StoreImage';
import { ProductJsonLd } from '@/components/ProductJsonLd';
import { RatingLine } from '@/components/RatingLine';
import { PromoCountdown } from '@/components/PromoCountdown';
import { CouponPdpChip } from '@/components/CouponChip';
import { SizeFinder } from '@/components/SizeFinder';
import { VirtualTryOn, mapFashnCategory } from '@/components/VirtualTryOn';
import { ComplementaryBlock } from '@/components/ComplementaryBlock';
import { OutfitForProductBlock } from '@/components/OutfitForProductBlock';
import { ShippingCalculator } from '@/components/ShippingCalculator';
import { ProductReels } from '@/components/ProductReels';
import { TrustBadges } from '@/components/TrustBadges';
import { CustomSectionNode, ProductDetailCustomSlot } from '@/components/ProductDetailCustomSlot';
import { buildWhatsappInquiry } from '@/lib/checkout';
import { formatPrice, productCategories } from '@/lib/utils';
import { CORE_RIGHT_IDS, DEFAULT_PRODUCT_LAYOUT, customTokenId, isCustomToken, resolveProductLayoutOrNull, type ProductLayout } from '@/lib/productLayout';
import type { CustomSection, Product, ProductDetailSlot, StoreConfig } from '@/lib/types';
import {
  buyAction,
  categoryHref,
  tierBuyAction,
  tierStockNotice,
  useQtyPromoMessage,
  usePdp,
  usePolicies,
  useTplPrice,
  useTplTiers,
} from '../shared/commerce';
import { PriceView } from '../shared/Price';
import { TierPicker, TierUnits } from '../shared/TierPicker';
import { TemplatePdpReviews } from '../shared/ClassicExtras';
import { merchantPurchaseSteps } from '../shared/storeFacts';
import { StoreSurface, type TemplateInk } from '../shared/StoreContent';
import { Atelier2Card } from './Card';
import { Atelier2Choices } from './Choices';
import { installmentsBacked, shippingPromiseBacked, trustBadgesBacked } from './facts';
import { useAtelier2Palette } from './palette';

const ROOT = '.a2-pdp';

type Zone = 'right' | 'below' | null;

/** Dónde puso el comercio un bloque del editor (o el diseño por defecto, si no armó uno). */
function zoneOf(layout: ProductLayout | null, token: string): Zone {
  const l = layout ?? DEFAULT_PRODUCT_LAYOUT;
  if (l.right_column.includes(token)) return 'right';
  if (l.below_product.includes(token)) return 'below';
  return CORE_RIGHT_IDS.includes(token) ? 'right' : null;
}

/** Pieza de Classic con la paleta y la tipografía de Atelier 2. */
function Surface({ ink, children }: { ink: TemplateInk; children: ReactNode }) {
  return <StoreSurface ink={ink}>{children}</StoreSurface>;
}

// ── Galería ───────────────────────────────────────────────────────────────────
interface Media {
  kind: 'image' | 'video';
  src: string;
  poster?: string;
  position?: string;
}

/**
 * Escritorio: la primera foto grande y el resto de a dos. Celular: carrusel de
 * borde a borde con deslizamiento y contador. Fotos del color elegido primero
 * (usePdp.images); los videos del producto (product_media) van al final.
 */
function Gallery({ images, videos, name }: { images: string[]; videos: Media[]; name: string }) {
  const items: Media[] = [...images.map((src) => ({ kind: 'image' as const, src })), ...videos];
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const first = items[0]?.src;
  // Otro color: vuelve a la primera foto (la del color elegido).
  useEffect(() => {
    track.current?.scrollTo({ left: 0 });
    setIndex(0);
  }, [first]);
  const onScroll = () => {
    const el = track.current;
    const item = el?.firstElementChild as HTMLElement | null;
    if (!el || !item || el.scrollWidth <= el.clientWidth + 4) return;
    setIndex(Math.min(items.length - 1, Math.round(el.scrollLeft / item.offsetWidth)));
  };
  if (items.length === 0)
    return (
      <div className="a2-gal a2-gal--empty">
        <p>Sin fotos</p>
      </div>
    );
  const n = items.length;
  return (
    <div className="a2-gal" data-n={Math.min(n, 4)}>
      <div className="a2-gal__t" ref={track} onScroll={onScroll} tabIndex={0} role="region" aria-label={`Fotos de ${name}`}>
        {items.map((m, i) => (
          <figure key={m.src} className="a2-gal__i">
            {m.kind === 'image' ? (
              <StoreImage
                src={m.src}
                alt={n > 1 ? `${name}, foto ${i + 1} de ${n}` : name}
                transformWidth={1200}
                width={900}
                height={1125}
                loading={i < 2 ? 'eager' : 'lazy'}
              />
            ) : (
              <video src={m.src} poster={m.poster} controls playsInline preload="metadata" style={m.position ? { objectPosition: m.position } : undefined} aria-label={`Video de ${name}`} />
            )}
          </figure>
        ))}
      </div>
      {n > 1 && (
        <p className="a2-gal__n" aria-hidden="true">
          {index + 1} / {n}
        </p>
      )}
    </div>
  );
}

// ── Bloques de abajo ─────────────────────────────────────────────────────────
/** «También te puede gustar»: los mismos productos que Classic (useRelatedProducts), con la tarjeta de Atelier 2. */
function Related({ product }: { product: Product }) {
  const { related } = useRelatedProducts(product, 4);
  if (related.length < 2) return null;
  return (
    <section className="a2-wrap a2-sec a2-rel" aria-labelledby="a2-rel-t">
      <div className="a2-sh">
        <h2 id="a2-rel-t">También te puede gustar</h2>
      </div>
      <div className="a2-grid">
        {related.map((p) => (
          <Atelier2Card key={p.card_key ?? p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

/** «Así funciona tu compra»: sólo los pasos que escribió el comercio (FIN0, merchantPurchaseSteps), sin estado. */
function Steps({ steps }: { steps: StoreConfig['purchaseFlowSteps'] }) {
  if (steps.length === 0) return null;
  return (
    <section className="a2-steps" aria-labelledby="a2-steps-t">
      <h2 id="a2-steps-t" className="a2-blk__t">
        Así funciona tu compra
      </h2>
      <ol>
        {steps.map((s, i) => (
          <li key={i}>
            <span className="a2-steps__n" aria-hidden="true">
              {i + 1}
            </span>
            <span>
              <b>{s.name}</b>
              {s.detail && <span>{s.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Zona «debajo del producto» en el orden del editor (mismo contrato que
 * BelowProductBlocks de Classic): bloques conocidos y secciones `custom:<id>`;
 * las secciones de esta zona que el diseño no nombra van al final. Sin diseño
 * guardado: el orden fijo de Classic. Videos, reseñas y relacionados que el
 * comercio dejó en la COLUMNA se dibujan acá, primero (la columna de Atelier 2
 * no tiene su variante angosta; ver A4_ENTREGA.md).
 */
function BelowZone({ product, layout, sections, ink }: { product: Product; layout: ProductLayout | null; sections: CustomSection[]; ink: TemplateInk }) {
  const config = useStore();
  const below = sections.filter((s) => (s.content as { slot?: ProductDetailSlot }).slot === 'below_product');
  const block = (token: string): ReactNode => {
    switch (token) {
      case 'reels':
        return (
          <Surface key="reels" ink={ink}>
            <ProductReels productId={product.id} />
          </Surface>
        );
      case 'reviews':
        return <TemplatePdpReviews key="reviews" ink={ink} product={product} />;
      case 'related':
        return config.isPro && config.sections.upsell ? <Related key="related" product={product} /> : null;
      case 'purchase_flow':
        return (
          <div key="purchase_flow" className="a2-wrap a2-sec">
            <Steps steps={merchantPurchaseSteps(config)} />
          </div>
        );
      default:
        return null;
    }
  };
  const custom = (s: CustomSection, key: string) => (
    <Surface key={key} ink={ink}>
      <CustomSectionNode section={s} />
    </Surface>
  );

  const nodes: ReactNode[] = [];
  if (!layout) {
    nodes.push(block('reels'));
    below.forEach((s) => nodes.push(custom(s, s.id)));
    nodes.push(block('reviews'), block('related'));
  } else {
    const fromColumn = layout.right_column.filter((t) => ['reels', 'reviews', 'related'].includes(t));
    const byId = new Map(below.map((s) => [s.id, s]));
    const used = new Set<string>();
    for (const token of [...fromColumn, ...layout.below_product]) {
      if (isCustomToken(token)) {
        const s = byId.get(customTokenId(token));
        if (s && !used.has(s.id)) {
          used.add(s.id);
          nodes.push(custom(s, token));
        }
        continue;
      }
      nodes.push(block(token));
    }
    below.filter((s) => !used.has(s.id)).forEach((s) => nodes.push(custom(s, `sin-orden-${s.id}`)));
  }
  return <div className="a2-below">{nodes}</div>;
}

// ── Aviso al agregar ─────────────────────────────────────────────────────────
/**
 * addItem abre la bolsa lateral; Atelier 2 todavía no la tiene (llega en A6).
 * Mientras tanto: se cierra ese estado y se avisa, con un enlace a la bolsa.
 */
function useAddedNotice() {
  const { isOpen, close } = useCartView();
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    close();
    setAdded(true);
  }, [isOpen, close]);
  useEffect(() => {
    if (!added) return;
    const t = window.setTimeout(() => setAdded(false), 6000);
    return () => window.clearTimeout(t);
  }, [added]);
  return { added, dismiss: useCallback(() => setAdded(false), []) };
}

// ── Ficha ─────────────────────────────────────────────────────────────────────
function ProductView({ product }: { product: Product }) {
  const config = useStore();
  const { ink } = useAtelier2Palette();
  const navigate = useNavigate();
  const { close: closeCart } = useCartView();
  const pdp = usePdp(product);
  const tier = useTplTiers(product, pdp);
  const notice = tierStockNotice(tier);
  const { promoForProduct, quantityPromoFor } = usePromotions();
  const promo = promoForProduct(product, pdp.color);
  const qtyPromo = quantityPromoFor(product, pdp.color);
  const qtyMsg = useQtyPromoMessage(product, pdp.color);
  const price = useTplPrice(product, { color: pdp.color, size: pdp.size });
  const { badges } = useProductBadges(product, { color: pdp.color });
  const { sections } = useProductDetailCustomSections(product.id);
  const policies = usePolicies();
  const { added, dismiss } = useAddedNotice();
  const [finder, setFinder] = useState(false);

  const layout = resolveProductLayoutOrNull(product.product_layout) ?? config.productLayout;
  const shows = (token: string) => zoneOf(layout, token) !== null;
  const inColumn = (token: string) => zoneOf(layout, token) === 'right';

  const cats = productCategories(product);
  const description = product.description?.trim() ?? '';
  const inquiry = shows('whatsapp') ? buildWhatsappInquiry(config, product.name) : '';
  const tryOn = shows('virtual_try') && config.isPro && config.sections.virtualTryon && pdp.images[0] && config.slug && config.companyId;
  const sizeGuide = shows('size_guide') && pdp.allSizes.length > 0 && config.isPaid && config.sections.probador;
  const steps = inColumn('purchase_flow') ? merchantPurchaseSteps(config) : [];
  const videos: Media[] = (product.product_media ?? [])
    .filter((m) => m.type === 'video' && m.url)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => ({ kind: 'video', src: m.url, poster: m.thumbnail_url ?? undefined, position: m.object_position ?? undefined }));

  // Botón principal: el mismo criterio que Atelier 1 (agrega, o lleva a lo que falta elegir).
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
  const tierCta = tier.tierValid ? `Agregar ${tier.tierUnits} a la bolsa` : notice ? 'Sin stock suficiente' : 'Elegí las variantes';
  const primary = tier.inTierMode ? tierBuyAction(tier, ROOT) : buyAction(pdp, ROOT);
  const primaryDisabled = tier.inTierMode ? !tier.tierValid && tier.tierIssue?.kind !== 'unit' : pdp.soldOut || (!pdp.canAdd && !pdp.missing);
  const ready = tier.inTierMode ? tier.tierValid : pdp.canAdd;
  // «Comprar ahora» (Classic, handleBuyNow): la misma acción de agregar, cerrar la bolsa e ir al checkout.
  const buyNow = () => {
    if (!ready) return;
    if (tier.inTierMode) tier.handleAddTier();
    else pdp.add();
    closeCart();
    navigate('/checkout');
  };

  // Barra fija del celular: aparece cuando el botón principal sale de la pantalla (mismo criterio que Classic).
  const buyRef = useRef<HTMLButtonElement>(null);
  const [bar, setBar] = useState(false);
  useEffect(() => {
    const el = buyRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) setBar(!last.isIntersecting);
    }, { rootMargin: '0px 0px -64px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [product.id]);

  // Columna fija al bajar (escritorio) sólo si entra entera en la pantalla.
  const colRef = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(false);
  useLayoutEffect(() => {
    const el = colRef.current;
    if (!el) return;
    const check = () => setFits(el.offsetHeight + 120 <= window.innerHeight);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener('resize', check);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', check);
    };
  }, []);

  const activeTier = tier.inTierMode ? tier.tierOptions.find((o) => o.isActive) : undefined;
  const barPrice = activeTier ? `${formatPrice(activeTier.unitPrice)} c/u` : price ? formatPrice(price.big) : 'Consultar precio';
  const barDetail = tier.inTierMode
    ? `Lleva ${tier.tierUnits}${tier.tierVariantLabel ? ` · ${tier.tierVariantLabel}` : ''}`
    : [pdp.color, pdp.size].filter(Boolean).join(' · ') || product.name;

  return (
    <>
      <Seo
        title={`${product.name} · ${config.name}`}
        description={description || config.metaDescription || config.name}
        image={pdp.images[0] || config.ogImageUrl}
        type="product"
        slug={config.slug}
        siteName={config.name}
        path={`/producto/${product.id}`}
      />
      <ProductJsonLd product={product} images={pdp.images} />

      <div className="a2-wrap a2-pdp">
        <div className="a2-pdp__g">
          <Gallery images={pdp.images} videos={videos} name={product.name} />
          <Surface ink={ink}>
            <ProductDetailCustomSlot sections={sections} slot="below_gallery" />
          </Surface>
        </div>

        <div className="a2-pdp__i" ref={colRef} data-sticky={fits || undefined}>
          <div className="a2-buy">
            <div className="a2-buy__h">
              <nav className="a2-crumbs" aria-label="Ruta">
                <Link to="/">Inicio</Link>
                <span aria-hidden="true">/</span>
                {cats[0] ? <Link to={categoryHref(cats[0])}>{cats[0]}</Link> : <Link to="/productos">Productos</Link>}
              </nav>
              {badges.length > 0 && (
                <ul className="a2-flags" aria-label="Destacados">
                  {badges.map((b) => (
                    <li key={b.key}>{b.label}</li>
                  ))}
                </ul>
              )}
              <h1>{product.name}</h1>
              {product.brand && <p className="a2-buy__brand">{product.brand}</p>}
              <Surface ink={ink}>
                <RatingLine productId={product.id} variant="detail" />
              </Surface>
            </div>

            <div className="a2-pp-wrap">
              {promo?.show_countdown && (
                <Surface ink={ink}>
                  <PromoCountdown endsAt={promo.ends_at} color={promo.badge_color} />
                </Surface>
              )}
              <PriceView product={product} cls="a2-pp" color={pdp.color} size={pdp.size} showInstallments={installmentsBacked(config)} />
              <Surface ink={ink}>
                <CouponPdpChip product={product} hasNonStackablePromo={promo?.stackable_with_coupons === false} color={pdp.color} size={pdp.size} />
              </Surface>
            </div>

            {shows('quantity_promo') && qtyPromo && qtyMsg && !tier.hasTiers && (
              <div className="a2-qpromo">
                <p>
                  <Tag aria-hidden="true" />
                  <span>{qtyMsg}</span>
                </p>
                {qtyPromo.show_countdown && (
                  <Surface ink={ink}>
                    <PromoCountdown endsAt={qtyPromo.ends_at} color={qtyPromo.badge_color} />
                  </Surface>
                )}
              </div>
            )}

            {tier.hasTiers && !pdp.soldOut && (
              <div className="a2-blk a2-blk--tier">
                {shows('quantity_promo') && qtyPromo && qtyMsg && (
                  <div className="a2-qpromo a2-qpromo--in">
                    <p>
                      <Tag aria-hidden="true" />
                      <span>{qtyMsg}</span>
                    </p>
                    {qtyPromo.show_countdown && (
                      <Surface ink={ink}>
                        <PromoCountdown endsAt={qtyPromo.ends_at} color={qtyPromo.badge_color} />
                      </Surface>
                    )}
                  </div>
                )}
                <TierPicker tier={tier} prefix="a2" />
              </div>
            )}

            {(pdp.colors.length > 0 || pdp.sizes.length > 0 || tier.perUnitOpen) && (
              <div className="a2-blk a2-blk--pick" data-next={tier.tierIssue?.kind === 'unit' ? tier.tierIssue.unit : undefined}>
                {tier.perUnitOpen && <p className="a2-blk__t">Elegí cada unidad</p>}
                {!tier.perUnitOpen && (
                  <Atelier2Choices
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
                <TierUnits tier={tier} pdp={pdp} prefix="a2" Choices={Atelier2Choices} />
                {sizeGuide && (
                  <div className="a2-guide">
                    <button type="button" className="a2-lnk" aria-expanded={finder} aria-controls="a2-finder" onClick={() => setFinder((v) => !v)}>
                      <Ruler aria-hidden="true" />
                      ¿Cuál es mi talle?
                      <ChevronDown aria-hidden="true" className="a2-lnk__c" />
                    </button>
                    {finder && (
                      <div id="a2-finder" className="a2-guide__p">
                        <Surface ink={ink}>
                          <SizeFinder
                            sizes={pdp.allSizes}
                            onSelect={(s) => {
                              pdp.setSize(s);
                              if (tier.perUnitOpen) tier.setAllUnitSizes(s);
                            }}
                          />
                        </Surface>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {(notice || (!tier.perUnitOpen && pdp.lowStock != null)) && (
              <div className="a2-notes">
                {notice && (
                  <p className="a2-note" role="status">
                    {notice}
                  </p>
                )}
                {!tier.perUnitOpen && pdp.lowStock != null && (
                  <p className="a2-low">{pdp.lowStock === 1 ? 'Queda 1 en este talle.' : `Quedan ${pdp.lowStock} en este talle.`}</p>
                )}
              </div>
            )}

            <div className="a2-blk a2-blk--cta">
              <button type="button" ref={buyRef} className="a2-btn a2-btn--buy" onClick={primary} disabled={primaryDisabled}>
                {tier.inTierMode ? tierCta : cta}
              </button>
              <button type="button" className="a2-btn a2-btn--line" onClick={buyNow} disabled={!ready}>
                Comprar ahora
              </button>
              {inquiry && (
                <a href={inquiry} target="_blank" rel="noreferrer" className="a2-btn a2-btn--line a2-btn--wa">
                  Consultar por WhatsApp
                </a>
              )}
            </div>

            {shows('shipping_promise') && shippingPromiseBacked(config) && (
              <p className="a2-promise">
                <Truck aria-hidden="true" />
                <span>
                  {config.shippingPromiseTitle && <b>{config.shippingPromiseTitle}</b>}
                  {config.shippingPromiseSubtitle && <span>{config.shippingPromiseSubtitle}</span>}
                </span>
              </p>
            )}

            {tryOn && (
              <Surface ink={ink}>
                <VirtualTryOn
                  garmentImageUrl={pdp.images[0]}
                  garmentName={product.name}
                  garmentCategory={mapFashnCategory(cats)}
                  storeSlug={config.slug}
                  productId={product.id}
                  companyId={config.companyId as string}
                />
              </Surface>
            )}

            {shows('upsells') && (
              <Surface ink={ink}>
                <ComplementaryBlock contexto="ficha" product={product} preferredSize={pdp.size} />
              </Surface>
            )}
            {config.complementaryBlock.mostrarOutfit && (
              <Surface ink={ink}>
                <OutfitForProductBlock product={product} />
              </Surface>
            )}
            <Surface ink={ink}>
              <ProductDetailCustomSlot sections={sections} slot="right_column" variant="column" />
            </Surface>
            {config.showShippingCalculator !== false && (
              <Surface ink={ink}>
                <ShippingCalculator productId={product.id} />
              </Surface>
            )}
            {trustBadgesBacked(config) && (
              <Surface ink={ink}>
                <TrustBadges />
              </Surface>
            )}
            <Steps steps={steps} />

            <Surface ink={ink}>
              <ProductDetailCustomSlot sections={sections} slot="above_description" />
            </Surface>
            {(description || policies.length > 0) && (
              <div className="a2-pdacc">
                {description && (
                  <details className="a2-acc" open>
                    <summary>
                      Descripción
                      <ChevronDown aria-hidden="true" />
                    </summary>
                    <p>{description}</p>
                  </details>
                )}
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
            )}
            <Surface ink={ink}>
              <ProductDetailCustomSlot sections={sections} slot="below_description" />
            </Surface>
          </div>
        </div>
      </div>

      <BelowZone product={product} layout={layout} sections={sections} ink={ink} />

      <div className="a2-bar" data-on={bar || undefined} aria-hidden={!bar || undefined}>
        <div className="a2-bar__t">
          <b>{barPrice}</b>
          <span>{barDetail}</span>
        </div>
        <button type="button" className="a2-btn" onClick={primary} disabled={primaryDisabled} tabIndex={bar ? undefined : -1}>
          {pdp.soldOut ? 'Agotado' : tier.inTierMode ? (tier.tierValid ? `Agregar ${tier.tierUnits}` : 'Elegir') : pdp.canAdd ? 'Agregar' : pdp.missing ? 'Elegir' : 'Sin stock'}
        </button>
      </div>

      {added && (
        <div className="a2-toast" role="status">
          <Check aria-hidden="true" />
          <p>Se agregó a tu bolsa</p>
          <Link to="/carrito" className="a2-toast__a">
            Ver bolsa
          </Link>
          <button type="button" className="a2-ib" onClick={dismiss} aria-label="Cerrar aviso">
            <X aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}

export function Atelier2Product() {
  const { id } = useParams<{ id: string }>();
  const { product, isLoading } = useProduct(id);
  const config = useStore();
  useFirstPaintGate('tpl-product', isLoading);
  if (isLoading)
    return (
      <div className="a2-wrap a2-pdp" aria-busy="true" aria-label="Cargando producto">
        <div className="a2-pdp__g">
          <span className="a2-sk__img a2-sk__img--pdp" />
        </div>
        <div className="a2-pdp__i">
          <span className="a2-sk__l" />
          <span className="a2-sk__l a2-sk__l--t" />
          <span className="a2-sk__l a2-sk__l--s" />
          <span className="a2-sk__b" />
        </div>
      </div>
    );
  if (!product)
    return (
      <section className="a2-wrap a2-empty a2-empty--page">
        <Seo title={`Producto no disponible · ${config.name}`} slug={config.slug} noindex />
        <h1>Este producto ya no está disponible</h1>
        <Link to="/productos" className="a2-btn a2-btn--line">
          Ver todos los productos
        </Link>
      </section>
    );
  return <ProductView key={product.id} product={product} />;
}
