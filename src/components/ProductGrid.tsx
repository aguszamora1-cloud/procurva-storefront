import type { Product } from '@/lib/types';
import { ProductCard } from './ProductCard';

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <p className="py-16 text-center text-muted">No hay productos para mostrar.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

/** Skeleton para grillas en carga. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col">
          <div className="aspect-[4/5] animate-pulse bg-secondary" />
          <div className="mt-3 h-3 w-3/4 animate-pulse bg-secondary" />
          <div className="mt-2 h-3 w-1/3 animate-pulse bg-secondary" />
        </div>
      ))}
    </div>
  );
}
