import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeader } from '@/components/SectionHeader';
import { useRelatedProducts } from '@/hooks/useRelatedProducts';

/**
 * "Productos relacionados" en el detalle de producto (sección upsell del admin).
 * Prioriza productos de la misma categoría. Se oculta si no hay al menos 2.
 */
export function RelatedProducts({ product }: { product: Product }) {
  const { related } = useRelatedProducts(product, 4);
  if (related.length < 2) return null;
  return (
    <section className="border-t border-line px-6 py-12 md:px-10 md:py-16 lg:px-16">
      <SectionHeader label="Productos relacionados" title="También te puede gustar" />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-5">
        {related.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
