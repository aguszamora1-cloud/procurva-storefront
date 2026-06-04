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
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8">
        <Link to="/categorias" className="subtitle-label text-muted hover:text-accent">
          ← Categorías
        </Link>
        <h1 className="mt-1 text-3xl md:text-4xl">{category}</h1>
      </header>
      {isLoading ? <ProductGridSkeleton /> : <ProductGrid products={filtered} />}
    </div>
  );
}
