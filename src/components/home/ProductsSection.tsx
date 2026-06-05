import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeader } from '@/components/SectionHeader';

interface Props {
  label?: string;
  title: string;
  subtitle?: string;
  products: Product[];
  linkTo?: string;
}

/** Sección genérica de grilla de productos (Destacados, Nuevos, etc.). */
export function ProductsSection({ label, title, subtitle, products, linkTo }: Props) {
  if (products.length === 0) return null;
  return (
    <section className="mx-auto max-w-none px-6 py-16 md:py-24">
      <SectionHeader label={label} title={title} subtitle={subtitle} linkTo={linkTo} linkText="Ver todo" />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-5">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
