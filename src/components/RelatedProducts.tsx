import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeader } from '@/components/SectionHeader';
import { useRelatedProducts } from '@/hooks/useRelatedProducts';

/**
 * "Productos relacionados" en el detalle de producto (sección upsell del admin).
 * Prioriza productos de la misma categoría. Se oculta si no hay al menos 2.
 */
export function RelatedProducts({ product, variant = 'section' }: { product: Product; variant?: 'section' | 'column' }) {
  // En la columna traemos MENOS: cuatro cards apiladas en ~400px empujan el
  // precio y el botón de comprar fuera de la pantalla, que es lo contrario de
  // lo que la sección busca.
  const column = variant === 'column';
  const { related } = useRelatedProducts(product, column ? 2 : 4);
  if (related.length < 2) return null;

  // Se reusa ProductCard tal cual (no una fila compacta a mano): el precio de
  // una card tiene demasiada lógica encima —modo mayorista, contado vs tarjeta,
  // promos, escalones— como para reescribirla y que se desincronice.
  if (column) {
    return (
      <section>
        <p className="mb-3 text-[13px] font-semibold text-muted">También te puede gustar</p>
        <div className="grid grid-cols-2 gap-2">
          {related.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    );
  }

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
