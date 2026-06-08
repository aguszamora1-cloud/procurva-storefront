import { CustomBannerSection } from '@/components/home/CustomBannerSection';
import { CustomTextSection } from '@/components/home/CustomTextSection';
import type { CustomSection, ProductDetailSlot } from '@/lib/types';

/** Renderiza las secciones custom de detalle de producto que caen en `slot`. */
export function ProductDetailCustomSlot({ sections, slot }: { sections: CustomSection[]; slot: ProductDetailSlot }) {
  const inSlot = sections.filter((s) => (s.content as { slot?: ProductDetailSlot }).slot === slot);
  if (inSlot.length === 0) return null;
  return (
    <>
      {inSlot.map((s) =>
        s.section_type === 'banner' ? (
          <CustomBannerSection key={s.id} section={s} />
        ) : (
          <CustomTextSection key={s.id} section={s} />
        ),
      )}
    </>
  );
}
