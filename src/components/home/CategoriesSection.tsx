import { Link } from 'react-router-dom';
import type { Product } from '@/lib/types';
import { mainImage, productCategories } from '@/lib/utils';
import { useCategories } from '@/hooks/useCategories';
import { SectionHeader } from '@/components/SectionHeader';

/** Imagen representativa de una categoría: la del primer producto que la tiene. */
function categoryImage(products: Product[], category: string): string | null {
  const p = products.find((prod) => productCategories(prod).includes(category));
  return p ? mainImage(p) : null;
}

export function CategoriesSection({ products }: { products: Product[] }) {
  const { categories } = useCategories(products);
  if (categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <SectionHeader label="Explorá" title="Categorías" linkTo="/categorias" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {categories.slice(0, 8).map((cat) => {
          const img = categoryImage(products, cat.name);
          return (
            <Link
              key={cat.name}
              to={`/categoria/${encodeURIComponent(cat.name)}`}
              className="group relative aspect-square overflow-hidden bg-secondary"
            >
              {img && (
                <img
                  src={img}
                  alt={cat.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/55 to-transparent p-4">
                <span className="font-heading text-sm font-bold uppercase tracking-wide text-white">
                  {cat.name}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
