import { useMemo } from 'react';
import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeader } from '@/components/SectionHeader';
import { toCatalogCards } from '@/lib/utils';

interface Props {
  label?: string;
  title: string;
  subtitle?: string;
  products: Product[];
  linkTo?: string;
}

/** Sección genérica de grilla de productos (Destacados, Nuevos, etc.). */
export function ProductsSection({ label, title, subtitle, products, linkTo }: Props) {
  // Explota los productos con display_variants_separately en una card por color
  // (mismo criterio que el grid del catálogo); el resto pasa sin cambios.
  const cards = useMemo(() => toCatalogCards(products), [products]);
  if (cards.length === 0) return null;
  return (
    <section className="mx-auto max-w-none px-6 py-10 md:py-24">
      <SectionHeader label={label} title={title} subtitle={subtitle} linkTo={linkTo} linkText="Ver todo" />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-5">
        {cards.map((p) => (
          <ProductCard key={p.card_key ?? p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
