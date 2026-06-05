import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { useStore } from '@/context/StoreProvider';
import { ProductGrid, ProductGridSkeleton } from '@/components/ProductGrid';
import { InlineError } from '@/components/ErrorScreen';
import { Seo } from '@/components/Seo';
import { productCategories } from '@/lib/utils';

export function Category() {
  const { name } = useParams<{ name: string }>();
  const category = decodeURIComponent(name ?? '');
  const { products, isLoading, error, reload } = useProducts();
  const config = useStore();

  const filtered = useMemo(
    () => products.filter((p) => productCategories(p).includes(category)),
    [products, category],
  );

  return (
    <div className="mx-auto max-w-none px-6 py-10 md:py-14">
      <Seo
        title={`${category} · ${config.name}`}
        description={config.metaDescription || `${category} — productos de ${config.name}.`}
        image={config.ogImageUrl}
        slug={config.slug}
        siteName={config.name}
      />
      <header className="mb-8">
        <Link to="/categorias" className="text-[11px] font-semibold uppercase tracking-[2px] text-subtle hover:text-accent">
          ← Categorías
        </Link>
        <h1 className="mt-2 font-heading text-[32px] font-semibold uppercase tracking-[1px] text-text md:text-[44px]">
          {category}
        </h1>
      </header>
      {isLoading ? (
        <ProductGridSkeleton />
      ) : error ? (
        <InlineError message="No pudimos cargar los productos." onRetry={reload} />
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-[14px] text-subtle">
          No hay productos disponibles en esta categoría.
        </p>
      ) : (
        <ProductGrid products={filtered} />
      )}
    </div>
  );
}
