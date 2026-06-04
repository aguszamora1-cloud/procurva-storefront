import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/context/StoreProvider';
import { useBanners } from '@/hooks/useBanners';

const ROTATE_MS = 6000;

export function Hero() {
  const config = useStore();
  const { banners } = useBanners();
  const [idx, setIdx] = useState(0);

  // Slides: banners del catálogo o, si no hay, el hero de la config.
  const slides =
    banners.length > 0
      ? banners.map((b) => ({
          image: b.image_url,
          imageMobile: b.image_url_mobile,
          link: b.link_url,
        }))
      : config.heroImageUrl
        ? [{ image: config.heroImageUrl, imageMobile: null, link: null }]
        : [];

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  // Hero sólo-texto cuando no hay imágenes.
  if (slides.length === 0) {
    return (
      <section className="bg-primary text-[var(--color-on-primary)]">
        <div className="mx-auto flex min-h-[55vh] max-w-7xl flex-col items-start justify-center gap-4 px-4 py-20">
          <h1 className="max-w-2xl">{config.heroTitle || config.name}</h1>
          {(config.heroSubtitle || config.tagline) && (
            <p className="max-w-xl text-base opacity-80 md:text-lg">
              {config.heroSubtitle || config.tagline}
            </p>
          )}
          <Link to={config.heroCtaLink} className="btn-accent mt-2 px-8 py-3.5 text-sm">
            {config.heroCtaText}
          </Link>
        </div>
      </section>
    );
  }

  const current = slides[idx];
  const inner = (
    <div className="relative h-[60vh] min-h-[380px] w-full overflow-hidden md:h-[78vh]">
      <picture>
        {current.imageMobile && <source media="(max-width: 768px)" srcSet={current.imageMobile} />}
        <img src={current.image} alt={config.name} className="h-full w-full object-cover" />
      </picture>

      {/* Overlay + texto sólo si la config lo pide. */}
      {(config.heroTitle || config.heroSubtitle) && (
        <div className="absolute inset-0 flex flex-col items-start justify-end bg-gradient-to-t from-black/55 to-transparent p-6 md:p-12">
          <div className="text-white">
            {config.heroTitle && <h1 className="max-w-2xl drop-shadow">{config.heroTitle}</h1>}
            {config.heroSubtitle && (
              <p className="mt-2 max-w-xl text-sm opacity-90 md:text-lg">{config.heroSubtitle}</p>
            )}
            <Link to={config.heroCtaLink} className="btn-accent mt-4 inline-block px-8 py-3 text-sm">
              {config.heroCtaText}
            </Link>
          </div>
        </div>
      )}

      {/* Indicadores */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`Ir al slide ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`h-2 transition-all ${i === idx ? 'w-6 bg-white' : 'w-2 bg-white/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <section>
      {current.link ? (
        <a href={current.link} target="_blank" rel="noreferrer">
          {inner}
        </a>
      ) : (
        inner
      )}
    </section>
  );
}
