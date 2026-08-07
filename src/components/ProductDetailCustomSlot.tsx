import { CustomBannerSection } from '@/components/home/CustomBannerSection';
import { CustomTextSection } from '@/components/home/CustomTextSection';
import { CustomMarqueeSection } from '@/components/home/CustomMarqueeSection';
import { CustomFaqSection } from '@/components/home/CustomFaqSection';
import type { CustomSection, CustomSectionVariant, ProductDetailSlot } from '@/lib/types';

/**
 * Renderiza una sección custom del detalle (banner, texto, barra de anuncios o
 * preguntas frecuentes).
 *
 * `variant` viaja hasta el componente concreto porque la misma sección se ve muy
 * distinta según dónde caiga: a ancho completo, o dentro de la columna derecha,
 * que en desktop mide 466px y a 768px apenas 267px.
 *
 * Switch (no ternario): un `section_type` que este build no conoce todavía no
 * debe renderizar nada. Con el ternario anterior caía en el `else` y se dibujaba
 * como sección de texto vacía (mismo bug que ya se corrigió en el home).
 */
export function CustomSectionNode({
  section,
  variant = 'default',
}: {
  section: CustomSection;
  variant?: CustomSectionVariant;
}) {
  switch (section.section_type) {
    case 'banner':
      return <CustomBannerSection section={section} variant={variant} />;
    case 'text':
      return <CustomTextSection section={section} variant={variant} />;
    case 'marquee':
      return <CustomMarqueeSection section={section} />;
    case 'faq':
      return <CustomFaqSection section={section} variant={variant} />;
    default:
      return null;
  }
}

/**
 * Renderiza las secciones custom de detalle de producto que caen en `slot`.
 * El slot `right_column` se pide siempre con `variant="column"`.
 */
export function ProductDetailCustomSlot({
  sections,
  slot,
  variant = 'default',
}: {
  sections: CustomSection[];
  slot: ProductDetailSlot;
  variant?: CustomSectionVariant;
}) {
  const inSlot = sections.filter((s) => (s.content as { slot?: ProductDetailSlot }).slot === slot);
  if (inSlot.length === 0) return null;
  return (
    <>
      {inSlot.map((s) => (
        <CustomSectionNode key={s.id} section={s} variant={variant} />
      ))}
    </>
  );
}
