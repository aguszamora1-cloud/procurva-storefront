import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '@/lib/types';
import { categoryGridCols, mainImage, productCategories } from '@/lib/utils';
import { useCategories } from '@/hooks/useCategories';
import { useStore } from '@/context/StoreProvider';
import { SectionHeader } from '@/components/SectionHeader';

function categoryImage(products: Product[], category: string): string | null {
  const p = products.find((prod) => productCategories(prod).includes(category));
  return p ? mainImage(p) : null;
}

/** Tarjeta de categoría (imagen + nombre sobre degradado). */
function CategoryTile({ cat, products, className = '' }: { cat: { name: string }; products: Product[]; className?: string }) {
  const img = categoryImage(products, cat.name);
  return (
    <Link
      to={`/categoria/${encodeURIComponent(cat.name)}`}
      className={`group relative aspect-square overflow-hidden bg-secondary ${className}`}
    >
      {img && (
        <img
          src={img}
          alt={cat.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/65 via-black/10 to-transparent p-4">
        <span className="font-heading text-[15px] font-bold uppercase tracking-[0.5px] text-white md:text-[17px]">
          {cat.name}
        </span>
      </div>
    </Link>
  );
}

export function CategoriesSection({ products }: { products: Product[] }) {
  const { categories } = useCategories(products);
  const { categoriesDisplayMode } = useStore();
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (categories.length === 0) return null;
  const shown = categories.slice(0, 8);

  const scrollByDir = (dir: number) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section className="mx-auto max-w-none px-6 py-10 md:py-24">
      <SectionHeader label="Explorá" title="Categorías" linkTo="/categorias" linkText="Ver todas" />

      {categoriesDisplayMode === 'carousel' ? (
        <div className="relative">
          {/* Fila horizontal: swipe en mobile, flechas en desktop. */}
          <div
            ref={scrollerRef}
            className="flex gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 lg:gap-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {shown.map((cat) => (
              <CategoryTile
                key={cat.name}
                cat={cat}
                products={products}
                className="w-[46%] shrink-0 snap-start sm:w-[240px]"
              />
            ))}
          </div>

          {/* Flechas — sólo desktop. */}
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
        </div>
      ) : (
        <div className={`grid gap-2 lg:gap-5 ${categoryGridCols(shown.length)}`}>
          {shown.map((cat) => (
            <CategoryTile key={cat.name} cat={cat} products={products} />
          ))}
        </div>
      )}
    </section>
  );
}
