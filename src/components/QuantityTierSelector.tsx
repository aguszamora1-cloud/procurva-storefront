// ============================================================================
// COMPONENTE ESPEJADO — mantener BYTE-IDÉNTICO en los dos repos:
//   canónico:  procurva-storefront/src/components/QuantityTierSelector.tsx
//   espejo:    procurva2/components/catalog/shared/QuantityTierSelector.tsx
// Son repos git independientes sin paquete compartido, así que la copia es
// manual. Si tocás uno, copiá el archivo entero al otro (no parchees a mano).
// ============================================================================
//
// Tarjetas de "escalones por cantidad" ("Lleva N") de la ficha de producto.
// Es PURAMENTE PRESENTACIONAL: recibe los escalones YA CALCULADOS y no hace
// ninguna cuenta de precios. Quién calcula:
//   - storefront: tierUnitPrices() de lib/categoryTiers.ts (base = precio con
//     la promo automática ya aplicada).
//   - admin: el preview de CategoryTierModal, con precios de un producto de
//     la categoría.
//
// El `skin` existe porque los dos repos tienen paletas distintas: el storefront
// usa tokens semánticos por tenant (--color-*) y el admin usa gray-* + accent.
// Ningún otro comportamiento cambia entre skins.

import { useId, type ReactNode } from 'react';

// ── Settings de presentación (companies.storefront_config[tipo].settings) ─────
// Las claves son OPCIONALES a propósito: ausencia = default. No hay backfill ni
// se escriben los defaults en la DB; sólo se persisten cuando el comercio las
// toca. Viven en `settings`, así que ya son POR CANAL (minorista y mayorista
// tienen su propio storefront_config).

export type QuantityTiersLayout = 'cards' | 'list';

export interface QuantityTiersSettings {
  quantityTiersLayout?: QuantityTiersLayout;
  quantityTiersShowSavings?: boolean;
  quantityTiersShowCardPrice?: boolean;
}

export const QUANTITY_TIERS_DEFAULTS = {
  quantityTiersLayout: 'cards' as QuantityTiersLayout,
  quantityTiersShowSavings: false,
  quantityTiersShowCardPrice: true,
};

/** Resuelve los settings aplicando los defaults a las claves ausentes. */
export function resolveQuantityTiersSettings(
  settings?: QuantityTiersSettings | null,
): Required<QuantityTiersSettings> {
  return {
    quantityTiersLayout: settings?.quantityTiersLayout ?? QUANTITY_TIERS_DEFAULTS.quantityTiersLayout,
    quantityTiersShowSavings: settings?.quantityTiersShowSavings ?? QUANTITY_TIERS_DEFAULTS.quantityTiersShowSavings,
    quantityTiersShowCardPrice:
      settings?.quantityTiersShowCardPrice ?? QUANTITY_TIERS_DEFAULTS.quantityTiersShowCardPrice,
  };
}

/**
 * Ahorro TOTAL de un escalón, en pesos: lo que el cliente deja de pagar por
 * llevar N unidades a precio de escalón en vez de N al precio del baseline.
 *
 * La base es el precio del baseline QUE YA SE MUESTRA (el de "Lleva 1", con la
 * promoción automática ya aplicada), no el precio de lista: si el producto está
 * en promo, el ahorro que se anuncia es sólo el del escalón, sin sumarse el de
 * la promo — que el cliente ya ve reflejado en el precio de arriba.
 *
 * Único lugar donde se calcula: los callers pasan el número, el componente sólo
 * lo muestra.
 */
export function tierTotalSavings(baselineUnitPrice: number, tierUnitPrice: number, units: number): number {
  if (!(baselineUnitPrice > 0) || !(units > 0)) return 0;
  return Math.max(0, Math.round((baselineUnitPrice - tierUnitPrice) * units));
}

