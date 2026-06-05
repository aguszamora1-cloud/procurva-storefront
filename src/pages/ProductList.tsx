import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useStore } from '@/context/StoreProvider';
import { ProductGrid, ProductGridSkeleton } from '@/components/ProductGrid';
import { ProductFilters } from '@/components/ProductFilters';
import { InlineError } from '@/components/ErrorScreen';
import { Seo } from '@/components/Seo';
import { availableColors, availableSizes, getPriceInfo, productCategories, sortSizes } from '@/lib/utils';

/** Helper para togglear un valor dentro de un Set en el estado. */
const toggleInSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (value: string) =>
  setter((prev) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });

export function ProductList() {
  const { products, isLoading, error, reload } = useProducts();
  const config = useStore();
  const { categories } = useCategories(products);
  const [searchParams] = useSearchParams();
  const preCat = searchParams.get('categoria');

  // La categoría que viene en la URL (?categoria=) queda preseleccionada.
  const [selectedCats, setSelectedCats] = useState<Set<string>>(() => new Set(preCat ? [preCat] : []));
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories]);

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => availableSizes(p).forEach((s) => set.add(s)));
    return sortSizes(Array.from(set));
  }, [products]);

  const allColors = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => availableColors(p).forEach((c) => set.add(c)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [products]);

  const priceBounds = useMemo(() => {
    const prices = products.map((p) => getPriceInfo(p).mainPrice).filter((n) => n > 0);
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [products]);

  const min = priceMin.trim() === '' ? null : Number(priceMin);
  const max = priceMax.trim() === '' ? null : Number(priceMax);

  // Filtros combinados: AND entre tipos de filtro, OR dentro de cada uno.
  const filtered = useMemo(
    () =>
      products.filter((p) => {
        if (selectedCats.size > 0 && !productCategories(p).some((c) => selectedCats.has(c))) return false;
        if (selectedSizes.size > 0 && !availableSizes(p).some((s) => selectedSizes.has(s))) return false;
        if (selectedColors.size > 0 && !availableColors(p).some((c) => selectedColors.has(c))) return false;
        const price = getPriceInfo(p).mainPrice;
        if (min != null && !Number.isNaN(min) && price < min) return false;
        if (max != null && !Number.isNaN(max) && price > max) return false;
        return true;
      }),
    [products, selectedCats, selectedSizes, selectedColors, min, max],
  );

  const activeCount =
    selectedCats.size + selectedSizes.size + selectedColors.size + (min != null || max != null ? 1 : 0);

  const clearAll = () => {
    setSelectedCats(new Set());
    setSelectedSizes(new Set());
    setSelectedColors(new Set());
    setPriceMin('');
    setPriceMax('');
  };

  // Bloquear scroll del body + Escape mientras el drawer de filtros está abierto.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const panelProps = {
    categories: categoryNames,
    sizes: allSizes,
    colors: allColors,
    priceBounds,
    selectedCats,
    selectedSizes,
    selectedColors,
    priceMin,
    priceMax,
    onToggleCat: toggleInSet(setSelectedCats),
    onToggleSize: toggleInSet(setSelectedSizes),
    onToggleColor: toggleInSet(setSelectedColors),
    onPriceMin: setPriceMin,
    onPriceMax: setPriceMax,
  };

  const countLabel = `${filtered.length} ${filtered.length === 1 ? 'producto' : 'productos'}`;

  const clearButton = (
    <button
      type="button"
      onClick={clearAll}
      disabled={activeCount === 0}
      className="text-[12px] font-semibold uppercase tracking-[0.5px] text-on-surface-muted transition-colors hover:text-accent disabled:opacity-40 disabled:hover:text-on-surface-muted"
    >
      Limpiar filtros
    </button>
  );

  return (
    <div className="mx-auto max-w-none px-6 py-10 md:py-14">
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

      <div className="flex gap-8">
        {/* Sidebar de filtros (desktop) */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24">
            <div className="mb-1 flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-[15px] font-bold uppercase tracking-[1px] text-on-surface">Filtros</h2>
              {clearButton}
            </div>
            <ProductFilters {...panelProps} />
          </div>
        </aside>

        {/* Resultados */}
        <div className="min-w-0 flex-1">
          <div className="mb-6 flex items-center justify-between gap-4">
            <p className="text-[13px] text-on-surface-muted">{countLabel}</p>
          </div>

          {isLoading ? (
            <ProductGridSkeleton />
          ) : error ? (
            <InlineError message="No pudimos cargar los productos." onRetry={reload} />
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center text-[14px] text-subtle">No hay productos que coincidan con los filtros.</p>
          ) : (
            <ProductGrid products={filtered} />
          )}
        </div>
      </div>

      {/* Botón "Filtros" flotante (mobile/tablet) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-6 py-3 text-[13px] font-bold uppercase tracking-[0.5px] text-on-primary shadow-lg lg:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filtros
        {activeCount > 0 && (
          <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-on-primary/20 px-1.5 text-[11px]">
            {activeCount}
          </span>
        )}
      </button>

      {/* Drawer de filtros (mobile) — bottom sheet */}
      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filtros"
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl bg-background transition-transform duration-300 lg:hidden ${
          mobileOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="text-[15px] font-bold uppercase tracking-[1px] text-on-surface">Filtros</span>
          <div className="flex items-center gap-4">
            {clearButton}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar filtros"
              className="flex h-8 w-8 items-center justify-center text-on-surface hover:text-accent"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          <ProductFilters {...panelProps} />
        </div>

        <div className="border-t border-line px-5 py-4">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="block w-full rounded-[10px] bg-accent py-3.5 text-center text-[14px] font-bold uppercase tracking-[0.5px] text-on-accent transition-transform hover:scale-[1.01]"
          >
            Ver {countLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
