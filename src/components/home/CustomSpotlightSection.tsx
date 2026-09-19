import { Check } from 'lucide-react';
import type { CustomSection, CustomSectionSpotlightContent, CustomSectionVariant } from '@/lib/types';

/**
 * Foto destacada con puntos: una imagen grande (el estampado, la tela, la
 * costura) y al lado un título, una bajada y 1 a 6 características. Es el
 * "bloque de detalle" de las fichas armadas con IA.
 *
 * En el celular, y en la columna derecha de la ficha, la foto va arriba.
 * Texto plano en todo: nada de HTML.
 */
export function CustomSpotlightSection({
  section,
  variant = 'default',
}: {
  section: CustomSection;
  variant?: CustomSectionVariant;
}) {
  const c = section.content as CustomSectionSpotlightContent;
  const heading = (c.heading || '').trim();
  const body = (c.body || '').trim();
  const image = /^https:\/\//i.test((c.image_url || '').trim()) ? (c.image_url || '').trim() : '';
  const points = (c.points || []).filter((p) => (p.title || '').trim() || (p.text || '').trim()).slice(0, 6);
  if (!image && !heading && points.length === 0) return null;

  const inColumn = variant === 'column';
  const imageRight = c.image_side === 'right';
  const custom = !!(c.background_color || c.text_color);

  return (
    <section
      className={custom ? (inColumn ? 'rounded-lg px-4 py-4' : '') : inColumn ? '' : 'bg-background text-text'}
      style={custom ? { backgroundColor: c.background_color || undefined, color: c.text_color || undefined } : undefined}
    >
      <div
        className={
          inColumn
            ? 'flex flex-col gap-4'
            : 'mx-auto grid max-w-6xl items-center gap-8 px-6 py-10 md:grid-cols-2 md:gap-12 md:py-16'
        }
      >
        {image && (
          <div className={`overflow-hidden ${inColumn ? '' : imageRight ? 'md:order-2' : 'md:order-1'}`}>
            <img src={image} alt={heading || section.label} loading="lazy" className="h-full w-full object-cover" />
          </div>
        )}
        <div className={`flex flex-col gap-4 ${inColumn ? '' : imageRight ? 'md:order-1' : 'md:order-2'}`}>
          {heading && (
            <h2
              className={
                inColumn
                  ? 'text-[calc(15px_*_var(--font-scale,1))] font-semibold'
                  : 'font-heading text-[calc(24px_*_var(--font-scale,1))] font-semibold uppercase leading-[1.1] tracking-[1px] md:text-[calc(32px_*_var(--font-scale,1))]'
              }
            >
              {heading}
            </h2>
          )}
          {body && (
            <p className={`leading-relaxed opacity-80 ${inColumn ? 'text-[13px]' : 'text-[calc(14px_*_var(--font-scale,1))] md:text-[calc(15px_*_var(--font-scale,1))]'}`}>
              {body}
            </p>
          )}
          {points.length > 0 && (
            <ul className={inColumn ? 'space-y-2.5' : 'space-y-3.5'}>
              {points.map((p, i) => (
                <li key={`${p.title}-${i}`} className="flex items-start gap-3">
                  <Check size={inColumn ? 15 : 18} strokeWidth={2} className="mt-0.5 flex-none opacity-70" />
                  <div>
                    {p.title && <p className={`font-semibold ${inColumn ? 'text-[13.5px]' : 'text-[calc(14.5px_*_var(--font-scale,1))]'}`}>{p.title}</p>}
                    {p.text && <p className={`mt-0.5 opacity-75 ${inColumn ? 'text-[12.5px]' : 'text-[calc(13.5px_*_var(--font-scale,1))]'}`}>{p.text}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
