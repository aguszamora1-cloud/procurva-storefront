import type { CustomSection, CustomSectionDividerContent } from '@/lib/types';

/**
 * Separador entre secciones: una línea o simplemente aire.
 *
 * Parece de más hasta que el comercio pone dos grillas de productos seguidas y
 * no se entiende dónde termina una. Es la única sección que no tiene contenido:
 * su razón de ser es el espacio.
 */
export function CustomDividerSection({ section }: { section: CustomSection }) {
  const c = section.content as CustomSectionDividerContent;
  const height = typeof c.height === 'number' && c.height > 0 ? Math.min(200, c.height) : 48;

  if (c.style === 'space') return <div style={{ height }} aria-hidden />;

  return (
    <div className="mx-auto max-w-none px-6" style={{ paddingTop: height / 2, paddingBottom: height / 2 }}>
      <hr className="border-0 border-t" style={{ borderTopColor: c.color || 'var(--color-line)' }} />
    </div>
  );
}
