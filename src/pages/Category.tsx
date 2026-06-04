import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { ProductGrid, ProductGridSkeleton } from '@/components/ProductGrid';
import { productCategories } from '@/lib/utils';

export function Category() {
  const { name } = useParams<{ name: string }>();
  const category = decodeURIComponent(name ?? '');
  const { products, isLoading } = useProducts();

  const filtered = useMemo(
    () => products.filter((p) => productCategories(p).includes(category)),
    [products, category],
  );

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 md:py-14">
      <header className="mb-8">
        <Link to="/categorias" className="text-[11px] font-semibold uppercase tracking-[2px] text-subtle hover:text-accent">
          ← Categorías
        </Link>
        <h1 className="mt-2 font-heading text-[32px] font-semibold uppercase tracking-[1px] text-text md:text-[44px]">
          {category}
        </h1>
      </header>
      {isLoading ? <ProductGridSkeleton /> : <ProductGrid products={filtered} />}
    </div>
  );
}
