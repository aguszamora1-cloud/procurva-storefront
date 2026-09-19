import { SectionHeader } from '@/components/SectionHeader';
import { FEATURE_ICONS } from '@/lib/featureIcons';
import type { CustomSection, CustomSectionFeaturesContent, CustomSectionVariant } from '@/lib/types';

const GRID_COLS = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-2 lg:grid-cols-4' } as const;

/**
 * Beneficios con íconos: "No destiñe · Talle real · Envío en 24 h". Es el
 * bloque que más usan las fichas armadas con IA: escaneable, sin foto.
 *
 * En la columna derecha de la ficha va como lista compacta (ícono + texto),
 * no como grilla: a 267px no entran dos columnas.
 */
export function CustomFeaturesSection({
  section,
  variant = 'default',
}: {
  section: CustomSection;
  variant?: CustomSectionVariant;
}) {
  const c = section.content as CustomSectionFeaturesContent;
  const items = (c.items || []).filter((i) => (i.title || '').trim() || (i.text || '').trim()).slice(0, 8);
  if (items.length === 0) return null;
  const heading = (c.heading || '').trim();
  const subheading = (c.subheading || '').trim();
  const inColumn = variant === 'column';
  const cols = c.columns === 2 || c.columns === 4 ? c.columns : 3;

  return (
    <section
      style={c.background_color ? { backgroundColor: c.background_color } : undefined}
      className={inColumn ? (c.background_color ? 'rounded-lg px-4 py-4' : '') : 'px-6 py-8 md:py-14'}
    >
      <div className={inColumn ? '' : 'mx-auto max-w-5xl'}>
        {heading &&
          (inColumn ? (
            <div className="mb-3">
              <h2 className="text-[calc(15px_*_var(--font-scale,1))] font-semibold text-text">{heading}</h2>
              {subheading && <p className="mt-1 text-[calc(13px_*_var(--font-scale,1))] text-muted">{subheading}</p>}
            </div>
          ) : (
            <SectionHeader title={heading} subtitle={subheading || undefined} />
          ))}

        <ul className={inColumn ? 'space-y-3' : `grid grid-cols-1 gap-6 sm:grid-cols-2 ${GRID_COLS[cols]}`}>
          {items.map((it, i) => {
            const Icon = it.icon ? FEATURE_ICONS[it.icon] : undefined;
            return (
              <li key={`${it.title}-${i}`} className={inColumn ? 'flex items-start gap-3' : 'flex flex-col items-center gap-2 text-center'}>
                {Icon && (
                  <span
                    className={`flex flex-none items-center justify-center rounded-full bg-line-soft text-text ${
                      inColumn ? 'h-8 w-8' : 'h-12 w-12'
                    }`}
                  >
                    <Icon size={inColumn ? 16 : 22} strokeWidth={1.75} />
                  </span>
                )}
                <div>
                  {it.title && (
                    <p className={`font-semibold text-text ${inColumn ? 'text-[13.5px]' : 'text-[calc(15px_*_var(--font-scale,1))]'}`}>
                      {it.title}
                    </p>
                  )}
                  {it.text && (
                    <p className={`mt-0.5 leading-relaxed text-muted ${inColumn ? 'text-[12.5px]' : 'text-[calc(13.5px_*_var(--font-scale,1))]'}`}>
                      {it.text}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
