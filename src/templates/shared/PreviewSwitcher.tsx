import { useState } from 'react';
import { DEV_TEMPLATE_IDS, blockedRequests, switchDevTemplate, type DevTemplateId } from '@/lib/devTemplate';

const NAMES: Record<DevTemplateId, string> = {
  atelier: 'Atelier',
  distrito: 'Distrito',
  momentum: 'Momentum',
};

/**
 * Herramienta de desarrollo (no es parte de ninguna plantilla): cambia de
 * plantilla para comparar y muestra cuántos pedidos de escritura cortó la guarda.
 */
export function PreviewSwitcher({ current }: { current: DevTemplateId }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tpl-switcher" data-open={open || undefined}>
      <button type="button" className="tpl-switcher__toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Vista previa · {NAMES[current]}
      </button>
      {open && (
        <div className="tpl-switcher__panel" role="group" aria-label="Elegir plantilla">
          {DEV_TEMPLATE_IDS.map((id) => (
            <button key={id} type="button" aria-pressed={id === current} onClick={() => switchDevTemplate(id)}>
              {NAMES[id]}
            </button>
          ))}
          <button type="button" onClick={() => switchDevTemplate(null)}>
            Classic
          </button>
          <p>Sólo desarrollo. No guarda nada en la tienda. Escrituras cortadas: {blockedRequests.length}</p>
        </div>
      )}
    </div>
  );
}
