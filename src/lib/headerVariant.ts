import {
  STORE_TEMPLATES,
  isHeaderLayout,
  resolveTemplateHeader,
  type HeaderLayout,
  type StoreTemplateDefinition,
} from './storeTemplates';

/**
 * Pedido de armado de encabezado SÓLO para desarrollo local y pruebas:
 * `?pc_dev_header=<layout>` en `vite` (import.meta.env.DEV). Sirve para ver y
 * probar Inline (y los armados siguientes) antes de que exista una plantilla
 * publicada que los use.
 *
 * En el build de producción `import.meta.env.DEV` es `false` literal: la rama
 * entera y el nombre del parámetro desaparecen del bundle (lo verifica
 * scripts/header-variant.test.mjs contra dist/). Ninguna URL pública puede
 * elegir el encabezado: en producción manda sólo el contrato (storeTemplates).
 */
export function parseDevHeader(search: string): HeaderLayout | null {
  try {
    const v = new URLSearchParams(search).get('pc_dev_header');
    return isHeaderLayout(v) ? v : null;
  } catch {
    return null;
  }
}

/** Se lee UNA vez al cargar el módulo (la tienda es una SPA y el parámetro se pierde al navegar). */
const devLayout: HeaderLayout | null =
  import.meta.env.DEV && typeof window !== 'undefined' ? parseDevHeader(window.location.search) : null;

/**
 * Encabezado que se pinta: el pedido de desarrollo si hay uno; si no, el del
 * contrato (resolveTemplateHeader: plantilla válida del registro con
 * `components.header`, y Classic en cualquier otro caso).
 */
export function resolveHeaderLayout(
  ref: unknown,
  registry: readonly StoreTemplateDefinition[] = STORE_TEMPLATES,
  dev: HeaderLayout | null = devLayout,
): HeaderLayout {
  return dev ?? resolveTemplateHeader(ref, registry);
}
