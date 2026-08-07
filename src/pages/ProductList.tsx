import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useHomeSections, sectionProducts } from '@/hooks/useHomeSections';
import { sectionFromParam, type HomeSectionKey } from '@/lib/homeSections';
import { useStore } from '@/context/StoreProvider';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
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

/** Normaliza texto para buscar sin distinguir acentos ni mayúsculas. */
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * Encabezado del listado cuando se llega desde una sección del home (?seccion=).
 *
 * El copy NO es el mismo para las tres, porque las tres no hacen lo mismo:
 * Destacados y Nuevos ingresos traen TODO el catálogo reordenado (su regla
 * automática rellena con `products` entero), así que hablar de "filtro" o de
 * "ver todo el catálogo" sería mentir — el catálogo completo ya está a la
 * vista. Ofertas sí recorta (sólo productos con promo vigente) y por eso usa el
 * mismo patrón que ?q=.
 */
const SECTION_VIEWS: Record<HomeSectionKey, { label: string; title: string; note: string; clear: string }> = {
  featured: {
    label: 'Catálogo',
    title: 'Destacados',
    note: 'Todo el catálogo, con los destacados primero.',
    clear: 'Quitar este orden',
  },
  new_arrivals: {
    label: 'Catálogo',
    title: 'Nuevos ingresos',
    note: 'Todo el catálogo, con los ingresos más nuevos primero.',
    clear: 'Quitar este orden',
  },
  offers: {
    label: 'Ofertas',
    title: 'Ofertas',
    note: 'Sólo los productos con promociones vigentes.',
    clear: 'Ver todo el catálogo',
  },
};

