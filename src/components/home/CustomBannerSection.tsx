import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CustomSection, CustomSectionBannerContent, CustomSectionBannerSlide } from '@/lib/types';

/** Normaliza el content del banner a slides, tolerando el esquema viejo (1 imagen en root). */
function getSlides(content: CustomSectionBannerContent): CustomSectionBannerSlide[] {
  const list = Array.isArray(content.images)
    ? content.images
    : content.image_url
      ? [{
          image_url: content.image_url,
          mobile_image_url: content.mobile_image_url,
          link_url: content.link_url,
          alt_text: content.alt_text,
        }]
      : [];
  return list.filter((s) => s && s.image_url);
}

/** Una imagen del banner (con <picture> responsive y link opcional). */
function Slide({ slide, label, load }: { slide: CustomSectionBannerSlide; label: string; load: boolean }) {
  const img = (
    <picture>
      {slide.mobile_image_url ? <source media="(max-width: 767px)" srcSet={load ? slide.mobile_image_url : undefined} /> : null}
      <img
        src={load ? slide.image_url : undefined}
        alt={slide.alt_text || label || ''}
        loading="lazy"
        className="block w-full h-auto object-cover"
      />
    </picture>
  );
  return slide.link_url ? (
    <a href={slide.link_url} target="_blank" rel="noopener noreferrer" aria-label={slide.alt_text || label}>
      {img}
    </a>
  ) : (
    img
  );
}

/** Banner custom: despacha según content.display_mode (default 'carousel'). */
export function CustomBannerSection({ section }: { section: CustomSection }) {
  const content = section.content as CustomSectionBannerContent;
  const slides = useMemo(() => getSlides(content), [content]);
  const count = slides.length;

  if (count === 0) return null;

  // 1 imagen → estático (cualquier modo).
  if (count === 1) {
    return (
      <section className="w-full">
        <Slide slide={slides[0]} label={section.label} load />
      </section>
    );
  }

  const mode = content.display_mode ?? 'carousel';
  if (mode === 'scroll') return <ScrollBanner slides={slides} label={section.label} />;
  if (mode === 'phone_mockup') return <PhoneMockupBanner content={content} slides={slides} label={section.label} />;
  return <CarouselBanner content={content} slides={slides} label={section.label} />;
}

/** Modo 'carousel' — comportamiento original (una imagen a la vez, flechas, dots, autoplay). */
function CarouselBanner({
  content,
  slides,
  label,
}: {
  content: CustomSectionBannerContent;
  slides: CustomSectionBannerSlide[];
  label: string;
}) {
  const count = slides.length;
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  // Sólo cargamos la imagen actual y sus adyacentes (lazy).
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0, 1, count - 1]));
  const touchStartX = useRef<number | null>(null);

  const autoplay = content.autoplay ?? true;
  const intervalMs = Math.max(2, content.interval_seconds ?? 5) * 1000;

  const go = (next: number) => {
    const idx = ((next % count) + count) % count;
    setCurrent(idx);
    setLoaded((prev) => new Set(prev).add(idx).add((idx + 1) % count).add((idx - 1 + count) % count));
  };

  useEffect(() => {
    if (!autoplay || paused) return;
    const t = setInterval(() => go(current + 1), intervalMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, paused, current, intervalMs]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
    touchStartX.current = null;
  };

  return (
    <section
      className="relative w-full overflow-hidden group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-roledescription="carousel"
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {slides.map((sl, i) => (
          <div key={i} className="w-full shrink-0">
            <Slide slide={sl} label={label} load={loaded.has(i)} />
          </div>
        ))}
      </div>

      {/* Flechas */}
      <button
        type="button"
        onClick={() => go(current - 1)}
        aria-label="Anterior"
        className="absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full bg-black/35 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-black/55"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={() => go(current + 1)}
        aria-label="Siguiente"
        className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full bg-black/35 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-black/55"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`Ir al slide ${i + 1}`}
            className={`h-2 rounded-full transition-all ${i === current ? 'w-5 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'}`}
          />
        ))}
      </div>
    </section>
  );
}

/** Modo 'scroll' — scroll horizontal con snap, todas las imágenes visibles, sin autoplay. */
function ScrollBanner({ slides, label }: { slides: CustomSectionBannerSlide[]; label: string }) {
  return (
    <section className="w-full">
      <div
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-4 sm:px-8 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((sl, i) => {
          const img = (
            <picture>
              {sl.mobile_image_url ? <source media="(max-width: 767px)" srcSet={sl.mobile_image_url} /> : null}
              <img
                src={sl.image_url}
                alt={sl.alt_text || label || ''}
                loading="lazy"
                className="block w-full h-auto rounded-xl object-cover"
              />
            </picture>
          );
          return (
            <div key={i} className="shrink-0 snap-start basis-[80%] sm:basis-[45%] lg:basis-[30%]">
              {sl.link_url ? (
                <a href={sl.link_url} target="_blank" rel="noopener noreferrer" aria-label={sl.alt_text || label}>
                  {img}
                </a>
              ) : (
                img
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Modo 'phone_mockup' — imágenes dentro de un frame de celular, con dots y swipe. */
function PhoneMockupBanner({
  content,
  slides,
  label,
}: {
  content: CustomSectionBannerContent;
  slides: CustomSectionBannerSlide[];
  label: string;
}) {
  const count = slides.length;
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const title = content.title?.trim();
  const autoplay = content.autoplay ?? true;
  const intervalMs = Math.max(2, content.interval_seconds ?? 5) * 1000;

  const go = (next: number) => setCurrent(((next % count) + count) % count);

  useEffect(() => {
    if (!autoplay || paused) return;
    const t = setInterval(() => go(current + 1), intervalMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, paused, current, intervalMs]);

  const onTouchStart = (e: React.TouchEvent) => {
    setPaused(true);
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current !== null) {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
      touchStartX.current = null;
    }
    setPaused(false);
  };

  return (
    <section
      className="w-full bg-[#f5f5f5] dark:bg-gray-800/40 pt-10 pb-12"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {title ? (
        <h2 className="px-4 mb-8 text-center text-sm sm:text-base font-medium uppercase tracking-[0.2em] text-gray-700 dark:text-gray-200">
          {title}
        </h2>
      ) : null}

      {/* Frame del celular */}
      <div
        className="relative mx-auto w-[260px] sm:w-[320px] aspect-[9/19.5] rounded-[24px] bg-black p-2 shadow-xl"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-roledescription="carousel"
      >
        {/* Pantalla interior */}
        <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-black">
          <div
            className="flex h-full transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {slides.map((sl, i) => (
              <div key={i} className="h-full w-full shrink-0">
                <img
                  src={sl.image_url}
                  alt={sl.alt_text || label || ''}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>

          {/* Navegación por mitades (desktop): sin flechas visibles. */}
          <button
            type="button"
            onClick={() => go(current - 1)}
            aria-label="Anterior"
            className="absolute inset-y-0 left-0 w-1/2 cursor-pointer focus:outline-none"
          />
          <button
            type="button"
            onClick={() => go(current + 1)}
            aria-label="Siguiente"
            className="absolute inset-y-0 right-0 w-1/2 cursor-pointer focus:outline-none"
          />

          {/* Dots dentro del frame, arriba sobre la imagen. */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Ir al slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === current ? 'w-4 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
