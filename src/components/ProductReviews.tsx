import { useEffect, useMemo, useRef, useState } from 'react';
import { useTestimonials } from '@/hooks/useTestimonials';
import type { Testimonial } from '@/lib/types';

const initials = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-0.5 leading-none" style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? 'text-amber-400' : 'text-line'}>
          ★
        </span>
      ))}
    </div>
  );
}

function ReviewCard({ r }: { r: Testimonial }) {
  return (
    <article className="flex h-full flex-col gap-3 border border-line bg-[var(--color-background)] p-5">
      <Stars value={r.rating ?? 5} />
      <p className="flex-1 text-[14px] leading-relaxed text-text">“{r.text}”</p>
      <div className="mt-1 flex items-center gap-3">
        {r.customer_photo_url ? (
          <img src={r.customer_photo_url} alt={r.customer_name} loading="lazy" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-text">
            {initials(r.customer_name)}
          </span>
        )}
        <span className="text-[12px] font-semibold uppercase tracking-[0.5px] text-text">{r.customer_name}</span>
      </div>
    </article>
  );
}

/**
 * Reseñas en la página de detalle del producto (Extra PRO). Para que sirvan de
 * social proof, son las MISMAS reseñas que el comercio carga para el home
 * (testimonios company-wide del catálogo activo), no reseñas por producto. Se
 * renderiza sólo si hay testimonios activos. El gating de plan/section lo hace el caller.
 *
 * Carrusel horizontal con deslizamiento continuo (tipo cinta), igual que el
 * social proof del home: avanza solo, en loop sin corte, y se pausa al interactuar.
 */
export function ProductReviews({ title }: { title?: string }) {
  const { testimonials: reviews } = useTestimonials();
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Pausa el auto-scroll mientras el cliente interactúa (hover, swipe, foco).
  const pausedRef = useRef(false);
  // Sólo auto-scrolleamos cuando la sección está visible (no tironea la página).
  const visibleRef = useRef(false);
  // Cuando animamos, duplicamos las reseñas para el loop sin corte visible.
  const [animate, setAnimate] = useState(false);
  // Posición acumulada en JS: en DPR=1 el navegador redondea scrollLeft a enteros
  // y sumar sub-píxeles leyendo del DOM nunca acumularía; llevándola acá, avanza igual.
  const posRef = useRef(0);

  const average = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + (r.rating ?? 5), 0);
    return sum / reviews.length;
  }, [reviews]);

  // Decidimos si animar: más de una reseña y sin "reducir movimiento".
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setAnimate(reviews.length > 1 && !reduce);
  }, [reviews.length]);

  // Deslizamiento continuo con requestAnimationFrame: avanza unos píxeles por
  // frame y al llegar al final del primer set salta exactamente un loop hacia
  // atrás (el 2º set es idéntico → salto invisible). Pausa al interactuar / fuera de vista.
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

  if (reviews.length === 0) return null;

  const rounded = Math.round(average);
  const avgLabel = average.toFixed(average % 1 === 0 ? 0 : 1);

  return (
    <section className="border-t border-line pt-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{title?.trim() || 'Opiniones de clientes'}</p>
        <div className="flex items-center gap-2">
          <Stars value={rounded} />
          <span className="text-[13px] font-semibold text-text">{avgLabel}</span>
        </div>
      </div>

      {/* Carrusel horizontal: deslizamiento continuo (cinta). 80vw en mobile, 2 en tablet, 3 en desktop. */}
      <div
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
        onTouchStart={() => { pausedRef.current = true; }}
        onTouchEnd={() => { pausedRef.current = false; }}
        onFocusCapture={() => { pausedRef.current = true; }}
        onBlurCapture={() => { pausedRef.current = false; }}
      >
        <div
          ref={scrollerRef}
          style={{ touchAction: 'pan-x pan-y' }}
          className={`flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            animate ? '' : 'sm:justify-start'
          }`}
        >
          {/* Cuando animamos duplicamos el set para el loop sin corte (la 2ª copia es decorativa). */}
          {(animate ? [...reviews, ...reviews] : reviews).map((r, i) => (
            <div
              key={`${r.id}-${i}`}
              aria-hidden={i >= reviews.length}
              className="shrink-0 basis-[80vw] sm:basis-[calc((100%-0.75rem)/2)] lg:basis-[calc((100%-1.5rem)/3)]"
            >
              <ReviewCard r={r} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
