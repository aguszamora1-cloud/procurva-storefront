import { CustomBannerSection } from '@/components/home/CustomBannerSection';
import { CustomTextSection } from '@/components/home/CustomTextSection';
import type { CustomSection, ProductDetailSlot } from '@/lib/types';

/** Renderiza una sección custom del detalle (banner o texto). */
export function CustomSectionNode({ section }: { section: CustomSection }) {
  return section.section_type === 'banner' ? (
    <CustomBannerSection section={section} />
  ) : (
    <CustomTextSection section={section} />
  );
}

/** Renderiza las secciones custom de detalle de producto que caen en `slot`. */
export function ProductDetailCustomSlot({ sections, slot }: { sections: CustomSection[]; slot: ProductDetailSlot }) {
  const inSlot = sections.filter((s) => (s.content as { slot?: ProductDetailSlot }).slot === slot);
  if (inSlot.length === 0) return null;
  return (
    <>
      {inSlot.map((s) => (
        <CustomSectionNode key={s.id} section={s} />
      ))}
    </>
  );
}
