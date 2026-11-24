import { resolveTemplateApp, type AppKit } from './storeTemplates';
import { outfitSurfaces, outfitsUsage, type OutfitRowSummary, type OutfitsGateConfig } from './outfitsGate';

/**
 * T6 · ¿Esta tienda se pinta con una plantilla completa (Atelier, Distrito,
 * Momentum) o con Classic?
 *
 * Interruptor del build: VITE_TEMPLATE_APPS=1. Apagado por defecto. Se prende
 * recién cuando el servidor ya valida la activación y la compatibilidad
 * (20261208 + 20261213 del ERP: la referencia la escriben sólo las RPC, para
 * empresas piloto, tiendas minoristas, sin outfits a la vista y con permiso del
 * miembro; y ningún guardado del comercio puede volver incompatible una tienda
 * con plantilla). Con el interruptor apagado `TEMPLATE_APPS_ENABLED` es `false`
 * literal: el cargador de plantillas desaparece del bundle y toda tienda ve
 * Classic, como hoy.
 *
 * Con el interruptor prendido, la plantilla se monta SOLO si se cumplen todas:
 *   1. `config.template` (lo guardado, o la vista previa autorizada del
 *      diseñador ya aplicada en memoria por StoreProvider) resuelve a una
 *      definición publicada con `components.app` (id y versión exactos).
 *   2. Canal minorista. Mayorista nunca (curvas, packs y escalones mayoristas
 *      quedan fuera de la v1). `store_2` / `store_3` cuentan por su `storeType`,
 *      igual que el resto de la tienda.
 *   3. Outfits: las plantillas v1 no los pintan (ni el home ni el bloque de la
 *      ficha). Mismo criterio que el servidor (plantillas.motivos_compat) y que
 *      lib/outfitsGate: si alguna superficie de outfits está prendida (sección
 *      del home, o `complementaryBlock.mostrarOutfit`, que nace prendido), la
 *      empresa tiene que NO tener outfits activos, y eso se LEE antes de montar
 *      (catalog_outfits, la misma lectura pública que usa Classic). Mientras se
 *      lee: pantalla de carga. Error o demora: Classic. Nunca se pinta la
 *      plantilla sin haber leído. Esto cubre lo que el servidor no impide a
 *      propósito: un cambio por un camino interno (editor SQL, service_role) o un
 *      dato que ya estaba.
 * Cualquier otra cosa da Classic exacto. Una tienda SIN plantilla no lee nada
 * extra ni espera: la decisión es Classic antes de mirar outfits.
 *
 * Lo que esto NO acredita: quién guardó la referencia. Eso lo valida el
 * servidor al escribir; la tienda sólo decide qué pintar con lo que lee.
 */
export const TEMPLATE_APPS_ENABLED: boolean = import.meta.env.VITE_TEMPLATE_APPS === '1';

/** Cuánto se espera la lectura de outfits antes de caer a Classic. */
export const OUTFITS_PROBE_TIMEOUT_MS = 2500;

/**
 * Lectura de outfits activos de la empresa:
 *   'sin-leer'  todavía no se pidió;
 *   'leyendo'   pedida, sin respuesta;
 *   'error'     falló o tardó más de OUTFITS_PROBE_TIMEOUT_MS;
 *   filas       los outfits ACTIVOS que devolvió (vacío = no hay).
 */
export type OutfitsProbe = 'sin-leer' | 'leyendo' | 'error' | readonly OutfitRowSummary[];

export interface TemplateAppGateInput {
  /** Interruptor del build (TEMPLATE_APPS_ENABLED; parámetro para poder probarlo). */
  enabled: boolean;
  /** `config.template` (o `settings.template` crudo: se valida igual). */
  template: unknown;
  /** Tipo de ESTA tienda (retail | wholesale), el de useStoreType(). */
  storeType: string | null | undefined;
  /** `config.sections.outfits`: la sección de outfits de la portada. */
  outfitsSection: unknown;
  /** `config.complementaryBlock.mostrarOutfit`: el bloque «Es parte de un look» de la ficha. */
  mostrarOutfit: unknown;
  /** Resultado de la lectura de outfits (sólo cuenta si alguna superficie está prendida). */
  outfits: OutfitsProbe;
}

export type TemplateAppBlock =
  | 'apagado'
  | 'sin-plantilla'
  | 'mayorista'
  /** Hay outfits activos y la tienda los mostraría. */
  | 'outfits'
  /** Falta leer los outfits: pantalla de carga, no se pinta nada todavía. */
  | 'verificando'
  /** La lectura de outfits falló o tardó: Classic. */
  | 'outfits-sin-verificar';

export type TemplateAppDecision = { kit: AppKit; block: null } | { kit: null; block: TemplateAppBlock };

/**
 * Configuración para lib/outfitsGate con el criterio del SERVIDOR: sin mirar el
 * plan (prudente) y sólo `false` apaga (un dato raro cuenta como prendido).
 */
function gateConfig(i: Pick<TemplateAppGateInput, 'outfitsSection' | 'mostrarOutfit'>): OutfitsGateConfig {
  return {
    storeType: 'retail',
    isPro: true,
    sections: { outfits: i.outfitsSection !== false },
    complementaryBlock: { mostrarOutfit: i.mostrarOutfit !== false },
  };
}

/**
 * ¿Hay que leer los outfits para decidir? Sólo si TODO lo demás ya da plantilla y
 * alguna superficie de outfits está prendida. Una tienda sin plantilla nunca lee.
 */
export function needsOutfitsProbe(i: Omit<TemplateAppGateInput, 'outfits'>): boolean {
  if (i.enabled !== true || !resolveTemplateApp(i.template) || i.storeType !== 'retail') return false;
  return outfitSurfaces(gateConfig(i)).length > 0;
}

/** Decisión pura (probada en scripts/template-app.test.mjs). */
export function decideTemplateApp(i: TemplateAppGateInput): TemplateAppDecision {
  if (i.enabled !== true) return { kit: null, block: 'apagado' };
  const kit = resolveTemplateApp(i.template);
  if (!kit) return { kit: null, block: 'sin-plantilla' };
  if (i.storeType !== 'retail') return { kit: null, block: 'mayorista' };
  const cfg = gateConfig(i);
  if (outfitSurfaces(cfg).length === 0) return { kit, block: null };
  const probe = i.outfits;
  if (probe === 'sin-leer' || probe === 'leyendo') return { kit: null, block: 'verificando' };
  if (!Array.isArray(probe)) return { kit: null, block: 'outfits-sin-verificar' };
  return outfitsUsage(cfg, probe).active ? { kit: null, block: 'outfits' } : { kit, block: null };
}
