import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import type { Product } from '@/lib/types';
import { mainImage, productCategories } from '@/lib/utils';
import { useCategories, type CategoryInfo } from '@/hooks/useCategories';
import { useStore } from '@/context/StoreProvider';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { SectionHeader } from '@/components/SectionHeader';

export type CardStyle = 'overlay' | 'below' | 'full';

function categoryImage(products: Product[], category: string): string | null {
  const p = products.find((prod) => productCategories(prod).includes(category));
  return p ? mainImage(p) : null;
}

// Columnas en desktop según la config del comercio; en mobile SIEMPRE 2. Clases
// literales para que Tailwind las detecte en build.
export const COLS_CLASS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
};

/**
 * Ancho de cada card DEL CARRUSEL en desktop: las mismas columnas que la grilla,
 * repartiendo el ancho real de la fila (100% menos los gap-3 = 12px que quedan
 * entre columnas). Antes era un `sm:w-[240px]` fijo, y con pocas categorías la
 * fila terminaba a media pantalla: media portada en blanco y la config de
 * columnas sin ningún efecto en modo carrusel.
 *
 * En mobile son siempre ~2 con un asomo de la tercera: ese recorte es el aviso
 * de que la fila sigue. Clases literales para que Tailwind las vea en el build;
 * los `_` son los espacios que exige `calc`.
 */
const CAROUSEL_ITEM_CLASS: Record<2 | 3 | 4, string> = {
  2: 'basis-[46%] md:basis-[calc((100%_-_12px)_/_2)]',
  3: 'basis-[46%] md:basis-[calc((100%_-_24px)_/_3)]',
  4: 'basis-[46%] md:basis-[calc((100%_-_36px)_/_4)]',
};

// Degradado del estilo "overlay": oscuro abajo, transparente arriba del 55%.
const OVERLAY_GRADIENT = 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 55%)';

/** Imagen de la card (con hover-zoom) o placeholder si la categoría no tiene foto. */
function CardImage({ img, name }: { img: string | null; name: string }) {
  if (!img) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-secondary">
        <Tag className="h-8 w-8 text-on-surface/15" />
      </div>
    );
  }
  return (
    <img
      src={img}
      alt={name}
      loading="lazy"
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );
}

/**
 * Tarjeta de categoría. El nombre SIEMPRE sale de la categoría real (no hay
 * override de texto). La imagen es la propia (catalog_category_order.image_url)
 * o, si no hay, la foto del primer producto de la categoría.
 */
export function CategoryCard({
  cat,
  products,
  style,
  className = '',
}: {
  cat: CategoryInfo;
  products: Product[];
  style: CardStyle;
  className?: string;
}) {
  const img = cat.imageUrl ?? categoryImage(products, cat.name);
  const to = `/categoria/${encodeURIComponent(cat.name)}`;
  const base = `group block overflow-hidden rounded-xl bg-secondary ${className}`;

  // Texto debajo: imagen arriba + franja con el nombre (fondo surface, borde sutil).
  if (style === 'below') {
    return (
      <Link to={to} className={`${base} border border-line`}>
        <div className="relative aspect-square overflow-hidden">
          <CardImage img={img} name={cat.name} />
        </div>
        <div className="px-3 py-2.5">
          <span className="font-heading text-[13px] font-medium uppercase tracking-[0.5px] text-on-surface md:text-[15px]">
            {cat.name}
          </span>
        </div>
      </Link>
    );
  }

  // Pantalla completa: overlay oscuro parejo + nombre centrado grande.
  if (style === 'full') {
    return (
      <Link to={to} className={`relative aspect-square ${base}`}>
        <CardImage img={img} name={cat.name} />
        <div
          className="absolute inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.35)' }}
        >
          <span className="text-center font-heading text-[18px] font-bold uppercase leading-tight tracking-[1px] text-white md:text-[24px]">
            {cat.name}
          </span>
        </div>
      </Link>
    );
  }

  // Overlay (default): degradado abajo + nombre abajo-izquierda.
  return (
    <Link to={to} className={`relative aspect-square ${base}`}>
      <CardImage img={img} name={cat.name} />
      <div className="absolute inset-0" style={{ background: OVERLAY_GRADIENT }} />
      <span className="absolute bottom-3 left-3 right-3 font-heading text-[14px] font-medium uppercase tracking-[0.5px] text-white md:text-[16px]">
        {cat.name}
      </span>
    </Link>
  );
}

export function CategoriesSection({ products }: { products: Product[] }) {
  const { categories, isLoading } = useCategories(products);
  const { categoriesDisplayMode, categoriesSection, sectionHeadings } = useStore();
  const scrollerRef = useRef<HTMLDivElement>(null);
  // ¿La fila sobra del ancho visible? Se mide en vez de contar cards: cuántas
  // entran depende del breakpoint y de las columnas configuradas, y con flechas
  // sobre un carrusel que no scrollea el visitante hace clic y no pasa nada.
  const [canScroll, setCanScroll] = useState(false);

  // Gate del primer paint: el orden/visibilidad de categorías es otro fetch, y
  // sin esperarlo la fila de categorías aparecía suelta después del navbar.
  useFirstPaintGate('home-categories', isLoading);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => setCanScroll(el.scrollWidth - el.clientWidth > 8);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [categories.length, categoriesDisplayMode, categoriesSection.columns]);

  if (categories.length === 0) return null;
  const shown = categories.slice(0, 8);
  const style = categoriesSection.cardStyle;

  const scrollByDir = (dir: number) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section className="mx-auto max-w-none px-6 py-8 md:py-16">
      <SectionHeader {...sectionHeadings.categories} linkTo="/categorias" linkText="Ver todas" />

      {categoriesDisplayMode === 'carousel' ? (
        <div className="relative">
          {/* Fila horizontal: swipe + flechas, también en mobile. */}
          <div
            ref={scrollerRef}
            className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {shown.map((cat) => (
              <CategoryCard
                key={cat.name}
                cat={cat}
                products={products}
                style={style}
                className={`shrink-0 grow-0 snap-start ${CAROUSEL_ITEM_CLASS[categoriesSection.columns]}`}
              />
            ))}
          </div>

          {/* Flechas. También en mobile: el swipe es descubrible sólo si algo
              avisa que la fila sigue, y la card cortada al borde no alcanza —
              se lee como un error de layout. Más chicas en mobile (36px) para
              no tapar la card de abajo. Sólo si la fila realmente scrollea. */}
          {canScroll && (
            <>
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => scrollByDir(-1)}
                className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-background-a90 text-on-surface shadow-card-hover backdrop-blur transition-colors hover:text-accent md:h-10 md:w-10 md:bg-background"
              >
                <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
              </button>
              <button
                type="button"
                aria-label="Siguiente"
                onClick={() => scrollByDir(1)}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-background-a90 text-on-surface shadow-card-hover backdrop-blur transition-colors hover:text-accent md:h-10 md:w-10 md:bg-background"
              >
                <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
              </button>
            </>
          )}
        </div>
      ) : (
        // Grid: gap fijo de 12px (gap-3); columnas configurables en desktop, 2 en mobile.
        <div className={`grid gap-3 ${COLS_CLASS[categoriesSection.columns]}`}>
          {shown.map((cat) => (
            <CategoryCard key={cat.name} cat={cat} products={products} style={style} />
          ))}
        </div>
      )}
    </section>
  );
}
