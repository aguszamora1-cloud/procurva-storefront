/**
 * Atelier 2 · A2: portada a ancho completo (aprobada en la maqueta v2.1).
 *
 * Mismas fuentes de imagen y la misma prioridad que la portada de Classic
 * (components/Hero.tsx), sin tocarla:
 *   1. Banners activos del catálogo (useBanners). En celular, cada banner usa su
 *      imagen vertical si la tiene; en escritorio, sólo los que tienen imagen de
 *      escritorio (si no hay ninguno, los de celular).
 *   2. Si no hay banners: la portada única de la configuración (hero_image_url /
 *      hero_image_url_mobile).
 *   3. Sin ninguna imagen: apertura con el nombre de la tienda y productos reales.
 * Varios banners rotan como en Classic (6 s), con puntos para elegirlos; con
 * «reducir movimiento» no rotan solos.
 *
 * Texto: mismo criterio que Classic. Con título cargado y modo distinto de
 * «sólo imagen», la foto cubre el área (recorte controlado) y el texto va dentro
 * del ancho de lectura. Sin texto, la imagen se muestra ENTERA, en su
 * proporción, de borde a borde, sin nada encima.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { useBanners } from '@/hooks/useBanners';
import { StoreImage } from '@/components/StoreImage';
import { mainImage } from '@/lib/utils';
import type { Product } from '@/lib/types';
import { cardHref, isSoldOut } from '../shared/commerce';

const ROTATE_MS = 6000;
const MOBILE_QUERY = '(max-width: 899px)';

interface Slide {
  image: string;
  link: string | null;
}

function renderable(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const u = url.trim();
  return u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/') ? u : '';
}

function first(...urls: (string | null | undefined)[]): string {
  for (const u of urls) {
    const r = renderable(u);
    if (r) return r;
  }
  return '';
}

function useMatch(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

function SlideLink({ link, label, children }: { link: string | null; label: string; children: ReactNode }) {
  if (!link) return <>{children}</>;
  if (/^https?:\/\//i.test(link)) {
    return (
      <a href={link} target="_blank" rel="noreferrer" aria-label={label} className="a2-hero__link">
        {children}
      </a>
    );
  }
  return (
    <Link to={link} aria-label={label} className="a2-hero__link">
      {children}
    </Link>
  );
}

/** Sin imagen de portada: nombre de la tienda, cifras reales y tres productos con foto y stock. */
function Intro({ products, categories }: { products: Product[]; categories: number }) {
  const { name } = useStore();
  const three = products.filter((p) => mainImage(p) && !isSoldOut(p)).slice(0, 3);
  return (
    <section className="a2-wrap a2-intro" aria-labelledby="a2-intro-t">
      <div className="a2-intro__t">
        <h1 id="a2-intro-t">{name}</h1>
        {products.length > 0 && (
          <p>
            {products.length} {products.length === 1 ? 'producto' : 'productos'}
            {categories > 1 ? ` en ${categories} categorías` : ''}.
          </p>
        )}
        <Link to="/productos" className="a2-btn">
          Ver todos los productos
        </Link>
      </div>
      {three.length > 0 && (
        <div className="a2-intro__g" data-n={three.length}>
          {three.map((p, i) => (
            <Link key={p.card_key ?? p.id} to={cardHref(p)}>
              <StoreImage src={mainImage(p)} alt={p.name} width={600} height={800} loading={i === 0 ? 'eager' : 'lazy'} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function Atelier2Hero({ products, categories }: { products: Product[]; categories: number }) {
  const config = useStore();
  const { banners, isLoading } = useBanners();
  const isMobile = useMatch(MOBILE_QUERY);
  const reduceMotion = useMatch('(prefers-reduced-motion: reduce)');
  const [idx, setIdx] = useState(0);
  const [ready, setReady] = useState(false);

  const mobileSlides: Slide[] = banners.map((b) => ({ image: first(b.image_url_mobile, b.image_url), link: b.link_url || null })).filter((s) => s.image);
  const desktopOwn: Slide[] = banners.map((b) => ({ image: first(b.image_url), link: b.link_url || null })).filter((s) => s.image);
  const fromBanners = isMobile ? mobileSlides : desktopOwn.length > 0 ? desktopOwn : mobileSlides;
  const single = isMobile ? first(config.heroImageMobileUrl, config.heroImageUrl) : first(config.heroImageUrl, config.heroImageMobileUrl);
  const slides: Slide[] = fromBanners.length > 0 ? fromBanners : single ? [{ image: single, link: null }] : [];
  const safeIdx = idx < slides.length ? idx : 0;

  // Igual que Classic: la tienda no se pinta hasta tener la portada (sin saltos).
  useFirstPaintGate('a2-hero', isLoading || (slides.length > 0 && !ready));

  useEffect(() => {
    if (slides.length <= 1 || reduceMotion) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [slides.length, reduceMotion]);

  if (isLoading && slides.length === 0) return <div className="a2-hero a2-hero--wait" aria-hidden="true" />;
  if (slides.length === 0) return <Intro products={products} categories={categories} />;

  const textAllowed = config.heroMode !== 'image_only';
  const hasText = textAllowed && Boolean(config.heroTitle);
  const hasCta = textAllowed && Boolean(config.heroCtaText);
  const ctaExternal = /^https?:\/\//i.test(config.heroCtaLink);
  const label = config.heroCtaText || `${config.name}, ver productos`;

  const images = slides.map((s, i) => (
    <img
      key={s.image + i}
      src={s.image}
      alt={hasText ? '' : i === safeIdx ? `${config.name}` : ''}
      className="a2-hero__img"
      data-on={i === safeIdx || undefined}
      aria-hidden={i === safeIdx ? undefined : true}
      fetchPriority={i === 0 ? 'high' : undefined}
      loading={i === 0 ? 'eager' : 'lazy'}
      onLoad={i === 0 ? () => setReady(true) : undefined}
      onError={i === 0 ? () => setReady(true) : undefined}
    />
  ));

  const dots =
    slides.length > 1 ? (
      <div className="a2-hero__dots" role="group" aria-label="Banners">
        {slides.map((s, i) => (
          <button key={s.image + i} type="button" aria-label={`Banner ${i + 1} de ${slides.length}`} aria-pressed={i === safeIdx} onClick={() => setIdx(i)}>
            <span />
          </button>
        ))}
      </div>
    ) : null;

  if (!hasText) {
    // El banner ya trae su diseño y su texto: entero, en su proporción, sin nada encima.
    return (
      <section className="a2-hero a2-hero--img" aria-label={config.name}>
        <SlideLink link={slides[safeIdx].link ?? (config.heroCtaLink || null)} label={label}>
          <div className="a2-hero__stack">{images}</div>
        </SlideLink>
        {dots}
      </section>
    );
  }

  return (
    <section className="a2-hero a2-hero--txt" aria-labelledby="a2-hero-t">
      <div className="a2-hero__stack a2-hero__stack--cover">{images}</div>
      <div className="a2-wrap a2-hero__c">
        <div className="a2-hero__box">
          <h1 id="a2-hero-t">{config.heroTitle}</h1>
          {config.heroSubtitle && <p>{config.heroSubtitle}</p>}
          {hasCta &&
            (ctaExternal ? (
              <a href={config.heroCtaLink} target="_blank" rel="noreferrer" className="a2-btn a2-btn--on">
                {config.heroCtaText}
              </a>
            ) : (
              <Link to={config.heroCtaLink || '/productos'} className="a2-btn a2-btn--on">
                {config.heroCtaText}
              </Link>
            ))}
        </div>
      </div>
      {dots}
    </section>
  );
}