export interface QuantityTierOption {
  /** Unidades del escalón ("Lleva N"). El baseline es 1. */
  units: number;
  /** % de descuento del escalón. 0 = baseline (precio normal). */
  discountPct: number;
  /** Precio protagonista por unidad (el que se muestra grande). */
  unitPrice: number;
  /** Precio de tarjeta por unidad, si difiere del protagonista. null = no se muestra. */
  cardPrice?: number | null;
  /** Precio tachado (sin el escalón). null = no se muestra. */
  strikePrice?: number | null;
  /**
   * Ahorro TOTAL en pesos del escalón (ver tierTotalSavings). El baseline no
   * tiene ahorro: 0/null. Sólo se muestra si showSavings está en true.
   */
  savings?: number | null;
  /** Escalón destacado: badge "Más elegido" (viene de is_featured de la DB). */
  isFeatured?: boolean;
  /** Escalón seleccionado. */
  isActive?: boolean;
}

interface Props {
  /** Escalones ya calculados y ordenados (baseline "Lleva 1" incluido). */
  options: QuantityTierOption[];
  /** Formateador de moneda del consumidor (formatPrice / money). */
  formatPrice: (value: number) => string;
  /** Título del bloque. null/ausente = sin título (previews). */
  title?: string | null;
  /** Selección. Si no se pasa, las tarjetas se renderizan no interactivas (preview). */
  onSelect?: (units: number) => void;
  /**
   * Paleta del repo consumidor.
   *
   * LIMITACIÓN CONOCIDA (a decidir en la fase 3): el skin 'admin' usa los grises
   * del ERP, no los colores del tenant. El mini-preview del panel de Diseño vive
   * en procurva2, así que el comerciante va a ver una previa con la paleta de
   * ProCurva y no con la de su propia tienda. El preview grande no tiene el
   * problema (es un iframe a la tienda real) pero exige guardar.
   */
  skin?: 'storefront' | 'admin';
  /** Presentación. Default 'cards' (ver QUANTITY_TIERS_DEFAULTS). */
  layout?: QuantityTiersLayout;
  /** Muestra "Ahorrás $X en total" en los escalones con ahorro. Default false. */
  showSavings?: boolean;
  /** Muestra la línea "$X tarjeta". Default true. */
  showCardPrice?: boolean;
}

/**
 * Columnas de la grilla en layout 'cards'.
 *
 * Con EXACTAMENTE 4 escalones va 2×2: con 3 columnas el cuarto quedaba huérfano
 * en una segunda fila, a media caja. 3, 5 o más siguen en 3 columnas (5 deja un
 * hueco, pero la fila incompleta queda al final y no desbalancea).
 */
function cardsGridCols(count: number): string {
  if (count === 4) return 'grid-cols-2';
  return count >= 3 ? 'grid-cols-3' : 'grid-cols-2';
}

/**
 * Sets de clases por paleta. Literales (no plantillas) para que Tailwind los vea.
 *
 * OJO con la translucidez, que es distinta en cada repo:
 *
 *  - En el ADMIN los colores del tema son hex estáticos en tailwind.config.js
 *    (accent: '#0052FF'), así que los modificadores de opacidad de Tailwind
 *    funcionan normal: `border-accent/50`, `bg-accent-soft/60`.
 *
 *  - En el STOREFRONT son `var(--color-*)` inyectadas en runtime por tenant, y
 *    SIN el placeholder `<alpha-value>`. Tailwind NO genera la clase con
 *    modificador sobre esos tokens: `bg-accent/10` no existe en el CSS de salida
 *    y el elemento se cae en silencio (ni error de build ni de tipos). Por eso
 *    acá la translucidez va con `color-mix()` en valor arbitrario, que sí
 *    resuelve la var en runtime. Mismo CSS que ya se usa inline en
 *    WholesalePurchasePanel y CardBadge.
 *
 * No unifiques las dos ramas en una sola clase: lo que funciona en un repo se
 * cae mudo en el otro.
 */
