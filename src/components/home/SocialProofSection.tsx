import { useEffect, useRef, useState } from 'react';
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
  // Sólo auto-scrolleamos cuando la sección está visible en pantalla, así el
  // scroll nunca "tironea" la página mientras el cliente lee otra parte.
  const visibleRef = useRef(false);
  // Cuando animamos, duplicamos las reseñas para hacer un loop sin corte visible.
  const [animate, setAnimate] = useState(false);
  // Posición acumulada en JS. Clave: en pantallas DPR=1 (la mayoría de los
  // monitores) el navegador redondea `scrollLeft` a enteros, así que sumar
  // sub-píxeles leyendo desde el DOM nunca acumula y el carrusel queda quieto.
  // Llevando la posición acá, el avance es independiente del redondeo.
  const posRef = useRef(0);

  // Decidimos si animar: hace falta más de una reseña y que el cliente no haya
  // pedido "reducir movimiento".
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setAnimate(testimonials.length > 1 && !reduce);
  }, [testimonials.length]);

  // Deslizamiento continuo (tipo cinta) con requestAnimationFrame: avanza unos
  // pocos píxeles por frame en vez de saltar de a una página, y al llegar al
  // final del primer set salta exactamente un loop hacia atrás — como el segundo
  // set es idéntico, el salto es invisible. Pausa al interactuar / fuera de vista.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !animate) return;

    const io = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting; },
      { threshold: 0 },
    );
    io.observe(el);

    const SPEED = 45; // px por segundo
    posRef.current = el.scrollLeft;
    let raf = 0;
    let last = 0;
    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      const prev = last;
      last = ts;
      if (!prev || pausedRef.current || !visibleRef.current || document.hidden) {
        // Mientras está pausado el cliente puede haber hecho swipe: resincronizamos.
        if (pausedRef.current) posRef.current = el.scrollLeft;
        return;
      }
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      // Con dos sets idénticos: el ancho de un loop = (scrollWidth + gap) / 2.
      const loopWidth = (el.scrollWidth + gap) / 2;
      if (loopWidth <= 0) return;
      posRef.current += (SPEED * (ts - prev)) / 1000;
      if (posRef.current >= loopWidth) posRef.current -= loopWidth;
      el.scrollLeft = posRef.current;
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [animate]);

  // Flechas (desktop) sólo cuando hay más reseñas que las visibles (3 en desktop).
  const hasArrows = testimonials.length > 3;

  const scrollByDir = (dir: number) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section className="mx-auto max-w-none px-6 py-8 md:py-16">
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
        {/* Carrusel horizontal: deslizamiento continuo (cinta). 80vw en mobile, 2 en tablet, 3 en desktop. */}
        <div
          ref={scrollerRef}
          style={{ touchAction: 'pan-x pan-y' }}
          className={`flex gap-4 overflow-x-auto pb-2 lg:gap-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            hasArrows || animate ? '' : 'md:justify-center'
          }`}
        >
          {/* Cuando animamos duplicamos el set para el loop sin corte (la 2ª copia es decorativa). */}
          {(animate ? [...testimonials, ...testimonials] : testimonials).map((t, i) => (
            <div
              key={`${t.id}-${i}`}
              aria-hidden={i >= testimonials.length}
              className="shrink-0 basis-[80vw] sm:basis-[calc((100%-1rem)/2)] lg:basis-[calc((100%-2.5rem)/3)]"
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
