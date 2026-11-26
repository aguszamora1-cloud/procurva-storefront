import { TEMPLATE_APPS_ENABLED } from './templateApp';
import { findTemplate, parseTemplatePreview, templateAppKit } from './storeTemplates';
import { installWriteGuard } from './writeGuard';

/**
 * T6 · Vista previa del diseñador con una plantilla completa: CERO escrituras.
 *
 * Si la pestaña está ENMARCADA y pide una plantilla completa publicada
 * (`?pc_preview=1&pc_template=<kit>[@versión]`), se instala la guarda de
 * escrituras (lib/writeGuard) desde el arranque, antes del cliente de Supabase y
 * sin esperar el handshake: falla hacia lo seguro. Así, aunque la plantilla
 * llegue a montarse por la vista previa autorizada (StoreProvider aplica la
 * plantilla sólo con el handshake completo), nada sale de esta pestaña: ni
 * pedidos, ni pagos, ni eventos. Sin marco (un link con esos parámetros abierto
 * suelto) no se instala nada y la tienda funciona como siempre.
 *
 * Sólo con el build de plantillas habilitado (TEMPLATE_APPS_ENABLED). Apagado,
 * la condición es `false` literal y este módulo no deja nada en el bundle.
 * Se importa en main.tsx inmediatamente después de lib/devTemplate.
 */
export const templatePreviewBlocked: string[] = [];

function framedKitPreviewRequest(): boolean {
  try {
    if (window.parent === window) return false;
    return templateAppKit(findTemplate(parseTemplatePreview(window.location.search))) !== null;
  } catch {
    // Acceso al marco o a la URL que falla: por las dudas, guarda puesta.
    return true;
  }
}

if (TEMPLATE_APPS_ENABLED && typeof window !== 'undefined' && framedKitPreviewRequest()) {
  installWriteGuard(templatePreviewBlocked, '[vista previa del diseñador]');
}
