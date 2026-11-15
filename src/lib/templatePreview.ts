import { findTemplate, parseTemplatePreview, type StoreTemplateDefinition } from './storeTemplates';
import { getPreviewChannel, type PreviewChannel } from './previewChannel';

/**
 * Vista previa de plantilla (P0-1). Son dos preguntas separadas:
 *
 * 1. QUÉ plantilla: `?pc_preview=1&pc_template=<id>[@<versión>]`. Se captura UNA
 *    vez, al cargar el módulo, por la misma razón que typographyRuntime: la tienda
 *    es una SPA y el parámetro se pierde en el primer cambio de ruta. Vive en
 *    memoria: no va a localStorage, sessionStorage ni a la caché de config, así que
 *    no se filtra a otra pestaña ni a otro visitante. Sólo ELIGE una plantilla
 *    publicada del registro (storeTemplates.ts): por URL no entra ningún valor de
 *    diseño. Un id o versión que no existe = sin pedido. Los borradores no están en
 *    el registro, así que tampoco se pueden ver.
 *
 * 2. SI se aplica: sólo con el handshake COMPLETO del canal de la vista previa
 *    (lib/previewChannel): la tienda está enmarcada, el ERP —origen exacto, padre
 *    directo— le mandó `hello` a ESTE documento y aceptó su identidad con `ack`
 *    del canal vigente. Es exactamente la condición con la que la tienda ya acepta
 *    `inspect` y `reveal` (E3.0). Ni `pc_preview=1`, ni `pc_template`, ni el
 *    referrer, ni ancestorOrigins, ni un postMessage sin esas garantías alcanzan:
 *    sin handshake, la tienda pinta lo guardado. Si el ERP reinicia el canal, la
 *    autorización cae y se vuelve a lo guardado hasta el próximo ack.
 *
 * Qué NO acredita: permisos del usuario del ERP sobre la empresa. La tienda no
 * tiene cómo verificarlos (no hay token ni sesión compartida); confía en que la
 * página de https://procurva.app que la enmarca y completa el handshake es el
 * diseñador, que exige sesión. Es el mismo alcance que E2.0/E3.0.
 *
 * Caché: con un pedido bien formado que existe en el registro, esta pestaña no lee
 * ni escribe la caché de config (autorizada o no). Así lo guardado nunca se mezcla
 * con la plantilla, y recargar sin el parámetro vuelve a lo guardado.
 */
const requested = (() => {
  if (typeof window === 'undefined') return null;
  try {
    return parseTemplatePreview(window.location.search);
  } catch {
    return null;
  }
})();

/** Plantilla pedida por URL que existe en el registro (autorizada o no), o null. */
export function requestedTemplate(): StoreTemplateDefinition | null {
  return findTemplate(requested);
}

/**
 * ¿La vista previa de plantilla está autorizada en esta pestaña? Pura: depende sólo
 * del estado del canal (probada en scripts/store-templates.test.mjs).
 */
export function isTemplatePreviewAuthorized(ch: Pick<PreviewChannel, 'state' | 'acked'> | null | undefined): boolean {
  return !!ch && ch.state === 'preview' && ch.acked === true;
}

/** Plantilla en vista previa en esta pestaña, o null (lo normal: se pinta lo guardado). */
export function previewTemplate(): StoreTemplateDefinition | null {
  const def = requestedTemplate();
  if (!def) return null;
  return isTemplatePreviewAuthorized(getPreviewChannel()) ? def : null;
}

/**
 * Avisa cuando puede haber cambiado la autorización (handshake completo o caído).
 * Sin pedido de plantilla, o sin canal (visita pública), no escucha nada.
 */
export function onTemplatePreviewChange(l: () => void): () => void {
  const ch = getPreviewChannel();
  if (!requestedTemplate() || !ch) return () => {};
  const offHandshake = ch.onHandshake(() => l());
  const offState = ch.subscribe(() => l());
  return () => {
    offHandshake();
    offState();
  };
}