const SKINS = {
  storefront: {
    surface: 'bg-background',
    borderIdle: 'border-line hover:border-text',
    borderFeatured: 'border-[color:color-mix(in_srgb,var(--color-accent)_50%,transparent)] hover:border-accent',
    borderActive: 'border-accent bg-[color:color-mix(in_srgb,var(--color-accent)_5%,transparent)]',
    heading: 'text-muted',
    title: 'text-text',
    muted: 'text-subtle',
    badge: 'bg-[color:color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-accent',
    ribbon: 'bg-accent text-on-accent',
    price: 'text-accent',
    // 'list': el seleccionado se marca sólo con el borde, sin cambiar el fondo.
    borderActiveFlat: 'border-accent',
    dotIdle: 'border-line',
  },
  admin: {
    surface: 'bg-white dark:bg-gray-900',
    borderIdle: 'border-gray-200 dark:border-gray-700 hover:border-gray-400',
    // check-dead-opacity: ok — el skin 'admin' sólo se usa en procurva2, donde
    // `accent` es un hex estático y el modificador de opacidad sí se genera.
    borderFeatured: 'border-accent/50 hover:border-accent',
    borderActive: 'border-accent bg-accent-soft/60',
    heading: 'text-gray-400',
    title: 'text-gray-900 dark:text-white',
    muted: 'text-gray-400',
    badge: 'bg-accent-soft text-accent',
    ribbon: 'bg-accent text-white',
    price: 'text-accent',
    borderActiveFlat: 'border-accent',
    dotIdle: 'border-gray-300 dark:border-gray-600',
  },
} as const;

