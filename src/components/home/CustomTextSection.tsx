import { sanitizeBasicHtml } from '@/lib/sanitizeHtml';
import type { CustomSection, CustomSectionTextContent, CustomSectionVariant } from '@/lib/types';

/** Sección custom de texto: título + cuerpo HTML sanitizado, con alineación y fondo. */
export function CustomTextSection({
  section,
  variant = 'default',
}: {
  section: CustomSection;
  variant?: CustomSectionVariant;
}) {
  const c = section.content as CustomSectionTextContent;
  const heading = (c.heading || '').trim();
  const body = sanitizeBasicHtml(c.body || '');
  if (!heading && !body) return null;

  const align = c.text_align === 'left' || c.text_align === 'right' ? c.text_align : 'center';

  // En la columna derecha el contenedor ya pone el ancho y el ritmo vertical
  // (space-y-6): el `mx-auto max-w-3xl px-6 py-8 md:py-16` de la home metería 128px
  // de aire en una columna de 466px. El padding sólo se justifica si hay color de
  // fondo — sin fondo tiene que alinear con el resto de la columna. La tipografía
  // baja a la escala de la ficha (la misma del bloque "Descripción").
  const inColumn = variant === 'column';
  const padding = inColumn ? (c.background_color ? 'px-4 py-4' : '') : 'mx-auto max-w-3xl px-6 py-8 md:py-16';

  return (
    <section
      className={inColumn && c.background_color ? 'rounded-lg' : undefined}
      style={c.background_color ? { backgroundColor: c.background_color } : undefined}
    >
      <div className={padding} style={{ textAlign: align }}>
        {heading ? (
          <h2
            className={
              inColumn ? 'text-[calc(15px_*_var(--font-scale,1))] font-semibold mb-2 text-text' : 'text-2xl md:text-3xl font-semibold tracking-tight mb-4'
            }
          >
            {heading}
          </h2>
        ) : null}
        {body ? (
          <div
            className={`${
              inColumn ? 'text-[calc(14px_*_var(--font-scale,1))] leading-relaxed text-muted' : 'text-base leading-relaxed'
            } [&_a]:underline [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5`}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : null}
      </div>
    </section>
  );
}
