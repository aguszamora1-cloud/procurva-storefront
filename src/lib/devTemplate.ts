/**
 * Plantillas V2 · P1.1: vista previa de plantillas comerciales SÓLO en desarrollo.
 *
 *   ?pc_dev_tpl=atelier|distrito|momentum   elige la plantilla (queda en la pestaña)
 *   ?pc_dev_tpl=off                          vuelve a Classic
 *
 * Todo depende de `import.meta.env.DEV`: en el build de producción es `false`
 * literal, la rama desaparece y ninguna URL pública puede elegir una plantilla.
 * No lee ni escribe la configuración de la tienda: la elección vive sólo en la
 * sessionStorage de la pestaña.
 *
 * Con una plantilla elegida se instala además una guarda de escrituras (ver
 * installPreviewWriteGuard): la vista previa mira datos reales de una tienda y
 * no puede registrar visitas, pedidos, suscripciones ni nada en Supabase.
 * La guarda vive en lib/writeGuard (la comparte la vista previa del diseñador).
 * Este módulo se importa PRIMERO en main.tsx para que la guarda quede puesta
 * antes de que se cree el cliente de Supabase.
 */

import { installWriteGuard } from './writeGuard';

export const DEV_TEMPLATE_IDS = ['atelier', 'distrito', 'momentum'] as const;
export type DevTemplateId = (typeof DEV_TEMPLATE_IDS)[number];

const PARAM = 'pc_dev_tpl';
const STORAGE_KEY = 'pc_dev_tpl';

export function isDevTemplateId(v: unknown): v is DevTemplateId {
  return typeof v === 'string' && (DEV_TEMPLATE_IDS as readonly string[]).includes(v);
}

function readDevTemplate(): DevTemplateId | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(PARAM);
    if (fromUrl === 'off') {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (isDevTemplateId(fromUrl)) {
      sessionStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return isDevTemplateId(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** Plantilla elegida para esta pestaña (null = Classic). Se lee una vez al cargar. */
export const devTemplate: DevTemplateId | null =
  import.meta.env.DEV && typeof window !== 'undefined' ? readDevTemplate() : null;

/** Cambia de plantilla recargando la página (null = Classic). */
export function switchDevTemplate(id: DevTemplateId | null) {
  if (!import.meta.env.DEV) return;
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM, id ?? 'off');
  window.location.assign(url.toString());
}

export const blockedRequests: string[] = [];

if (import.meta.env.DEV && devTemplate) installWriteGuard(blockedRequests, '[vista previa]');

