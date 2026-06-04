import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeader } from '@/components/SectionHeader';

interface Props {
  label?: string;
  title: string;
  products: Product[];
  linkTo?: string;
}

/** Sección genérica de grilla de productos (Destacados, Nuevos, etc.). */
export function ProductsSection({ label, title, products, linkTo }: Props) {
  if (products.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <SectionHeader label={label} title={title} linkTo={linkTo} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
