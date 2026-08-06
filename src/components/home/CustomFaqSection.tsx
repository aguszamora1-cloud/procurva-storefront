import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SectionHeader } from '@/components/SectionHeader';
import { sanitizeBasicHtml } from '@/lib/sanitizeHtml';
import type { CustomSection, CustomSectionFaqContent } from '@/lib/types';

/**
 * Preguntas frecuentes en acordeón. Las políticas de envío/cambios/pagos ya
 * tienen su propio bloque en la ficha (PolicyAccordions), pero salen de tres
 * campos fijos: acá el comercio escribe las preguntas que quiera, y las pone en
 * el home donde le sirvan.
 *
 * Una sola abierta a la vez, como el bloque de políticas.
 */
export function CustomFaqSection({ section }: { section: CustomSection }) {
  const c = section.content as CustomSectionFaqContent;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const items = (c.items || []).filter((i) => (i.q || '').trim());
  if (items.length === 0) return null;

  const heading = (c.heading || '').trim();

  return (
    <section
      style={c.background_color ? { backgroundColor: c.background_color } : undefined}
      className="mx-auto max-w-none px-6 py-8 md:py-16"
    >
      <div className="mx-auto max-w-3xl">
        {heading && <SectionHeader title={heading} />}
        <div className="divide-y divide-line border-y border-line">
          {items.map((item, i) => {
            const open = openIndex === i;
            const answer = sanitizeBasicHtml(item.a || '');
            return (
              <div key={`${item.q}-${i}`}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left"
                >
                  <span className="text-[14px] font-semibold text-text md:text-[15px]">{item.q}</span>
                  <ChevronDown
                    size={18}
                    className={`flex-none text-muted transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </button>
                {open && answer && (
                  <div
                    className="pb-4 text-[14px] leading-relaxed text-muted [&_a]:underline [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                    dangerouslySetInnerHTML={{ __html: answer }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
