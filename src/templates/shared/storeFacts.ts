/**
 * FIN0 · Reglas puras de las plantillas para mostrar SÓLO lo que la tienda
 * respalda (probadas en scripts/template-fin0.test.mjs).
 */
import { DEFAULT_PURCHASE_FLOW } from '@/lib/storeConfig';
import type { StoreConfig } from '@/lib/types';

/**
 * Peso óptico del logo: `1 / √(ancho / alto)`. Con la misma «superficie», un logo
 * cuadrado va más alto que uno apaisado y uno vertical más alto todavía (cada
 * plantilla lo acota con su alto mínimo y máximo en CSS, vía `--mark-k`). Con un
 * alto máximo fijo para todos, un logo cuadrado quedaba en 34 px y uno muy ancho
 * llenaba el encabezado. Proporción acotada (0,4 a 6) para que un archivo raro no
 * dispare el tamaño. Sin medidas válidas: 1.
 */
export function logoWeight(naturalWidth: number, naturalHeight: number): number {
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) return 1;
  const ratio = Math.min(6, Math.max(0.4, naturalWidth / naturalHeight));
  return Math.round((1 / Math.sqrt(ratio)) * 1000) / 1000;
}

/**
 * Pasos de «Así funciona tu compra» que escribió el comercio. storeConfig
 * devuelve la MISMA lista DEFAULT_PURCHASE_FLOW cuando no hay pasos guardados (o
 * ninguno válido): esos textos son promesas genéricas («Envío gratis · 2-5 días
 * al interior», «Con seguimiento en tiempo real») que la tienda nunca confirmó,
 * así que en las plantillas no van. Apagado por el comercio: tampoco.
 */
export function merchantPurchaseSteps(config: Pick<StoreConfig, 'purchaseFlowEnabled' | 'purchaseFlowSteps'>): StoreConfig['purchaseFlowSteps'] {
  if (!config.purchaseFlowEnabled || config.purchaseFlowSteps === DEFAULT_PURCHASE_FLOW) return [];
  return config.purchaseFlowSteps.filter((s) => s.name.trim());
}
