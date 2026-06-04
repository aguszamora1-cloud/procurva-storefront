import { useStore } from '@/context/StoreProvider';
import { useProducts } from '@/hooks/useProducts';
import { Hero } from '@/components/Hero';
import { ShippingPromise } from '@/components/ShippingPromise';
import { CategoriesSection } from '@/components/home/CategoriesSection';
import { ProductsSection } from '@/components/home/ProductsSection';
import { NewsletterSection } from '@/components/home/NewsletterSection';
import { ProductGridSkeleton } from '@/components/ProductGrid';

export function Home() {
  const config = useStore();
  const { products, isLoading } = useProducts();

  const featured = products.slice(0, 8);
  const newArrivals = products.slice(0, 8); // ya vienen ordenados por created_at desc

  return (
    <div>
      {config.heroEnabled && <Hero />}
      <ShippingPromise />

      {config.sections.categories && <CategoriesSection products={products} />}

      {isLoading ? (
        <div className="mx-auto max-w-7xl px-4 py-12">
          <ProductGridSkeleton />
        </div>
      ) : (
        <>
          {config.sections.featured && (
            <ProductsSection
              label="Lo más buscado"
              title="Destacados"
              products={featured}
              linkTo="/productos"
            />
          )}
          {config.sections.newArrivals && (
            <ProductsSection
              label="Recién llegados"
              title="Nuevos ingresos"
              products={newArrivals}
              linkTo="/productos"
            />
          )}
        </>
      )}

      {/* Secciones PRO (sólo si están habilitadas) */}
      {config.isPro && config.sections.newsletter && <NewsletterSection />}
    </div>
  );
}
