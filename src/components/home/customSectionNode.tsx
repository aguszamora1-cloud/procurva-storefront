import type { ReactNode } from 'react';
import type { CustomSection } from '@/lib/types';
import { CustomBannerSection } from '@/components/home/CustomBannerSection';
import { CustomTextSection } from '@/components/home/CustomTextSection';
import { CustomMarqueeSection } from '@/components/home/CustomMarqueeSection';
import { CustomProductsSection } from '@/components/home/CustomProductsSection';
import { CustomCountdownSection } from '@/components/home/CustomCountdownSection';
import { CustomCtaSection } from '@/components/home/CustomCtaSection';
import { CustomSplitSection } from '@/components/home/CustomSplitSection';
import { CustomVideoSection } from '@/components/home/CustomVideoSection';
import { CustomFaqSection } from '@/components/home/CustomFaqSection';
import { CustomDividerSection } from '@/components/home/CustomDividerSection';
import { CustomCategoriesSection } from '@/components/home/CustomCategoriesSection';
import { CustomLocationsSection } from '@/components/home/CustomLocationsSection';
import { CustomFeaturesSection } from '@/components/home/CustomFeaturesSection';
import { CustomTableSection } from '@/components/home/CustomTableSection';
import { CustomGallerySection } from '@/components/home/CustomGallerySection';
import { CustomSpotlightSection } from '@/components/home/CustomSpotlightSection';

/**
 * Nodo del home para una sección personalizada (catalog_custom_sections). Vivía
 * adentro de pages/Home.tsx; se extrajo en T5 para que las plantillas pinten las
 * secciones del comercio con los MISMOS componentes que Classic.
 *
 * Switch (no ternario): un section_type que este build no conoce todavía debe NO
 * renderizar nada. Con el ternario anterior caía en el `else` y se dibujaba como
 * sección de texto (encabezado y cuerpo vacíos).
 */
export function customSectionNode(cs: CustomSection): ReactNode {
  switch (cs.section_type) {
    case 'banner':
      return <CustomBannerSection section={cs} />;
    case 'text':
      return <CustomTextSection section={cs} />;
    case 'marquee':
      return <CustomMarqueeSection section={cs} />;
    case 'products':
      return <CustomProductsSection section={cs} />;
    case 'countdown':
      return <CustomCountdownSection section={cs} />;
    case 'cta':
      return <CustomCtaSection section={cs} />;
    case 'split':
      return <CustomSplitSection section={cs} />;
    case 'video':
      return <CustomVideoSection section={cs} />;
    case 'faq':
      return <CustomFaqSection section={cs} />;
    case 'divider':
      return <CustomDividerSection section={cs} />;
    case 'categories':
      return <CustomCategoriesSection section={cs} />;
    case 'locations':
      return <CustomLocationsSection section={cs} />;
    case 'features':
      return <CustomFeaturesSection section={cs} />;
    case 'table':
      return <CustomTableSection section={cs} />;
    case 'gallery':
      return <CustomGallerySection section={cs} />;
    case 'spotlight':
      return <CustomSpotlightSection section={cs} />;
    default:
      return null;
  }
}

/**
 * Franjas finas de color a sangre: el fade del Reveal no se lee como una
 * animación sino como un hueco blanco entre la sección de arriba y la de abajo
 * (el placeholder ocupa el alto en opacity-0). En una barra de ~40px no hay nada
 * que "revelar": tiene que estar pintada desde el principio.
 */
export const customSectionSkipsReveal = (cs: CustomSection): boolean =>
  cs.section_type === 'marquee' || cs.section_type === 'divider';