export function ProductList() {
  const { products, isLoading, error, reload } = useProducts();
  const config = useStore();
  const { categories, isLoading: categoriesLoading } = useCategories(products);
  const [searchParams, setSearchParams] = useSearchParams();

  // Sección del home de la que venimos (?seccion=), si es una válida. La arma el
  // MISMO hook que el home: el "Ver más productos" tiene que caer exactamente
  // sobre el conjunto que se venía viendo, no sobre una reimplementación.
  const seccion = sectionFromParam(searchParams.get('seccion'));
  const home = useHomeSections(products, { enabled: seccion !== null });
  // Orden de Destacados / Nuevos ingresos que el comerciante armó en el ERP
  // (panel "Organizar" + ficha del producto). Se refleja acá como orden.
  const { featured, newArrivals } = home.pins;

  // El listado aparece de una sola vez: esperamos el catálogo, los filtros
  // (categorías) y el orden de Destacados/Nuevos, que reordena la grilla.
  useFirstPaintGate('product-list', isLoading || categoriesLoading || home.loading);
  const preCat = searchParams.get('categoria');
  // Búsqueda por texto (?q=). Filtra por nombre/marca/descripción sin acentos.
  const query = (searchParams.get('q') ?? '').trim();
  // Criterio de orden del listado (?orden=). Default: el de la sección cuando se
  // llega desde el home (así el listado abre igual que la vidriera), Destacados
  // en el catálogo suelto.
  const defaultOrden = seccion ? 'seccion' : 'destacados';
  const orden = searchParams.get('orden') ?? defaultOrden;

  // Conjunto base: la sección completa si venimos de una, si no el catálogo.
  // Los filtros de la izquierda se aplican encima, igual que siempre.
  const baseProducts = useMemo(
    () => (seccion ? sectionProducts(home, seccion) : products),
    [seccion, home, products],
  );

  // La categoría que viene en la URL (?categoria=) queda preseleccionada.
  const [selectedCats, setSelectedCats] = useState<Set<string>>(() => new Set(preCat ? [preCat] : []));
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(new Set());
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories]);

  // Segmento y marca salen del catálogo cargado, no de una tabla de config: si
  // el comercio todavía no los cargó, el accordion directamente no aparece.
  // La marca es SOLO products.brand — nunca el proveedor, que en el ERP es el
  // fallback pero acá sería publicar a quién le compra el comercio.
  //
  // Todas las opciones de filtro salen del conjunto base, no del catálogo
  // entero: dentro de Ofertas no tiene sentido ofrecer un talle que ninguna
  // oferta tiene. Sin ?seccion=, baseProducts ES el catálogo y no cambia nada.
  const allSegments = useMemo(() => {
    const set = new Set<string>();
    baseProducts.forEach((p) => {
      const s = (p.segment ?? '').trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [baseProducts]);

  const allBrands = useMemo(() => {
    const set = new Set<string>();
    baseProducts.forEach((p) => {
      const b = (p.brand ?? '').trim();
      if (b) set.add(b);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [baseProducts]);

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    baseProducts.forEach((p) => availableSizes(p).forEach((s) => set.add(s)));
    return sortSizes(Array.from(set));
  }, [baseProducts]);

  const allColors = useMemo(() => {
    const set = new Set<string>();
    baseProducts.forEach((p) => availableColors(p).forEach((c) => set.add(c)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [baseProducts]);

  const priceBounds = useMemo(() => {
    const prices = baseProducts.map((p) => getPriceInfo(p).mainPrice).filter((n) => n > 0);
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [baseProducts]);

  const min = priceMin.trim() === '' ? null : Number(priceMin);
  const max = priceMax.trim() === '' ? null : Number(priceMax);

  // Filtros combinados: AND entre tipos de filtro, OR dentro de cada uno.
  const filtered = useMemo(
    () =>
      baseProducts.filter((p) => {
        if (query) {
          const nq = norm(query);
          const hay = norm([p.name, (p as { sku?: string }).sku, p.brand, (p as { description?: string }).description].filter(Boolean).join(' '));
          if (!hay.includes(nq)) return false;
        }
        if (selectedCats.size > 0 && !productCategories(p).some((c) => selectedCats.has(c))) return false;
        if (selectedSegments.size > 0 && !selectedSegments.has((p.segment ?? '').trim())) return false;
        if (selectedBrands.size > 0 && !selectedBrands.has((p.brand ?? '').trim())) return false;
        if (selectedSizes.size > 0 && !availableSizes(p).some((s) => selectedSizes.has(s))) return false;
        if (selectedColors.size > 0 && !availableColors(p).some((c) => selectedColors.has(c))) return false;
        const price = getPriceInfo(p).mainPrice;
        if (min != null && !Number.isNaN(min) && price < min) return false;
        if (max != null && !Number.isNaN(max) && price > max) return false;
        return true;
      }),
    [baseProducts, query, selectedCats, selectedSegments, selectedBrands, selectedSizes, selectedColors, min, max],
  );

  // Orden final del listado. Los pins del comerciante (Destacados / Nuevos
  // ingresos) van primero; luego caen los flags is_featured/is_new_arrival y por
  // último el resto por más recientes. Los sin stock los manda al fondo el grid.
  const sorted = useMemo(() => {
    const byNewest = (a: typeof filtered[number], b: typeof filtered[number]) =>
      (b.created_at ?? '').localeCompare(a.created_at ?? '');
    const arr = [...filtered];
    switch (orden) {
      // Orden de la sección: `filtered` ya viene en ese orden (baseProducts sale
      // del mismo hook que arma la vidriera), así que no se reordena nada.
      case 'seccion':
        return arr;
      case 'precio_asc':
        return arr.sort((a, b) => getPriceInfo(a).mainPrice - getPriceInfo(b).mainPrice);
      case 'precio_desc':
        return arr.sort((a, b) => getPriceInfo(b).mainPrice - getPriceInfo(a).mainPrice);
      case 'az':
        return arr.sort((a, b) => a.name.localeCompare(b.name, 'es'));
      case 'nuevos': {
        const rank = new Map(newArrivals.map((id, i) => [id, i] as const));
        return arr.sort((a, b) => {
          const ra = rank.has(a.id) ? (rank.get(a.id) as number) : a.is_new_arrival ? newArrivals.length : Infinity;
          const rb = rank.has(b.id) ? (rank.get(b.id) as number) : b.is_new_arrival ? newArrivals.length : Infinity;
          return ra !== rb ? ra - rb : byNewest(a, b);
        });
      }
      case 'destacados':
      default: {
        const rank = new Map(featured.map((id, i) => [id, i] as const));
        return arr.sort((a, b) => {
          const ra = rank.has(a.id) ? (rank.get(a.id) as number) : a.is_featured ? featured.length : Infinity;
          const rb = rank.has(b.id) ? (rank.get(b.id) as number) : b.is_featured ? featured.length : Infinity;
          return ra !== rb ? ra - rb : byNewest(a, b);
        });
      }
    }
  }, [filtered, orden, featured, newArrivals]);

  const setOrden = (value: string) => {
    const next = new URLSearchParams(searchParams);
    // El orden por defecto no viaja en la URL (es el implícito de la vista).
    if (value === defaultOrden) next.delete('orden');
    else next.set('orden', value);
    setSearchParams(next, { replace: true });
  };

  /** Saca ?seccion= (y su orden implícito) volviendo al catálogo completo. */
  const clearSeccion = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('seccion');
    if (next.get('orden') === 'seccion') next.delete('orden');
    setSearchParams(next, { replace: true });
  };

  const sectionView = seccion ? SECTION_VIEWS[seccion] : null;

  const activeCount =
    selectedCats.size +
    selectedSegments.size +
    selectedBrands.size +
    selectedSizes.size +
    selectedColors.size +
    (min != null || max != null ? 1 : 0);

  const clearAll = () => {
    setSelectedCats(new Set());
    setSelectedSegments(new Set());
    setSelectedBrands(new Set());
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
    segments: allSegments,
    brands: allBrands,
    sizes: allSizes,
    colors: allColors,
    priceBounds,
    selectedCats,
    selectedSegments,
    selectedBrands,
    selectedSizes,
    selectedColors,
    priceMin,
    priceMax,
    onToggleCat: toggleInSet(setSelectedCats),
    onToggleSegment: toggleInSet(setSelectedSegments),
    onToggleBrand: toggleInSet(setSelectedBrands),
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
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[2px] text-accent">
          {query ? 'Búsqueda' : sectionView ? sectionView.label : 'Catálogo'}
        </p>
        <h1 className="font-heading text-[32px] font-semibold uppercase tracking-[1px] text-text md:text-[44px]">
          {query ? <>Resultados para “{query}”</> : sectionView ? sectionView.title : 'Todos los productos'}
        </h1>
        {/* Sin búsqueda activa: aclaramos qué es esta vista. Para Destacados y
            Nuevos ingresos es un ORDEN sobre el catálogo entero, no un recorte;
            para Ofertas sí es un subconjunto. */}
        {!query && sectionView && (
          <>
            <p className="mt-2 text-[14px] text-on-surface-muted">{sectionView.note}</p>
            <button
              type="button"
              onClick={clearSeccion}
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.5px] text-on-surface-muted transition-colors hover:text-accent"
            >
              <X className="h-3.5 w-3.5" />
              {sectionView.clear}
            </button>
          </>
        )}
        {query && (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('q');
              setSearchParams(next, { replace: true });
            }}
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.5px] text-on-surface-muted transition-colors hover:text-accent"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar búsqueda
          </button>
        )}
      </header>

      <div className="flex gap-8">
        {/* Sidebar de filtros (desktop) */}
        {/* Sidebar de filtros (desktop).
            El panel es `sticky`: se queda fijo mientras scrolleás los
            resultados. Sin una altura máxima eso deja el fondo de la lista
            INALCANZABLE en cuanto los filtros pasan el alto de la pantalla —
            queda anclado y el scroll de la página ya no lo mueve. Por eso el
            contenedor se acota al viewport y la lista scrollea adentro, con el
            encabezado ("Filtros" + Limpiar) siempre visible arriba. */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 flex max-h-[calc(100vh-8rem)] flex-col">
            <div className="mb-1 flex shrink-0 items-center justify-between border-b border-line pb-3">
              <h2 className="text-[15px] font-bold uppercase tracking-[1px] text-on-surface">Filtros</h2>
              {clearButton}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
              <ProductFilters {...panelProps} />
            </div>
          </div>
        </aside>

        {/* Resultados */}
        <div className="min-w-0 flex-1">
          <div className="mb-6 flex items-center justify-between gap-4">
            <p className="text-[13px] text-on-surface-muted">{countLabel}</p>
            <label className="flex items-center gap-2 text-[13px] text-on-surface-muted">
              <span className="hidden sm:inline whitespace-nowrap">Ordenar por</span>
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
                className="rounded-md border border-line bg-background px-3 py-2 text-[13px] font-medium text-on-surface focus:border-accent focus:outline-none"
              >
                {/* Sólo cuando se llega desde una sección: es el orden con el
                    que abrió la vista y tiene que poder recuperarse. */}
                {sectionView && <option value="seccion">Orden de {sectionView.title.toLowerCase()}</option>}
                <option value="destacados">Destacados</option>
                <option value="nuevos">Más nuevos</option>
                <option value="precio_asc">Precio: menor a mayor</option>
                <option value="precio_desc">Precio: mayor a menor</option>
                <option value="az">Alfabético (A-Z)</option>
              </select>
            </label>
          </div>

          {isLoading ? (
            <ProductGridSkeleton />
          ) : error ? (
            <InlineError message="No pudimos cargar los productos." onRetry={reload} />
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center text-[14px] text-subtle">No hay productos que coincidan con los filtros.</p>
          ) : (
            <ProductGrid products={sorted} />
          )}
        </div>
      </div>

      {/* Botón "Filtros" flotante (mobile/tablet) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-md bg-primary px-6 py-3 text-[13px] font-bold uppercase tracking-[0.5px] text-on-primary shadow-lg lg:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filtros
        {activeCount > 0 && (
          <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-on-primary-a20 px-1.5 text-[11px]">
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
