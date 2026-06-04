import { Link } from 'react-router-dom';
import type { Product } from '@/lib/types';
import { mainImage, productCategories } from '@/lib/utils';
import { useCategories } from '@/hooks/useCategories';
import { SectionHeader } from '@/components/SectionHeader';

function categoryImage(products: Product[], category: string): string | null {
  const p = products.find((prod) => productCategories(prod).includes(category));
  return p ? mainImage(p) : null;
}

export function CategoriesSection({ products }: { products: Product[] }) {
  const { categories } = useCategories(products);
  if (categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
      <SectionHeader label="Explorá" title="Categorías" linkTo="/categorias" linkText="Ver todas" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
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
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/65 via-black/10 to-transparent p-4">
                <span className="font-heading text-[15px] font-bold uppercase tracking-[0.5px] text-white md:text-[17px]">
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