export function QuantityTierSelector({
  options,
  formatPrice,
  title,
  onSelect,
  skin = 'storefront',
  layout = QUANTITY_TIERS_DEFAULTS.quantityTiersLayout,
  showSavings = QUANTITY_TIERS_DEFAULTS.quantityTiersShowSavings,
  showCardPrice = QUANTITY_TIERS_DEFAULTS.quantityTiersShowCardPrice,
}: Props) {
  // `name` único por instancia: dos bloques de escalones en la misma página
  // (ej. producto + recomendado) se pisarían la selección si lo compartieran.
  const groupName = `qty-tiers-${useId()}`;
  if (options.length === 0) return null;
  const s = SKINS[skin];
  const isList = layout === 'list';
  // Sin onSelect el bloque es una ilustración (previews del admin): sin radios,
  // sin foco y sin radiogroup, para no meter controles fantasma en la página.
  const interactive = !!onSelect;
  // En 'cards' el renglón del ahorro se reserva aunque el escalón no tenga
  // (el baseline "Lleva 1" nunca ahorra), si no las tarjetas quedan desparejas.
  const anySavings = showSavings && options.some((t) => (t.savings ?? 0) > 0);

  /**
   * Envoltorio de una opción. Con onSelect es un <label> con un <input radio>
   * sr-only adentro: así el grupo se navega con flechas, tiene roving tabindex
   * y lo anuncia el lector de pantalla sin implementar nada a mano.
   *
   * Es una función que devuelve JSX, NO un componente: declarado como componente
   * dentro del render, su identidad cambiaría en cada render y React remontaría
   * los radios, perdiendo el foco justo mientras se navega con las flechas.
   */
  const option = (t: QuantityTierOption, className: string, children: ReactNode) => {
    if (!interactive) {
      return (
        <div key={t.units} className={className}>
          {children}
        </div>
      );
    }
    return (
      <label
        key={t.units}
        className={`${className} cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-1`}
      >
        <input
          type="radio"
          name={groupName}
          className="sr-only"
          checked={!!t.isActive}
          onChange={() => onSelect?.(t.units)}
        />
        {children}
      </label>
    );
  };

  /** Punto de radio visible (sólo en 'list'; en 'cards' la selección es el borde). */
  const radioDot = (active: boolean) => (
    <span
      aria-hidden="true"
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
        active ? 'border-accent' : s.dotIdle
      }`}
    >
      {active && <span className="h-2 w-2 rounded-full bg-accent" />}
    </span>
  );

  return (
    <div className="space-y-2">
      {title ? (
        <p className={`text-[12px] font-semibold uppercase tracking-[0.06em] ${s.heading}`}>{title}</p>
      ) : null}
      <div
        role={interactive ? 'radiogroup' : undefined}
        aria-label={interactive ? title || 'Cantidad' : undefined}
        className={isList ? 'flex flex-col gap-2' : `grid gap-2 ${cardsGridCols(options.length)}`}
      >
        {options.map((t) => {
          const active = !!t.isActive;
          const featured = !!t.isFeatured;
          const savings = t.savings ?? 0;

          if (isList) {
            return option(
              t,
              // `relative` para la cinta del destacado, que va montada sobre el
              // borde superior. `mt-3` SÓLO en la fila con cinta: la mitad que
              // sobresale (~11px) pisaría la fila de arriba —o el título, si le
              // toca ser la primera— con el gap-2 (8px) del contenedor.
              `relative flex items-center gap-3 rounded-lg border-[1.5px] px-3 py-2.5 transition-all ${
                featured ? 'mt-3 ' : ''
              }${s.surface} ${active ? s.borderActiveFlat : featured ? s.borderFeatured : s.borderIdle}`,
              <>
                {featured && (
                  // Montada sobre el borde: mitad adentro, mitad afuera
                  // (-translate-y-1/2 sobre top-0). Anclada a la DERECHA: a la
                  // izquierda chocaría con el radio.
                  //
                  // MEDIDO a 360/375/390px, con Urbanist y con Verdana, precios de
                  // 5 y 6 dígitos, 3 y 4 escalones: fuera del flujo, la 1ª línea
                  // ("Lleva N" + "% OFF") nunca se parte —holgura mínima 67px— y la
                  // fila queda en 1/2/3 renglones según los toggles, nunca 4. La
                  // cinta sobresale 11px y el mt-3 de la fila (12px) evita que pise
                  // la fila de arriba o el título.
                  <span
                    className={`absolute right-3 top-0 -translate-y-1/2 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${s.ribbon}`}
                  >
                    Más elegido
                  </span>
                )}
                {radioDot(active)}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[13px] font-bold ${s.title}`}>Lleva {t.units}</span>
                    {t.discountPct > 0 && (
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${s.badge}`}>
                        {t.discountPct}% OFF
                      </span>
                    )}
                  </span>
                  {showCardPrice && t.cardPrice != null && (
                    <span className={`text-[11px] ${s.muted}`}>{formatPrice(t.cardPrice)} tarjeta c/u</span>
                  )}
                  {showSavings && savings > 0 && (
                    <span className={`text-[11px] font-semibold ${s.price}`}>
                      Ahorrás {formatPrice(savings)} en total
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 flex-col items-end leading-tight">
                  {t.strikePrice != null && (
                    <span className={`text-[11px] line-through ${s.muted}`}>{formatPrice(t.strikePrice)}</span>
                  )}
                  <span className={`text-[15px] font-extrabold ${s.price}`}>
                    {formatPrice(t.unitPrice)} <span className={`text-[10px] font-medium ${s.muted}`}>c/u</span>
                  </span>
                </span>
              </>,
            );
          }

          return option(
            t,
            `relative flex flex-col items-center gap-1 rounded-lg border-[1.5px] px-2 py-3 text-center transition-all ${
              active ? s.borderActive : `${s.surface} ${featured ? s.borderFeatured : s.borderIdle}`
            }`,
            <>
              {featured && (
                <span
                  className={`absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${s.ribbon}`}
                >
                  Más elegido
                </span>
              )}
              <span className={`text-[13px] font-bold ${s.title}`}>Lleva {t.units}</span>
              {t.discountPct > 0 ? (
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${s.badge}`}>{t.discountPct}% OFF</span>
              ) : (
                <span className={`text-[11px] font-semibold ${s.muted}`}>Precio normal</span>
              )}
              <span className="flex flex-col items-center leading-tight">
                {t.strikePrice != null && (
                  <span className={`text-[11px] line-through ${s.muted}`}>{formatPrice(t.strikePrice)}</span>
                )}
                <span className={`text-[15px] font-extrabold ${s.price}`}>{formatPrice(t.unitPrice)}</span>
                {showCardPrice && t.cardPrice != null && (
                  <span className={`mt-0.5 text-[10px] ${s.muted}`}>{formatPrice(t.cardPrice)} tarjeta</span>
                )}
                <span className={`mt-0.5 text-[10px] ${s.muted}`}>c/u</span>
                {anySavings && (
                  <span className={`mt-0.5 text-[10px] font-semibold ${savings > 0 ? s.price : 'invisible'}`}>
                    {savings > 0 ? `Ahorrás ${formatPrice(savings)} en total` : 'Ahorro'}
                  </span>
                )}
              </span>
            </>,
          );
        })}
      </div>
    </div>
  );
}
