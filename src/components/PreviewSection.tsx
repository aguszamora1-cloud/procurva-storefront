import type { ReactNode } from 'react';
import { isDesignerFrame } from '@/lib/designerFrame';
import { isSelectableSection, SECTION_ATTR } from '@/lib/previewInspect';

/**
 * EDITOR E3.0 · marca una sección para la selección visual del diseñador.
 *
 * Fuera del diseñador (visita pública, enmarcada por otro sitio, señal desconocida)
 * devuelve los hijos TAL CUAL: el DOM público no cambia en nada. En el diseñador
 * envuelve con un `div` `display: contents` que lleva la clave: no genera caja ni
 * cambia el layout (el contenedor del inicio no usa selectores de hijo directo) y
 * es estable durante toda la vida del documento (`isDesignerFrame` se calcula una
 * vez en main.tsx, antes de pintar), así que activar o apagar la selección no
 * remonta nada.
 */
export function PreviewSection({ id, children }: { id: string; children: ReactNode }) {
  if (!isDesignerFrame() || !isSelectableSection(id)) return <>{children}</>;
  return (
    <div {...{ [SECTION_ATTR]: id }} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
