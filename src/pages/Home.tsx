import { useStore } from '@/context/StoreProvider';
import { useProducts } from '@/hooks/useProducts';
import { Seo } from '@/components/Seo';
import { Hero } from '@/components/Hero';
import { TrustBadges } from '@/components/TrustBadges';
import { CategoriesSection } from '@/components/home/CategoriesSection';
import { ProductsSection } from '@/components/home/ProductsSection';
import { NewsletterSection } from '@/components/home/NewsletterSection';
import { StoriesSection } from '@/components/home/StoriesSection';
import { SocialProofSection } from '@/components/home/SocialProofSection';
import { OutfitsSection } from '@/components/home/OutfitsSection';
import { ProductGridSkeleton } from '@/components/ProductGrid';

export function Home() {
  const config = useStore();
  const { products, isLoading } = useProducts();

  // Destacados: sólo los marcados is_featured en ProCurva (máx 8).
  const featured = products.filter((p) => p.is_featured).slice(0, 8);
  // Nuevos ingresos: más recientes (ya vienen ordenados por created_at desc),
  // excluyendo los que ya están en Destacados para que no se repitan (máx 8).
  const featuredIds = new Set(featured.map((p) => p.id));
  const newArrivals = products.filter((p) => !featuredIds.has(p.id)).slice(0, 8);

  return (
    <div>
      <Seo
        title={config.metaTitle || config.name}
        description={config.metaDescription || config.tagline || `Tienda online de ${config.name}.`}
        image={config.ogImageUrl}
        slug={config.slug}
        siteName={config.name}
        path="/"
      />
      {config.heroEnabled && <Hero />}

      {config.sections.trustBadges && (
        <div className="mx-auto max-w-[1400px] px-6 pt-12 md:pt-16">
          <TrustBadges />
        </div>
      )}

      {config.isPro && config.sections.stories && <StoriesSection />}

      {config.sections.categories && <CategoriesSection products={products} />}

      {config.isPro && config.sections.outfits && <OutfitsSection />}

      {isLoading ? (
        <div className="mx-auto max-w-[1400px] px-6 py-16 md:py-24">
          <ProductGridSkeleton />
        </div>
      ) : (
        <>
          {config.sections.featured && (
            <ProductsSection label="Lo más buscado" title="Destacados" products={featured} linkTo="/productos" />
          )}
          {config.sections.newArrivals && (
            <ProductsSection label="Recién llegados" title="Nuevos ingresos" products={newArrivals} linkTo="/productos" />
          )}
        </>
      )}

      {config.isPro && config.sections.socialProof && <SocialProofSection />}

      {config.isPro && config.sections.newsletter && <NewsletterSection />}
    </div>
  );
}
