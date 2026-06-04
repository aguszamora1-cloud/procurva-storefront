import { Link } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { mainImage, productCategories } from '@/lib/utils';
import { ProductGridSkeleton } from '@/components/ProductGrid';

export function CategoriesIndex() {
  const { products, isLoading } = useProducts();
  const { categories } = useCategories(products);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8">
        <p className="subtitle-label text-muted">Explorá</p>
        <h1 className="text-3xl md:text-4xl">Categorías</h1>
      </header>

      {isLoading ? (
        <ProductGridSkeleton />
      ) : categories.length === 0 ? (
        <p className="py-16 text-center text-muted">No hay categorías para mostrar.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat) => {
            const p = products.find((prod) => productCategories(prod).includes(cat.name));
            const img = p ? mainImage(p) : null;
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
                <div className="absolute inset-0 flex flex-col items-start justify-end bg-gradient-to-t from-black/55 to-transparent p-4">
                  <span className="font-heading text-sm font-bold uppercase tracking-wide text-white">
                    {cat.name}
                  </span>
                  <span className="text-xs text-white/70">{cat.count} productos</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
