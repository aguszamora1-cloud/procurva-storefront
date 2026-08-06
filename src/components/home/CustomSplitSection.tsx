import { SectionLink } from '@/components/SectionLink';
import { sanitizeBasicHtml } from '@/lib/sanitizeHtml';
import type { CustomSection, CustomSectionSplitContent } from '@/lib/types';

/**
 * Imagen y texto lado a lado: el bloque de "Sobre nosotros", "Cómo comprar" o
 * "Por qué elegirnos". Con las piezas que había antes esto se armaba apilando un
 * banner y un bloque de texto, que en desktop desperdicia media pantalla.
 *
 * En mobile la imagen va SIEMPRE arriba, sin importar el lado elegido: a 375px
 * no hay dos columnas, y dejar el texto arriba empujaría la foto abajo del fold.
 */
export function CustomSplitSection({ section }: { section: CustomSection }) {
  const c = section.content as CustomSectionSplitContent;
  const heading = (c.heading || '').trim();
  const body = sanitizeBasicHtml(c.body || '');
  const image = (c.image_url || '').trim();
  if (!heading && !body && !image) return null;

  const custom = !!(c.background_color || c.text_color);
  const imageRight = c.image_side !== 'left';

  return (
    <section
      className={custom ? '' : 'bg-background text-text'}
      style={custom ? { backgroundColor: c.background_color || undefined, color: c.text_color || undefined } : undefined}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 py-10 md:grid-cols-2 md:gap-12 md:py-16">
        {image && (
          <div className={`overflow-hidden ${imageRight ? 'md:order-2' : 'md:order-1'}`}>
            <img src={image} alt={heading || section.label} loading="lazy" className="h-full w-full object-cover" />
          </div>
        )}
        <div className={`flex flex-col gap-4 ${imageRight ? 'md:order-1' : 'md:order-2'}`}>
          {heading && (
            <h2 className="font-heading text-[24px] font-semibold uppercase leading-[1.1] tracking-[1px] md:text-[34px]">
              {heading}
            </h2>
          )}
          {body && (
            <div
              className="text-[14px] leading-relaxed opacity-80 md:text-[15px] [&_a]:underline [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              dangerouslySetInnerHTML={{ __html: body }}
            />
          )}
          {c.button_text && c.button_link && (
            <SectionLink
              to={c.button_link}
              className="mt-2 inline-flex w-fit items-center border border-current px-8 py-3.5 text-[13px] font-bold uppercase tracking-[0.5px] transition-opacity hover:opacity-75"
            >
              {c.button_text}
            </SectionLink>
          )}
        </div>
      </div>
    </section>
  );
}
