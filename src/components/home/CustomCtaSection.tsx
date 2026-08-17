import { SectionLink } from '@/components/SectionLink';
import type { CustomSection, CustomSectionCtaContent } from '@/lib/types';

const TEXT_ALIGN = { left: 'text-left items-start', center: 'text-center items-center', right: 'text-right items-end' } as const;

/**
 * Bloque de llamada a la acción: título, bajada y un botón. Es la pieza que
 * faltaba para cerrar una sección de contenido — el bloque de texto no lleva
 * botón y el banner sólo linkea la imagen entera, sin decir a dónde va.
 *
 * El destino lo resuelve SectionLink: ruta interna sin recargar la SPA, o link
 * externo (incluido WhatsApp) en una pestaña nueva.
 */
export function CustomCtaSection({ section }: { section: CustomSection }) {
  const c = section.content as CustomSectionCtaContent;
  const heading = (c.heading || '').trim();
  const body = (c.body || '').trim();
  const buttonText = (c.button_text || '').trim();
  const buttonLink = (c.button_link || '').trim();
  if (!heading && !body && !buttonText) return null;

  const align = c.text_align === 'left' || c.text_align === 'right' ? c.text_align : 'center';
  const custom = !!(c.background_color || c.text_color);

  return (
    <section
      className={custom ? '' : 'bg-secondary text-text'}
      style={custom ? { backgroundColor: c.background_color || undefined, color: c.text_color || undefined } : undefined}
    >
      <div className={`mx-auto flex max-w-3xl flex-col gap-4 px-6 py-10 md:py-16 ${TEXT_ALIGN[align]}`}>
        {heading && (
          <h2 className="font-heading text-[calc(24px_*_var(--font-scale,1))] font-semibold uppercase leading-[1.1] tracking-[1px] md:text-[calc(34px_*_var(--font-scale,1))]">
            {heading}
          </h2>
        )}
        {body && <p className="max-w-xl text-[calc(14px_*_var(--font-scale,1))] leading-relaxed opacity-80 md:text-[calc(15px_*_var(--font-scale,1))]">{body}</p>}
        {buttonText && buttonLink && (
          <SectionLink
            to={buttonLink}
            className="mt-2 inline-flex items-center border border-current px-8 py-3.5 text-[calc(14px_*_var(--font-scale,1))] font-medium transition-opacity hover:opacity-75"
          >
            {buttonText}
          </SectionLink>
        )}
      </div>
    </section>
  );
}
