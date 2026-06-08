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

/** Banner custom: 1 imagen = estático; 2+ = carrusel (sin librerías). */
export function CustomBannerSection({ section }: { section: CustomSection }) {
  const content = section.content as CustomSectionBannerContent;
  const slides = useMemo(() => getSlides(content), [content]);
  const count = slides.length;

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  // Sólo cargamos la imagen actual y sus adyacentes (lazy).
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0, 1, count > 1 ? count - 1 : 0]));
  const touchStartX = useRef<number | null>(null);

  const autoplay = content.autoplay ?? true;
  const intervalMs = Math.max(2, content.interval_seconds ?? 5) * 1000;

  const go = (next: number) => {
    const idx = ((next % count) + count) % count;
    setCurrent(idx);
    setLoaded((prev) => new Set(prev).add(idx).add((idx + 1) % count).add((idx - 1 + count) % count));
  };

  useEffect(() => {
    if (count <= 1 || !autoplay || paused) return;
    const t = setInterval(() => go(current + 1), intervalMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, autoplay, paused, current, intervalMs]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
    touchStartX.current = null;
  };

  if (count === 0) return null;

  // 1 imagen → estático.
  if (count === 1) {
    return (
      <section className="w-full">
        <Slide slide={slides[0]} label={section.label} load />
      </section>
    );
  }

  // 2+ → carrusel.
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
            <Slide slide={sl} label={section.label} load={loaded.has(i)} />
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
