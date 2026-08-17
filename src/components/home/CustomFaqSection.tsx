import { useState } from 'react';
import { ChevronDown, MessageCircle } from 'lucide-react';
import { SectionHeader } from '@/components/SectionHeader';
import { useStore } from '@/context/StoreProvider';
import { sanitizeBasicHtml } from '@/lib/sanitizeHtml';
import { whatsappLink } from '@/lib/utils';
import type { CustomSection, CustomSectionFaqContent, CustomSectionVariant } from '@/lib/types';

/**
 * Preguntas frecuentes en acordeón. Las políticas de envío/cambios/pagos ya
 * tienen su propio bloque en la ficha (PolicyAccordions), pero salen de tres
 * campos fijos: acá el comercio escribe las preguntas que quiera, y las pone en
 * el home donde le sirvan.
 *
 * Una sola abierta a la vez, como el bloque de políticas. Cada pregunta es una
 * tarjeta con borde propio (antes era una lista con divisores): separadas se
 * leen como items clickeables y el que está abierto se distingue del resto.
 *
 * La apertura se anima con el truco de grid-rows 0fr → 1fr en vez de max-height:
 * la respuesta puede medir dos renglones o diez y la transición sale igual de
 * suave, sin framer-motion (no está en el storefront) y sin números mágicos.
 */
export function CustomFaqSection({
  section,
  variant = 'default',
}: {
  section: CustomSection;
  variant?: CustomSectionVariant;
}) {
  const c = section.content as CustomSectionFaqContent;
  const config = useStore();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const items = (c.items || []).filter((i) => (i.q || '').trim());
  if (items.length === 0) return null;

  const heading = (c.heading || '').trim();
  const subheading = (c.subheading || '').trim();

  // El bloque de contacto sólo tiene sentido si hay a dónde escribir: sin
  // WhatsApp configurado sería un botón que no lleva a ningún lado.
  const wa = config.whatsapp ? whatsappLink(config.whatsapp, 'Hola! Quería hacer una consulta.') : '';
  const showContact = !!c.contact_enabled && !!wa;

  // En la columna derecha de la ficha (466px en desktop, 267px a 768px) el
  // contenedor ya pone ancho y ritmo vertical: el padding de la home metería
  // 128px de aire. El título tampoco puede ser el h2 de 40px del home, así que
  // baja a la escala de la ficha — el mismo criterio que CustomTextSection.
  const inColumn = variant === 'column';

  return (
    <section
      style={c.background_color ? { backgroundColor: c.background_color } : undefined}
      className={
        inColumn
          ? c.background_color
            ? 'rounded-lg px-4 py-4'
            : ''
          : 'mx-auto max-w-none px-6 py-8 md:py-16'
      }
    >
      <div className={inColumn ? '' : 'mx-auto max-w-3xl'}>
        {heading &&
          (inColumn ? (
            <div className="mb-3">
              <h2 className="text-[calc(15px_*_var(--font-scale,1))] font-semibold text-text">{heading}</h2>
              {subheading && <p className="mt-1 text-[calc(13px_*_var(--font-scale,1))] text-muted">{subheading}</p>}
            </div>
          ) : (
            <SectionHeader title={heading} subtitle={subheading || undefined} />
          ))}

        <div className={inColumn ? 'space-y-2' : 'space-y-2.5'}>
          {items.map((item, i) => {
            const open = openIndex === i;
            const answer = sanitizeBasicHtml(item.a || '');
            const panelId = `faq-${section.id}-${i}`;
            return (
              <div
                key={`${item.q}-${i}`}
                className={`rounded-lg border transition-colors duration-200 ${
                  open ? 'border-line bg-line-soft' : 'border-line-soft hover:border-line hover:bg-line-soft'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : i)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className={`flex w-full items-center justify-between text-left ${
                    inColumn ? 'gap-3 px-4 py-3' : 'gap-4 px-5 py-4 md:px-6'
                  }`}
                >
                  <span
                    className={`font-semibold transition-colors duration-200 ${
                      inColumn ? 'text-[13.5px]' : 'text-[calc(14px_*_var(--font-scale,1))] md:text-[calc(15px_*_var(--font-scale,1))]'
                    } ${open ? 'text-text' : 'text-muted'}`}
                  >
                    {item.q}
                  </span>
                  <ChevronDown
                    size={inColumn ? 16 : 18}
                    className={`flex-none transition-all duration-200 ${
                      open ? 'rotate-180 scale-110 text-accent' : 'text-subtle'
                    }`}
                  />
                </button>

                <div
                  id={panelId}
                  aria-hidden={!open}
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  {/* La respuesta queda montada (así la indexa Google), pero
                      oculta al cerrar para que sus links no reciban foco con
                      Tab. El delay hace que se esconda recién cuando terminó de
                      plegarse; al abrir aparece en el acto. */}
                  <div
                    className={`overflow-hidden transition-[visibility] duration-0 ${
                      open ? 'visible delay-0' : 'invisible delay-300'
                    }`}
                  >
                    <div
                      className={`leading-relaxed text-muted [&_a]:underline [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ${
                        inColumn ? 'px-4 pb-3 pt-0.5 text-[calc(13px_*_var(--font-scale,1))]' : 'px-5 pb-4 pt-1 text-[calc(14px_*_var(--font-scale,1))] md:px-6'
                      }`}
                      dangerouslySetInnerHTML={{ __html: answer }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {showContact && (
          <div
            className={`rounded-lg border border-line-soft text-center ${
              inColumn ? 'mt-4 px-4 py-5' : 'mx-auto mt-10 max-w-md px-6 py-7 md:mt-12'
            }`}
          >
            {!inColumn && (
              <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted">
                <MessageCircle size={16} />
              </span>
            )}
            <p className={`font-semibold text-text ${inColumn ? 'text-[13.5px]' : 'text-[calc(14px_*_var(--font-scale,1))]'}`}>
              {(c.contact_title || '').trim() || '¿Te quedó alguna duda?'}
            </p>
            <p className={`mt-1 text-muted ${inColumn ? 'text-[12.5px]' : 'text-[calc(13px_*_var(--font-scale,1))]'}`}>
              {(c.contact_description || '').trim() || 'Escribinos y te respondemos a la brevedad.'}
            </p>
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-4 inline-flex items-center gap-2 rounded-md bg-accent font-semibold text-on-accent transition-opacity hover:opacity-90 ${
                inColumn ? 'px-4 py-2 text-[12.5px]' : 'px-5 py-2.5 text-[calc(13px_*_var(--font-scale,1))]'
              }`}
            >
              <MessageCircle size={15} />
              {(c.contact_button_text || '').trim() || 'Escribinos por WhatsApp'}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
