import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Fila horizontal scrolleable con flechas: swipe en mobile, flechas en desktop.
 *
 * Nació adentro de CategoriesSection y se extrajo cuando las secciones de
 * productos del home ganaron el mismo modo carrusel. La medición del overflow
 * (¿la fila realmente scrollea?) y las flechas son idénticas en las dos, y
 * duplicarlas garantizaba que se fueran separando a la primera corrección.
 *
 * Quien la usa pone el ancho de cada ítem (`shrink-0 grow-0 basis-…`): cuántas
 * cards entran depende de la sección, no del carrusel.
 */
export function CarouselRow({ children, gapClass = 'gap-3' }: { children: ReactNode; gapClass?: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  // ¿La fila sobra del ancho visible? Se MIDE en vez de contar ítems: cuántos
  // entran depende del breakpoint y del ancho que le puso quien la usa, y unas
  // flechas sobre un carrusel que no scrollea son un clic que no hace nada.
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => setCanScroll(el.scrollWidth - el.clientWidth > 8);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // También los hijos: si cambia la cantidad de cards, el scrollWidth cambia
    // sin que cambie el tamaño del contenedor.
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [children]);

  const scrollByDir = (dir: number) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const arrowCls =
    'absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-background-a90 text-on-surface shadow-card-hover backdrop-blur transition-colors hover:text-accent md:h-10 md:w-10 md:bg-background';

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className={`flex ${gapClass} overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
      >
        {children}
      </div>

      {/* Flechas también en mobile: el swipe es descubrible sólo si algo avisa
          que la fila sigue, y la card cortada al borde no alcanza — se lee como
          un error de layout. Más chicas en mobile (36px) para no tapar la card. */}
      {canScroll && (
        <>
          <button type="button" aria-label="Anterior" onClick={() => scrollByDir(-1)} className={`${arrowCls} left-2`}>
            <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
          </button>
          <button type="button" aria-label="Siguiente" onClick={() => scrollByDir(1)} className={`${arrowCls} right-2`}>
            <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
          </button>
        </>
      )}
    </div>
  );
}
