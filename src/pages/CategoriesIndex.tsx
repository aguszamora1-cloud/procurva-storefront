import { Link } from 'react-router-dom';
import { Tag } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useStore } from '@/context/StoreProvider';
import { categoryGridCols, mainImage, productCategories } from '@/lib/utils';
import { ProductGridSkeleton } from '@/components/ProductGrid';
import { InlineError } from '@/components/ErrorScreen';
import { Seo } from '@/components/Seo';
import { StoreImage } from '@/components/StoreImage';

export function CategoriesIndex() {
  const { products, isLoading, error, reload } = useProducts();
  const { categories } = useCategories(products);
  const config = useStore();

  return (
    <div className="mx-auto max-w-none px-6 py-10 md:py-14">
      <Seo
        title={`Categorías · ${config.name}`}
        description={config.metaDescription || `Explorá las categorías de ${config.name}.`}
        image={config.ogImageUrl}
        slug={config.slug}
        siteName={config.name}
      />
      <header className="mb-8">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[2px] text-accent">Explorá</p>
        <h1 className="font-heading text-[32px] font-semibold uppercase tracking-[1px] text-text md:text-[44px]">Categorías</h1>
      </header>

      {isLoading ? (
        <ProductGridSkeleton />
      ) : error ? (
        <InlineError message="No pudimos cargar las categorías." onRetry={reload} />
      ) : categories.length === 0 ? (
        <p className="py-16 text-center text-[14px] text-subtle">No hay categorías para mostrar.</p>
      ) : (
        <div className={`grid gap-2 lg:gap-5 ${categoryGridCols(categories.length)}`}>
          {categories.map((cat) => {
            const p = products.find((prod) => productCategories(prod).includes(cat.name));
            const img = cat.imageUrl ?? (p ? mainImage(p) : null);
            return (
              <Link
                key={cat.name}
                to={`/categoria/${encodeURIComponent(cat.name)}`}
                className="group relative aspect-square max-h-[55vw] sm:max-h-[320px] lg:max-h-[380px] overflow-hidden bg-secondary"
              >
                {img ? (
                  <StoreImage
                    src={img}
                    alt={cat.name}
                    transformWidth={600}
                    width={600}
                    height={600}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Tag className="h-8 w-8 text-on-surface/15" />
                  </div>
                )}
                <div className="absolute inset-0 flex flex-col items-start justify-end bg-gradient-to-t from-black/65 via-black/10 to-transparent p-4">
                  <span className="font-heading text-[15px] font-bold uppercase tracking-[0.5px] text-white md:text-[17px]">
                    {cat.name}
                  </span>
                  <span className="text-[12px] text-white/70">{cat.count} productos</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
