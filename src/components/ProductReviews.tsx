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

/** `compact`: versión para la columna de la ficha (menos aire y tipografía más chica). */
function ReviewCard({ r, compact }: { r: Testimonial; compact?: boolean }) {
  return (
    <article className={`flex h-full flex-col border border-line bg-[var(--color-background)] ${compact ? 'gap-2 p-3.5' : 'gap-3 p-5'}`}>
      <Stars value={r.rating ?? 5} size={compact ? 13 : 15} />
      <p className={`flex-1 leading-relaxed text-text ${compact ? 'text-[13px]' : 'text-[14px]'}`}>“{r.text}”</p>
      <div className={`flex items-center ${compact ? 'gap-2' : 'mt-1 gap-3'}`}>
        {r.customer_photo_url ? (
          <img
            src={r.customer_photo_url}
            alt={r.customer_name}
            loading="lazy"
            className={`rounded-full object-cover ${compact ? 'h-7 w-7' : 'h-9 w-9'}`}
          />
        ) : (
          <span
            className={`flex items-center justify-center rounded-full bg-secondary font-semibold text-text ${
              compact ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-[11px]'
            }`}
          >
            {initials(r.customer_name)}
          </span>
        )}
        <span className={`font-semibold uppercase tracking-[0.5px] text-text ${compact ? 'text-[11px]' : 'text-[12px]'}`}>
          {r.customer_name}
        </span>
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
export function ProductReviews({ title, variant = 'section' }: { title?: string; variant?: 'section' | 'column' }) {
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

  // EN LA COLUMNA: una abajo de la otra, sin carrusel. La cinta que se desliza
  // sola funciona a ancho completo, pero en ~400px una tarjeta tapa a la
  // siguiente y el movimiento pelea con el scroll de la página. Acá el
  // deslizamiento no aporta nada: se leen apiladas.
  if (variant === 'column') {
    return (
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-[13px] font-semibold text-muted">{title?.trim() || 'Opiniones de clientes'}</p>
          <div className="flex items-center gap-1.5">
            <Stars value={rounded} size={13} />
            <span className="text-[13px] font-semibold text-text">{avgLabel}</span>
          </div>
        </div>
        <div className="space-y-2">
          {reviews.map((r) => (
            <ReviewCard key={r.id} r={r} compact />
          ))}
        </div>
      </section>
    );
  }

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
