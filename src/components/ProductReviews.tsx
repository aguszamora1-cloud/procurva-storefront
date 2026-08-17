import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ReviewCard, Stars } from '@/components/ReviewCard';
import { useTestimonials } from '@/hooks/useTestimonials';

/**
 * Reseñas en la página de detalle del producto (Extra PRO). Para que sirvan de
 * social proof, son las MISMAS reseñas que el comercio carga para el home
 * (testimonios company-wide del catálogo activo), no reseñas por producto. Se
 * renderiza sólo si hay testimonios activos. El gating de plan/section lo hace el caller.
 *
 * Carrusel horizontal con deslizamiento continuo (tipo cinta), igual que el
 * social proof del home: avanza solo, en loop sin corte, y se pausa al interactuar.
 */
export function ProductReviews({
  title,
  variant = 'section',
  display,
}: {
  title?: string;
  variant?: 'section' | 'column';
  /**
   * Cómo se muestran. `undefined` = lo que le queda mejor a cada zona: carrusel
   * a ancho completo, apiladas en la columna. El comercio puede forzar una u
   * otra desde el editor.
   */
  display?: 'carousel' | 'stack';
}) {
  const { testimonials: reviews } = useTestimonials();
  const column = variant === 'column';
  const stacked = (display ?? (column ? 'stack' : 'carousel')) === 'stack';
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

  // Decidimos si animar: más de una reseña, sin "reducir movimiento", y sólo en
  // el carrusel a ancho completo. En la columna el deslizamiento automático
  // pelea con el scroll de la página justo al lado del botón de comprar; ahí el
  // carrusel se pasa con el dedo y listo. Apiladas no hay nada que animar.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setAnimate(reviews.length > 1 && !reduce && !stacked && !column);
  }, [reviews.length, stacked, column]);

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

  // Flechas de desktop. Se muestran según el overflow REAL del scroller, no
  // contando reseñas: cuántas entran depende del ancho (3 a ancho completo, una
  // en la columna) y del largo de cada texto, así que un `length > 3` acertaría
  // en el home y fallaría en la columna, que es justo donde se notó que faltaban.
  const [canScroll, setCanScroll] = useState(false);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || stacked) {
      setCanScroll(false);
      return;
    }
    const measure = () => setCanScroll(el.scrollWidth > el.clientWidth + 8);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stacked, column, reviews.length]);

  // Un paso = una tarjeta en la columna (con snap, saltar de a media tarjeta
  // deja todo torcido) y ~80% del ancho visible a ancho completo.
  const scrollByDir = (dir: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const step = column && card ? card.offsetWidth + 8 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  // No hace falta resincronizar `posRef` acá: para clickear la flecha el puntero
  // ya está encima del carrusel, y con `pausedRef` en true el tick lee la
  // posición del DOM en cada frame. Si la forzáramos al destino, la cinta
  // pelearía contra el scroll suave.
  const arrows = (size: 'sm' | 'md') => {
    if (!canScroll) return null;
    const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
    const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
    const cls = `absolute top-1/2 z-10 hidden ${box} -translate-y-1/2 items-center justify-center rounded-full border border-line bg-background text-on-surface shadow-card-hover transition-colors hover:text-accent md:flex`;
    return (
      <>
        <button type="button" aria-label="Anterior" onClick={() => scrollByDir(-1)} className={`${cls} left-1`}>
          <ChevronLeft className={icon} />
        </button>
        <button type="button" aria-label="Siguiente" onClick={() => scrollByDir(1)} className={`${cls} right-1`}>
          <ChevronRight className={icon} />
        </button>
      </>
    );
  };

  if (reviews.length === 0) return null;

  const rounded = Math.round(average);
  const avgLabel = average.toFixed(average % 1 === 0 ? 0 : 1);

  const heading = (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${column ? 'mb-3' : 'mb-4'}`}>
      <p
        className={
          column
            ? 'text-[calc(13px_*_var(--font-scale,1))] font-semibold text-muted'
            : 'text-[calc(12px_*_var(--font-scale,1))] font-semibold uppercase tracking-[0.06em] text-muted'
        }
      >
        {title?.trim() || 'Opiniones de clientes'}
      </p>
      <div className={`flex items-center ${column ? 'gap-1.5' : 'gap-2'}`}>
        <Stars value={rounded} size={column ? 13 : 15} />
        <span className="text-[calc(13px_*_var(--font-scale,1))] font-semibold text-text">{avgLabel}</span>
      </div>
    </div>
  );

  // APILADAS: una abajo de la otra. A ancho completo se limita el ancho de la
  // lista — una tarjeta de testimonio estirada a 1200px se vuelve ilegible
  // (renglones larguísimos), que es lo contrario de lo que busca apilarlas.
  if (stacked) {
    return (
      <section className={column ? '' : 'border-t border-line pt-6'}>
        {heading}
        <div className={`space-y-2 ${column ? '' : 'mx-auto max-w-[720px] sm:space-y-3'}`}>
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} compact={column} />
          ))}
        </div>
      </section>
    );
  }

  // CARRUSEL EN LA COLUMNA: se pasa con el dedo, sin deslizamiento automático
  // (ver el useEffect de `animate`). Una tarjeta por vista con la siguiente
  // asomando, para que se note que hay más.
  if (column) {
    return (
      <section>
        {heading}
        <div className="relative">
          <div ref={scrollerRef} className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
            {reviews.map((r) => (
              <div key={r.id} className="w-[86%] shrink-0 snap-start">
                <ReviewCard review={r} compact />
              </div>
            ))}
          </div>
          {arrows('sm')}
        </div>
      </section>
    );
  }

  return (
    <section className="border-t border-line pt-6">
      {heading}

      {/* Carrusel horizontal: deslizamiento continuo (cinta). 80vw en mobile, 2 en tablet, 3 en desktop. */}
      <div
        className="relative"
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
              <ReviewCard review={r} />
            </div>
          ))}
        </div>
        {arrows('md')}
      </div>
    </section>
  );
}
