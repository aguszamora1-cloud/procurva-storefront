import { resolveTemplateApp, type AppKit } from './storeTemplates';

/**
 * T6 · ¿Esta tienda se pinta con una plantilla completa (Atelier, Distrito,
 * Momentum) o con Classic?
 *
 * Interruptor del build: VITE_TEMPLATE_APPS=1. Apagado por defecto. Se prende
 * recién cuando el servidor ya valida la activación (la RPC y el trigger del
 * ERP, que aceptan la referencia sólo para empresas piloto, tiendas minoristas,
 * sin outfits activos y con permiso del miembro). Con el interruptor apagado
 * `TEMPLATE_APPS_ENABLED` es `false` literal: el cargador de plantillas
 * desaparece del bundle y toda tienda ve Classic, como hoy.
 *
 * Con el interruptor prendido, la plantilla se monta SOLO si se cumplen todas:
 *   1. `config.template` (lo guardado, o la vista previa autorizada del
 *      diseñador ya aplicada en memoria por StoreProvider) resuelve a una
 *      definición publicada con `components.app` (id y versión exactos).
 *   2. Canal minorista. Mayorista nunca (curvas, packs y escalones mayoristas
 *      quedan fuera de la v1). `store_2` / `store_3` cuentan por su `storeType`,
 *      igual que el resto de la tienda.
 *   3. La portada no tiene la sección de outfits prendida: las plantillas no
 *      pintan outfits y el comercio perdería contenido. Es defensa del lado del
 *      cliente: el servidor ya rechaza activar en ese caso.
 * Cualquier otra cosa da Classic exacto.
 *
 * Lo que esto NO acredita: quién guardó la referencia. Eso lo valida el
 * servidor al escribir; la tienda sólo decide qué pintar con lo que lee.
 */
export const TEMPLATE_APPS_ENABLED: boolean = import.meta.env.VITE_TEMPLATE_APPS === '1';

export interface TemplateAppGateInput {
  /** Interruptor del build (TEMPLATE_APPS_ENABLED; parámetro para poder probarlo). */
  enabled: boolean;
  /** `config.template` (o `settings.template` crudo: se valida igual). */
  template: unknown;
  /** Tipo de ESTA tienda (retail | wholesale), el de useStoreType(). */
  storeType: string | null | undefined;
  /** `config.sections.outfits`: la sección de outfits de la portada. */
  outfitsSection: boolean;
}

export type TemplateAppBlock = 'apagado' | 'sin-plantilla' | 'mayorista' | 'outfits';

export type TemplateAppDecision = { kit: AppKit; block: null } | { kit: null; block: TemplateAppBlock };

/** Decisión pura (probada en scripts/template-app.test.mjs). */
export function decideTemplateApp(i: TemplateAppGateInput): TemplateAppDecision {
  if (i.enabled !== true) return { kit: null, block: 'apagado' };
  const kit = resolveTemplateApp(i.template);
  if (!kit) return { kit: null, block: 'sin-plantilla' };
  if (i.storeType !== 'retail') return { kit: null, block: 'mayorista' };
  if (i.outfitsSection !== false) return { kit: null, block: 'outfits' };
  return { kit, block: null };
}
