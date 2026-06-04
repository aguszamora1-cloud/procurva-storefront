import { useMemo, useState } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { ProductGrid, ProductGridSkeleton } from '@/components/ProductGrid';
import { availableSizes, productCategories, sortSizes } from '@/lib/utils';

export function ProductList() {
  const { products, isLoading } = useProducts();
  const { categories } = useCategories(products);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activeSize, setActiveSize] = useState<string | null>(null);

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => availableSizes(p).forEach((s) => set.add(s)));
    return sortSizes(Array.from(set));
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (activeCat && !productCategories(p).includes(activeCat)) return false;
      if (activeSize && !availableSizes(p).includes(activeSize)) return false;
      return true;
    });
  }, [products, activeCat, activeSize]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8">
        <p className="subtitle-label text-muted">Catálogo</p>
        <h1 className="text-3xl md:text-4xl">Todos los productos</h1>
      </header>

      {/* Filtros */}
      <div className="mb-8 flex flex-col gap-4">
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <FilterChip active={!activeCat} onClick={() => setActiveCat(null)}>
              Todas
            </FilterChip>
            {categories.map((c) => (
              <FilterChip
                key={c.name}
                active={activeCat === c.name}
                onClick={() => setActiveCat(activeCat === c.name ? null : c.name)}
              >
                {c.name}
              </FilterChip>
            ))}
          </div>
        )}
        {allSizes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allSizes.map((s) => (
              <FilterChip
                key={s}
                active={activeSize === s}
                onClick={() => setActiveSize(activeSize === s ? null : s)}
              >
                {s}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {isLoading ? <ProductGridSkeleton /> : <ProductGrid products={filtered} />}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
        active ? 'border-accent bg-accent text-[var(--color-on-accent)]' : 'border-line text-text hover:border-accent'
      }`}
    >
      {children}
    </button>
  );
}
