import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeader } from '@/components/SectionHeader';
import { limitSectionCards } from '@/lib/homeSections';

interface Props {
  label?: string;
  title: string;
  subtitle?: string;
  /** Productos de la sección, COMPLETOS (sin cortar): el corte se hace acá. */
  products: Product[];
  /** Máximo de CARDS visibles (config.sectionMaxItems). */
  maxItems: number;
  /** Listado con el conjunto completo de esta sección (ver sectionListPath). */
  linkTo?: string;
}

/** Sección genérica de grilla de productos (Destacados, Nuevos, etc.). */
export function ProductsSection({ label, title, subtitle, products, maxItems, linkTo }: Props) {
  // Explota los productos con display_variants_separately en una card por color
  // (mismo criterio que el grid del catálogo) y RECIÉN AHÍ corta: el límite
  // cuenta cards, que es lo que ve el visitante. Cortar antes de expandir era el
  // bug histórico — 12 productos de 3 colores pintaban 36 cards.
  const { cards, hasMore } = useMemo(() => limitSectionCards(products, maxItems), [products, maxItems]);
  if (cards.length === 0) return null;
  return (
    <section className="mx-auto max-w-none px-6 py-8 md:py-16">
      <SectionHeader label={label} title={title} subtitle={subtitle} linkTo={linkTo} linkText="Ver todo" />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-5">
        {cards.map((p) => (
          <ProductCard key={p.card_key ?? p.id} product={p} />
        ))}
      </div>
      {/* Sólo si quedaron cards afuera: si la sección entra completa, un "ver
          más" que lleva a lo mismo que ya se está viendo es ruido. */}
      {hasMore && linkTo && (
        <div className="mt-8 flex justify-center md:mt-10">
          <Link
            to={linkTo}
            className="inline-flex items-center border border-line px-8 py-3.5 text-[13px] font-bold uppercase tracking-[0.5px] text-on-surface transition-colors hover:border-accent hover:text-accent"
          >
            Ver más productos
          </Link>
        </div>
      )}
    </section>
  );
}
