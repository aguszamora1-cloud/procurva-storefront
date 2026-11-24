/**
 * ¿La tienda usa outfits hoy? (T5, plantillas v1)
 *
 * Las plantillas Atelier, Distrito y Momentum v1 NO pintan outfits (ni la
 * sección del home ni el bloque «Es parte de un look» de la ficha). Activar una
 * en una tienda que los muestra le haría desaparecer ese contenido, así que la
 * activación se bloquea con este criterio. Es el MISMO que usa Classic para
 * mostrarlos:
 *
 *   - home (pages/Home.tsx + lib/homeOrder): minorista, PRO y `section_outfits`;
 *   - ficha minorista (OutfitForProductBlock): `complementary_block.mostrar_outfit`
 *     (nace en true, sin gate de plan);
 *   - y en los dos casos, al menos un outfit activo con alguna prenda
 *     (useOutfits trae `catalog_outfits.active = true`; la sección descarta los
 *     looks sin productos).
 *
 * Pura y sin imports: la pueden usar el storefront (gate de montaje), el ERP
 * (selector) y las pruebas (scripts/outfits-gate.test.mjs). No lee ni escribe
 * nada: sin filas (`rows` undefined) no sabe si hay outfits y responde que SÍ
 * cuando alguna superficie está prendida (prudente: bloquear de más se arregla
 * mirando; mostrar de menos le borra contenido a la tienda).
 */

export interface OutfitsGateConfig {
  storeType: string | null | undefined;
  isPro: boolean;
  sections: { outfits: boolean };
  complementaryBlock: { mostrarOutfit: boolean };
}

/** Una fila de catalog_outfits con la cantidad de prendas (catalog_outfit_items) que tiene. */
export interface OutfitRowSummary {
  active: boolean | null | undefined;
  /** Prendas del look. `undefined` = no se contaron (se toma como que tiene). */
  items?: number | null;
}

export type OutfitSurface = 'home' | 'product';

export interface OutfitsUsage {
  /** true = la tienda muestra (o podría estar mostrando) outfits: no activar la plantilla. */
  active: boolean;
  /** Dónde los mostraría Classic con esta configuración. */
  surfaces: OutfitSurface[];
  /** Outfits activos con prendas, o null si no se pasaron filas. */
  activeOutfits: number | null;
}

/** Superficies donde Classic pinta outfits con esta configuración (sin mirar datos). */
export function outfitSurfaces(c: OutfitsGateConfig): OutfitSurface[] {
  // Mayorista: ni el home ni la ficha mayorista muestran outfits
  // (catalog_outfits sólo tiene combo_price minorista).
  if (c.storeType === 'wholesale') return [];
  const out: OutfitSurface[] = [];
  if (c.isPro && c.sections.outfits) out.push('home');
  if (c.complementaryBlock.mostrarOutfit) out.push('product');
  return out;
}

export function outfitsUsage(c: OutfitsGateConfig, rows?: readonly OutfitRowSummary[] | null): OutfitsUsage {
  const surfaces = outfitSurfaces(c);
  if (rows == null) return { active: surfaces.length > 0, surfaces, activeOutfits: null };
  const activeOutfits = rows.filter((r) => r.active === true && (r.items == null || r.items > 0)).length;
  return { active: surfaces.length > 0 && activeOutfits > 0, surfaces, activeOutfits };
}

/** Atajo: ¿hay que bloquear la activación de una plantilla v1 por outfits? */
export function storeHasActiveOutfits(c: OutfitsGateConfig, rows?: readonly OutfitRowSummary[] | null): boolean {
  return outfitsUsage(c, rows).active;
}

/** Texto para el comercio cuando se bloquea (ERP). Sin emojis. */
export const OUTFITS_BLOCK_MESSAGE =
  'Tu tienda muestra outfits y esta plantilla todavía no los incluye. Para no sacarte ese contenido, por ahora la plantilla no se puede activar. Tus outfits no se modificaron.';
