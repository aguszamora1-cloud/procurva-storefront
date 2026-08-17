import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeader } from '@/components/SectionHeader';
import { CarouselRow } from '@/components/CarouselRow';
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
  /** Grilla (default) o fila horizontal scrolleable (config.productsDisplayMode). */
  display?: 'grid' | 'carousel';
}

/**
 * Ancho de cada card en modo CARRUSEL: las mismas 4 columnas que la grilla en
 * desktop (descontando los 3 gap-5 = 60px que quedan entre ellas) y ~2 con un
 * asomo de la tercera en mobile — ese recorte es el aviso de que la fila sigue.
 * Clases literales para que Tailwind las vea en el build; los `_` son los
 * espacios que exige `calc`.
 */
const CAROUSEL_ITEM_CLASS = 'shrink-0 grow-0 snap-start basis-[46%] lg:basis-[calc((100%_-_60px)_/_4)]';

/** Sección genérica de productos (Destacados, Nuevos, Ofertas, personalizadas). */
export function ProductsSection({ label, title, subtitle, products, maxItems, linkTo, display = 'grid' }: Props) {
  // Explota los productos con display_variants_separately en una card por color
  // (mismo criterio que el grid del catálogo) y RECIÉN AHÍ corta: el límite
  // cuenta cards, que es lo que ve el visitante. Cortar antes de expandir era el
  // bug histórico — 12 productos de 3 colores pintaban 36 cards.
  const { cards, hasMore } = useMemo(() => limitSectionCards(products, maxItems), [products, maxItems]);
  if (cards.length === 0) return null;
  return (
    <section className="mx-auto max-w-none px-6 py-8 md:py-16">
      <SectionHeader label={label} title={title} subtitle={subtitle} linkTo={linkTo} linkText="Ver todo" />
      {display === 'carousel' ? (
        <CarouselRow gapClass="gap-2 lg:gap-5">
          {cards.map((p) => (
            <div key={p.card_key ?? p.id} className={CAROUSEL_ITEM_CLASS}>
              <ProductCard product={p} />
            </div>
          ))}
        </CarouselRow>
      ) : (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-5">
          {cards.map((p) => (
            <ProductCard key={p.card_key ?? p.id} product={p} />
          ))}
        </div>
      )}
      {/* Sólo si quedaron cards afuera: si la sección entra completa, un "ver
          más" que lleva a lo mismo que ya se está viendo es ruido. */}
      {hasMore && linkTo && (
        <div className="mt-8 flex justify-center md:mt-10">
          <Link
            to={linkTo}
            className="inline-flex items-center border border-line px-8 py-3.5 text-[calc(14px_*_var(--font-scale,1))] font-medium text-on-surface transition-colors hover:border-accent hover:text-accent"
          >
            Ver más productos
          </Link>
        </div>
      )}
    </section>
  );
}
