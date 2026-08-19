/**
 * Configuracion regional de la tienda (moneda y formato de precios).
 *
 * Espejo reducido de `procurva2/lib/regional.ts`: aca solo hace falta formatear
 * precios, no las etiquetas fiscales ni los flags de modulos del ERP.
 *
 * El pais llega en el payload de `get_storefront_by_slug` dentro de `settings.country`
 * (ver migracion 20260818_storefront_country.sql) y lo fija StoreProvider apenas
 * resuelve la tienda. Es un singleton de modulo y no un contexto porque formatPrice()
 * se usa en decenas de componentes y tambien en helpers sueltos de lib/.
 */

export type CountryCode = 'AR' | 'PY';

interface RegionalConfig {
  currency: string;
  locale: string;
  symbol: string;
  /** El guarani se escribe con espacio entre simbolo e importe. */
  symbolSeparator: string;
}

const REGIONS: Record<CountryCode, RegionalConfig> = {
  AR: { currency: 'ARS', locale: 'es-AR', symbol: '$', symbolSeparator: '' },
  PY: { currency: 'PYG', locale: 'es-PY', symbol: '₲', symbolSeparator: ' ' },
};

const DEFAULT_COUNTRY: CountryCode = 'AR';

let active: RegionalConfig = REGIONS[DEFAULT_COUNTRY];
let activeCountry: CountryCode = DEFAULT_COUNTRY;

/** La fija StoreProvider con el `country` del payload de la tienda. */
export function setStoreCountry(country: string | null | undefined): void {
  const next = REGIONS[(country || DEFAULT_COUNTRY) as CountryCode];
  if (!next) return;
  active = next;
  activeCountry = (country || DEFAULT_COUNTRY) as CountryCode;
}

export function getStoreCountry(): CountryCode {
  return activeCountry;
}

/** Solo el simbolo, para prefijos y encabezados. */
export function currencySymbol(): string {
  return active.symbol;
}

/** ISO 4217, para los pixeles de tracking y el checkout. */
export function currencyCode(): string {
  return active.currency;
}

/** Locale activo, para formatear numeros que no son precios. */
export function currencyLocale(): string {
  return active.locale;
}

/**
 * Formatea un importe en la moneda de la tienda.
 * La tienda nunca muestra centavos (ni en pesos): los precios van redondeados.
 */
export function formatMoney(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const body = safe.toLocaleString(active.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  if (safe < 0) return `-${active.symbol}${active.symbolSeparator}${body.replace('-', '')}`;
  return `${active.symbol}${active.symbolSeparator}${body}`;
}
