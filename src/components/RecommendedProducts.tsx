import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeader } from '@/components/SectionHeader';
import { RelatedProducts } from '@/components/RelatedProducts';
import { useRecommendations } from '@/hooks/useRecommendations';

/**
 * Recomendaciones del detalle (sección "upsell" del admin, PRO). Prioriza las
 * recomendaciones MANUALES cargadas en el panel Recomendaciones (con su etiqueta y
 * el color elegido por card). Si el producto no tiene recomendaciones manuales,
 * cae a "Productos relacionados" por categoría.
 */
export function RecommendedProducts({ product }: { product: Product }) {
  const { items, label, isLoading } = useRecommendations(product);

  // Mientras resuelve, no mostramos nada (evita el flash del fallback por
  // categoría antes de que lleguen las manuales).
  if (isLoading) return null;

  // Sin recomendaciones manuales → fallback por categoría (comportamiento previo).
  if (items.length === 0) return <RelatedProducts product={product} />;

  return (
    <section className="border-t border-line px-6 py-12 md:px-10 md:py-16 lg:px-16">
      <SectionHeader label="Recomendados" title={label} />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-5">
        {items.map((p) => (
          <ProductCard key={p.card_key ?? p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
