import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { useBanners } from '@/hooks/useBanners';
import { transformedSrc } from '@/lib/images';

const ROTATE_MS = 6000;

interface Slide {
  image: string;
  imageMobile: string | null;
  link: string | null;
}

export function Hero() {
  const config = useStore();
  const { banners, isLoading } = useBanners();
  const [idx, setIdx] = useState(0);

  const slides: Slide[] =
    banners.length > 0
      ? banners.map((b) => ({ image: b.image_url, imageMobile: b.image_url_mobile, link: b.link_url }))
      : config.heroImageUrl
        ? [{ image: config.heroImageUrl, imageMobile: null, link: null }]
        : [];

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  const hasText = Boolean(config.heroTitle); // hero_title o banner_text
  const hasCta = Boolean(config.heroCtaText); // sólo si el comercio cargó el texto

  if (isLoading && banners.length === 0 && !config.heroImageUrl) {
    return <section className="h-[60vh] w-full bg-secondary md:h-[70vh]" />;
  }

  // Sin imágenes: hero editorial sólo si hay texto configurado. Si no, no hay hero.
  if (slides.length === 0) {
    if (!hasText) return null;
    return (
      <section className="relative bg-primary text-[var(--color-on-primary)]">
        <div className="mx-auto max-w-[1400px] px-6 py-24 md:px-12 md:py-40">
          <h1 className="max-w-3xl font-heading text-[44px] font-extrabold uppercase leading-[1] tracking-[-0.5px] md:text-[88px]">
            {config.heroTitle}
          </h1>
          {config.heroSubtitle && (
            <p className="mt-6 max-w-md text-[15px] text-[var(--color-on-primary)]/75 md:text-[17px]">
              {config.heroSubtitle}
            </p>
          )}
          {hasCta && (
            <div className="mt-10">
              <Link
                to={config.heroCtaLink}
                className="inline-flex items-center justify-center rounded-lg bg-accent px-10 py-4 text-[13px] font-bold uppercase tracking-[1px] text-on-accent shadow-lg transition-all duration-200 hover:scale-[1.02]"
              >
                {config.heroCtaText}
              </Link>
            </div>
          )}
        </div>
      </section>
    );
  }

  const slide = slides[idx];
  const showText = hasText;

  const media = (
    <div className="relative h-[72vh] min-h-[420px] w-full overflow-hidden bg-primary md:h-screen">
      {slides.map((s, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            i === idx ? 'z-10 opacity-100' : 'z-0 opacity-0'
          }`}
        >
          <picture>
            {s.imageMobile && (
              <source media="(max-width: 767px)" srcSet={transformedSrc(s.imageMobile, { width: 768 })} />
            )}
            <img
              src={transformedSrc(s.image, { width: 1600 })}
              alt={config.name}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding={i === 0 ? 'sync' : 'async'}
              fetchPriority={i === 0 ? 'high' : 'auto'}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </picture>
        </div>
      ))}

      {/* Gradiente + texto/CTA al pie (estilo RSW). Sólo si hay algo que mostrar. */}
      {(showText || hasCta) && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 z-20">
            <div className="mx-auto max-w-[1400px] px-6 py-12 md:px-12 md:py-16">
              {showText && (
                <div className="mb-5 max-w-2xl text-white">
                  {config.heroTitle && (
                    <h1 className="font-heading text-[36px] font-extrabold uppercase leading-[1.02] tracking-[-0.5px] drop-shadow md:text-[64px]">
                      {config.heroTitle}
                    </h1>
                  )}
                  {config.heroSubtitle && (
                    <p className="mt-3 max-w-xl text-[14px] text-white/85 md:text-[17px]">{config.heroSubtitle}</p>
                  )}
                </div>
              )}
              {hasCta && (
                <Link
                  to={config.heroCtaLink}
                  className="inline-flex items-center justify-center rounded-lg bg-accent px-8 py-4 text-[12px] font-bold uppercase tracking-[1px] text-on-accent shadow-lg transition-all duration-200 hover:scale-[1.02] md:px-10 md:text-[13px]"
                >
                  {config.heroCtaText}
                </Link>
              )}
            </div>
          </div>
        </>
      )}

      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Ir al slide ${i + 1}`}
              className={`h-1 rounded-full transition-all ${i === idx ? 'w-8 bg-white' : 'w-4 bg-white/40 hover:bg-white/70'}`}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <section className="relative">
      {slide.link ? (
        <a href={slide.link} target="_blank" rel="noreferrer">
          {media}
        </a>
      ) : (
        media
      )}
    </section>
  );
}
