import type { Product } from '@/lib/types';
import { ProductCard } from './ProductCard';

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <p className="py-16 text-center text-[14px] text-subtle">No hay productos para mostrar.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-5">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col border border-line-soft bg-background">
          <div className="aspect-[4/5] animate-pulse bg-secondary" />
          <div className="space-y-2 p-2.5 md:p-4">
            <div className="h-3 w-3/4 animate-pulse bg-secondary" />
            <div className="h-3 w-1/3 animate-pulse bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}
