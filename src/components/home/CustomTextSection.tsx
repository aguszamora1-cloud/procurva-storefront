import { sanitizeBasicHtml } from '@/lib/sanitizeHtml';
import type { CustomSection, CustomSectionTextContent } from '@/lib/types';

/** Sección custom de texto: título + cuerpo HTML sanitizado, con alineación y fondo. */
export function CustomTextSection({ section }: { section: CustomSection }) {
  const c = section.content as CustomSectionTextContent;
  const heading = (c.heading || '').trim();
  const body = sanitizeBasicHtml(c.body || '');
  if (!heading && !body) return null;

  const align = c.text_align === 'left' || c.text_align === 'right' ? c.text_align : 'center';

  return (
    <section style={c.background_color ? { backgroundColor: c.background_color } : undefined}>
      <div className="mx-auto max-w-3xl px-6 py-8 md:py-16" style={{ textAlign: align }}>
        {heading ? (
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">{heading}</h2>
        ) : null}
        {body ? (
          <div
            className="text-base leading-relaxed [&_a]:underline [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : null}
      </div>
    </section>
  );
}
