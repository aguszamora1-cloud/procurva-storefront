import { SectionHeader } from '@/components/SectionHeader';
import type { CustomSection, CustomSectionGalleryContent, CustomSectionVariant } from '@/lib/types';

const GRID_COLS = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' } as const;

/**
 * Galería / lookbook: 1 a 8 fotos con epígrafe opcional ("Detalle del
 * estampado", "Cómo combinarla"). Solo URLs https (lo valida el MCP y la
 * subida del editor); una URL que no empieza así no se dibuja.
 *
 * En el celular van de a dos por fila; en la columna derecha, de a dos siempre.
 */
export function CustomGallerySection({
  section,
  variant = 'default',
}: {
  section: CustomSection;
  variant?: CustomSectionVariant;
}) {
  const c = section.content as CustomSectionGalleryContent;
  const images = (c.images || []).filter((i) => /^https:\/\//i.test((i.image_url || '').trim())).slice(0, 8);
  if (images.length === 0) return null;
  const heading = (c.heading || '').trim();
  const inColumn = variant === 'column';
  const cols = c.columns === 2 || c.columns === 4 ? c.columns : 3;
  const single = images.length === 1;

  return (
    <section className={inColumn ? '' : 'px-6 py-8 md:py-14'}>
      <div className={inColumn ? '' : 'mx-auto max-w-6xl'}>
        {heading &&
          (inColumn ? (
            <h2 className="mb-3 text-[calc(15px_*_var(--font-scale,1))] font-semibold text-text">{heading}</h2>
          ) : (
            <SectionHeader title={heading} />
          ))}
        <div className={single ? '' : `grid grid-cols-2 gap-3 ${inColumn ? '' : `md:gap-4 ${GRID_COLS[cols]}`}`}>
          {images.map((img, i) => (
            <figure key={`${img.image_url}-${i}`} className="overflow-hidden">
              <img
                src={img.image_url}
                alt={img.caption || heading || section.label}
                loading="lazy"
                className={`w-full object-cover ${single ? 'max-h-[640px]' : 'aspect-[3/4]'}`}
              />
              {img.caption && (
                <figcaption className={`mt-1.5 text-muted ${inColumn ? 'text-[12px]' : 'text-[calc(13px_*_var(--font-scale,1))]'}`}>
                  {img.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
