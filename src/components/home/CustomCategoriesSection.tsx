import { useMemo } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import { CategoryCard, COLS_CLASS } from '@/components/home/CategoriesSection';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import type { CustomSection, CustomSectionCategoriesContent } from '@/lib/types';

/**
 * Grilla de categorías elegidas a mano.
 *
 * La sección fija de Categorías se arma sola: todas las visibles, en el orden de
 * catalog_category_order y cortadas en 8. Ésta muestra sólo las que el comercio
 * elige y en el orden en que las puso — sirve para destacar tres colecciones
 * arriba y dejar el listado completo más abajo.
 *
 * Las cards son las MISMAS que la sección fija (CategoryCard): si mañana cambia
 * el diseño de la card, cambia en los dos lados. Duplicar el markup era el
 * camino corto para que se desincronicen.
 */
export function CustomCategoriesSection({ section }: { section: CustomSection }) {
  const c = section.content as CustomSectionCategoriesContent;
  const { products } = useProducts();
  const { categories } = useCategories(products);

  const shown = useMemo(() => {
    const picked = (c.items || []).map((n) => n.trim()).filter(Boolean);
    if (picked.length === 0) return categories;
    // Respetamos el orden en que las eligió, no el del catálogo. Una categoría
    // que dejó de existir (renombrada o borrada) simplemente no entra.
    const byName = new Map(categories.map((cat) => [cat.name.toLowerCase(), cat]));
    return picked.map((n) => byName.get(n.toLowerCase())).filter((x): x is NonNullable<typeof x> => !!x);
  }, [categories, c.items]);

  if (shown.length === 0) return null;

  const columns = c.columns === 2 || c.columns === 3 || c.columns === 4 ? c.columns : 3;
  const style = c.card_style || 'overlay';
  const heading = (c.heading || '').trim();

  return (
    <section className="mx-auto max-w-none px-6 py-8 md:py-16">
      {(heading || c.label) && <SectionHeader label={c.label} title={heading || 'Categorías'} />}
      <div className={`grid gap-3 ${COLS_CLASS[columns]}`}>
        {shown.map((cat) => (
          <CategoryCard key={cat.name} cat={cat} products={products} style={style} />
        ))}
      </div>
    </section>
  );
}
