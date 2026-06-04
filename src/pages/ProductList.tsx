import { useMemo, useState } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useStore } from '@/context/StoreProvider';
import { ProductGrid, ProductGridSkeleton } from '@/components/ProductGrid';
import { InlineError } from '@/components/ErrorScreen';
import { Seo } from '@/components/Seo';
import { availableSizes, productCategories, sortSizes } from '@/lib/utils';

export function ProductList() {
  const { products, isLoading, error, reload } = useProducts();
  const config = useStore();
  const { categories } = useCategories(products);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activeSize, setActiveSize] = useState<string | null>(null);

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => availableSizes(p).forEach((s) => set.add(s)));
    return sortSizes(Array.from(set));
  }, [products]);

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        if (activeCat && !productCategories(p).includes(activeCat)) return false;
        if (activeSize && !availableSizes(p).includes(activeSize)) return false;
        return true;
      }),
    [products, activeCat, activeSize],
  );

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 md:py-14">
      <Seo
        title={`Productos · ${config.name}`}
        description={config.metaDescription || `Todos los productos de ${config.name}.`}
        image={config.ogImageUrl}
        slug={config.slug}
        siteName={config.name}
      />
      <header className="mb-8">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[2px] text-accent">Catálogo</p>
        <h1 className="font-heading text-[32px] font-semibold uppercase tracking-[1px] text-text md:text-[44px]">
          Todos los productos
        </h1>
      </header>

      <div className="mb-10 flex flex-col gap-4">
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <FilterChip active={!activeCat} onClick={() => setActiveCat(null)}>Todas</FilterChip>
            {categories.map((c) => (
              <FilterChip key={c.name} active={activeCat === c.name} onClick={() => setActiveCat(activeCat === c.name ? null : c.name)}>
                {c.name}
              </FilterChip>
            ))}
          </div>
        )}
        {allSizes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allSizes.map((s) => (
              <FilterChip key={s} active={activeSize === s} onClick={() => setActiveSize(activeSize === s ? null : s)}>
                {s}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <ProductGridSkeleton />
      ) : error ? (
        <InlineError message="No pudimos cargar los productos." onRetry={reload} />
      ) : (
        <ProductGrid products={filtered} />
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.5px] transition-colors ${
        active ? 'border-text bg-primary text-on-primary' : 'border-line text-muted hover:border-text hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}
