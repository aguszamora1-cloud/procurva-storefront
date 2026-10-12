import { useStore } from '@/context/StoreProvider';
import { ty, type TitleCase, type TypographyRole, type TypographyVersion } from '@/lib/typography';
import { typographyFor } from '@/lib/typographyRuntime';

/**
 * Versión tipográfica efectiva de la tienda (lo guardado + la vista previa del
 * ERP) y el selector de clases. Uso, desde la Fase 1:
 *
 *   const { ty } = useTypography();
 *   <h2 className={ty('…las clases de hoy, literales…', 'section-title', 'text-text')}>
 */
export function useTypography(): {
  version: TypographyVersion;
  titleCase: TitleCase;
  ty: (v1Classes: string, role: TypographyRole, extra?: string) => string;
} {
  const { version, titleCase } = typographyFor(useStore());
  return {
    version,
    titleCase,
    ty: (v1Classes, role, extra) => ty(version, v1Classes, role, extra),
  };
}
