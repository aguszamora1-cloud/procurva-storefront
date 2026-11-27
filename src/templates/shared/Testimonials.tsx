/**
 * FIN0 · Testimonios del home dentro de una plantilla (por ahora, Distrito).
 *
 * Los MISMOS datos que la sección de Classic (useTestimonials: los testimonios que
 * el comercio cargó para esta tienda, activos y en su orden) y el mismo título
 * (sectionHeadings.social_proof). Cambia la forma de recorrerlos:
 *  - Classic los pasa como una cinta que avanza sola, con la primera tarjeta
 *    cortada y flechas encima de las tarjetas. Acá no se mueven solos: se
 *    deslizan con el dedo o con las flechas, que están FUERA de las tarjetas y se
 *    apagan en cada extremo. Si entran todas, no hay flechas ni tarjetas cortadas.
 *  - Una tarjeta asoma cortada sólo cuando hay más para ver (el borde indica que
 *    se puede deslizar) y siempre con las flechas a la vista.
 *  - Estrellas sólo si el comercio cargó una calificación: un testimonio sin
 *    calificación no se muestra como «5 estrellas» (ReviewCard de Classic sí).
 * No es una reseña verificada: es lo que el comercio publicó como testimonio, y
 * se presenta con su título, sin promedio ni cantidad.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import { useTestimonials } from '@/hooks/useTestimonials';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase('es'))
    .join('');
}

export function TemplateTestimonials() {
  const { sectionHeadings } = useStore();
  const heading = sectionHeadings.social_proof;
  const { testimonials } = useTestimonials();
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<{ start: boolean; end: boolean; overflow: boolean }>({ start: true, end: false, overflow: false });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 4;
    setEdge({ overflow, start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    measure();
    const el = track.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, testimonials.length]);

  const move = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const step = card ? card.getBoundingClientRect().width + gap : el.clientWidth;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  if (testimonials.length === 0) return null;
  const title = heading?.title?.trim();

  return (
    <section className="tpl-tst" aria-label={title || 'Testimonios'}>
      <div className="tpl-tst__head">
        <div>
          {title && heading?.label && <p className="tpl-tst__label">{heading.label}</p>}
          {title && <h2 className="tpl-tst__title">{title}</h2>}
        </div>
        {edge.overflow && (
          <div className="tpl-tst__nav">
            <button type="button" aria-label="Testimonios anteriores" disabled={edge.start} onClick={() => move(-1)}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <button type="button" aria-label="Más testimonios" disabled={edge.end} onClick={() => move(1)}>
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <div ref={track} className="tpl-tst__track" onScroll={measure} data-overflow={edge.overflow || undefined}>
        {testimonials.map((t) => (
          <figure key={t.id} className="tpl-tst__card">
            {t.rating != null && t.rating > 0 && (
              <p className="tpl-tst__stars" aria-label={`${t.rating} de 5`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} aria-hidden="true" data-on={i < Math.round(t.rating!) || undefined} />
                ))}
              </p>
            )}
            <blockquote className="tpl-tst__text">{t.text}</blockquote>
            <figcaption className="tpl-tst__who">
              {t.customer_photo_url ? (
                <img src={t.customer_photo_url} alt="" className="tpl-tst__avatar" loading="lazy" />
              ) : (
                <span className="tpl-tst__avatar" aria-hidden="true">
                  {initials(t.customer_name)}
                </span>
              )}
              <span>{t.customer_name}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
