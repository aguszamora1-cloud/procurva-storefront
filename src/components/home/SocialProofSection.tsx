import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SectionHeader } from '@/components/SectionHeader';
import { useTestimonials } from '@/hooks/useTestimonials';
import type { Testimonial } from '@/lib/types';

const initials = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5 text-[15px] leading-none">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? 'text-amber-400' : 'text-line'}>
          ★
        </span>
      ))}
    </div>
  );
}

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <article className="flex h-full flex-col gap-4 border border-line bg-[var(--color-background)] p-6">
      <Stars value={t.rating ?? 5} />
      <p className="flex-1 text-[14px] leading-relaxed text-text md:text-[15px]">“{t.text}”</p>
      <div className="flex items-center gap-3">
        {t.customer_photo_url ? (
          <img src={t.customer_photo_url} alt={t.customer_name} loading="lazy" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-text">
            {initials(t.customer_name)}
          </span>
        )}
        <span className="text-[13px] font-semibold uppercase tracking-[0.5px] text-text">{t.customer_name}</span>
      </div>
    </article>
  );
}

/** Sección de testimonios / reseñas (Social Proof, Extra PRO). Carrusel horizontal. */
export function SocialProofSection() {
  const { testimonials } = useTestimonials();
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Pausa el auto-scroll mientras el cliente interactúa (hover, swipe, foco).
  const pausedRef = useRef(false);

  // Auto-scroll: avanza solo cada 3.5s y vuelve al inicio al llegar al final.
  // Respeta "prefers-reduced-motion" y pausa al interactuar.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || testimonials.length <= 1) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      // Sin overflow (todas las reseñas entran en pantalla) → no scrollear.
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 1) return;
      const atEnd = el.scrollLeft >= maxScroll - 1;
      if (atEnd) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: el.clientWidth * 0.8, behavior: 'smooth' });
      }
    }, 3500);

    return () => window.clearInterval(id);
  }, [testimonials.length]);

  // Flechas (desktop) sólo cuando hay más reseñas que las visibles (3 en desktop).
  const hasArrows = testimonials.length > 3;

  const scrollByDir = (dir: number) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section className="mx-auto max-w-none px-6 py-10 md:py-24">
      <SectionHeader label="Lo que dicen" title="Reseñas de clientes" />
      <div
        className="relative"
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
        onTouchStart={() => { pausedRef.current = true; }}
        onTouchEnd={() => { pausedRef.current = false; }}
        onFocusCapture={() => { pausedRef.current = true; }}
        onBlurCapture={() => { pausedRef.current = false; }}
      >
        {/* Carrusel horizontal swipeable: 80vw en mobile (con peek + snap), 2 en tablet, 3 en desktop. */}
        <div
          ref={scrollerRef}
          style={{ touchAction: 'pan-x' }}
          className={`flex touch-pan-x snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 lg:gap-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            hasArrows ? '' : 'md:justify-center'
          }`}
        >
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="shrink-0 snap-center sm:snap-start basis-[80vw] sm:basis-[calc((100%-1rem)/2)] lg:basis-[calc((100%-2.5rem)/3)]"
            >
              <TestimonialCard t={t} />
            </div>
          ))}
        </div>

        {/* Flechas — sólo si hay más de 3 y en desktop (en mobile: swipe). */}
        {hasArrows && (
          <>
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => scrollByDir(-1)}
              className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-background text-on-surface shadow-card-hover transition-colors hover:text-accent md:flex"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Siguiente"
              onClick={() => scrollByDir(1)}
              className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-background text-on-surface shadow-card-hover transition-colors hover:text-accent md:flex"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
