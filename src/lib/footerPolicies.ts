/**
 * Enlaces de «Información» del footer: las MISMAS políticas que el editor del ERP
 * guarda en «Pie de página» (envio_politica / cambios_politica / pagos_politica)
 * y que la ficha de producto ya muestra en <PolicyAccordions/>. No hay campos
 * nuevos: se leen de la config resuelta de la tienda (minorista o mayorista).
 *
 * Antes sólo se veían en la ficha, así que una tienda que las cargaba "en el pie
 * de página" no las encontraba en el pie. Cada enlace aparece sólo si su texto
 * tiene contenido; sin ninguno, la columna no se pinta.
 */
export type FooterPolicyKey = 'envios' | 'cambios' | 'pagos';

export interface FooterPolicyLink {
  key: FooterPolicyKey;
  label: string;
  text: string;
}

export interface FooterPolicySource {
  policyShipping?: string | null;
  policyReturns?: string | null;
  policyPayments?: string | null;
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function footerPolicyLinks(config: FooterPolicySource): FooterPolicyLink[] {
  const all: FooterPolicyLink[] = [
    { key: 'envios', label: 'Envíos', text: clean(config.policyShipping) },
    { key: 'cambios', label: 'Cambios y devoluciones', text: clean(config.policyReturns) },
    { key: 'pagos', label: 'Medios de pago', text: clean(config.policyPayments) },
  ];
  return all.filter((p) => p.text.length > 0);
}
