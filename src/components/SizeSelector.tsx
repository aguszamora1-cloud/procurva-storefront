import { useId } from 'react';

/**
 * Estado "elegido" de un chip de variante. UN SOLO lenguaje para talle y color:
 * lo importa ColorSelector de acá en vez de repetir las clases, así no se pueden
 * ir separando de a poco.
 *
 * Es un borde, no un bloque sólido: el chip de color relleno de `primary` (negro
 * en casi todos los tenants) pesaba tanto que dominaba la columna entera, y el
 * círculo del color —que es lo que el comprador viene a mirar— quedaba nadando
 * adentro. Con el borde alcanza: el chip sin elegir tiene `border-line`, que es
 * ink al 12%, así que contra ink al 100% la diferencia es inconfundible, y el
 * `font-bold` la refuerza.
 */
export const SELECTED_CHIP = 'border-text bg-background font-bold text-text';

interface Props {
  sizes: string[];
  selected: string | null;
  isDisabled: (size: string) => boolean;
  onSelect: (size: string) => void;
  /**
   * Oculta el encabezado "TALLE: M". Lo usan las filas por unidad del modo
   * escalón, donde el encabezado va UNA sola vez arriba de todas las filas.
   */
  hideHeading?: boolean;
  /** aria-label del radiogroup. Default "Talle" (por unidad: "Talle de la unidad 2"). */
  ariaLabel?: string;
}

/**
 * Selector de talle: chips en píldora.
 *
 * MEDIDAS (no las bajes sin volver a medir): 44px de alto en touch — el mínimo
 * táctil, esto se usa con el dedo — y 36px con mouse (`pointer-fine:`, ver
 * tailwind.config.js), donde 44px se ven macizos. La base es la táctil: si el
 * navegador no soporta la media query queda el tamaño accesible. El padding
 * horizontal y el ancho mínimo bajan en la misma proporción.
 *
 * El ancho es AL CONTENIDO con un mínimo, no una caja fija. La caja de 48px
 * anterior gastaba ese ancho para mostrar una sola letra: en la columna derecha
 * de la ficha a 768px (267px, ver lib/types.ts) entraban 4 talles por fila; así
 * entran 5.
 *
 * El tope de 140px + `truncate` + `title` es por los datos reales: hay talles
 * cargados como descripción ("ABARCA HASTA 4XL", "S.M. L. XL. XXL"). Sin tope,
 * uno solo de ésos se come la fila entera.
 *
 * Accesibilidad: radiogroup real (mismo patrón que QuantityTierSelector y
 * ColorSelector), con un <input type="radio"> sr-only dentro de cada <label>.
 * Los talles sin stock van `disabled` en el input además del tachado visual, así
 * que la navegación con flechas también los saltea.
 */
export function SizeSelector({ sizes, selected, isDisabled, onSelect, hideHeading, ariaLabel }: Props) {
  // `name` único por instancia: en modo escalón hay un SizeSelector por unidad
  // y se pisarían la selección entre ellos si compartieran el name.
  const groupName = `size-${useId()}`;
  if (sizes.length === 0) return null;
  return (
    <div>
      {!hideHeading && (
        <p className="mb-2 flex items-baseline text-[13px] font-semibold text-muted">
          <span className="shrink-0">Talle</span>
          {selected && (
            <span className="min-w-0 truncate text-text" title={selected}>
              : {selected}
            </span>
          )}
        </p>
      )}
      <div role="radiogroup" aria-label={ariaLabel ?? 'Talle'} className="flex flex-wrap gap-1.5">
        {sizes.map((s) => {
          const disabled = isDisabled(s);
          const active = selected === s;
          return (
            <label
              key={s}
              title={s}
              className={`inline-flex h-11 min-w-[40px] max-w-[140px] cursor-pointer items-center justify-center rounded-full border-[1.5px] px-2.5 text-[14px] tracking-wide transition-all duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-1 pointer-fine:h-9 pointer-fine:min-w-[34px] pointer-fine:px-2 ${
                active
                  ? SELECTED_CHIP
                  : disabled
                    ? 'cursor-not-allowed border-line bg-secondary font-semibold text-subtle line-through'
                    : 'border-line bg-background font-semibold text-text hover:border-text'
              }`}
            >
              <input
                type="radio"
                name={groupName}
                className="sr-only"
                checked={active}
                disabled={disabled}
                onChange={() => onSelect(s)}
              />
              <span className="min-w-0 truncate">{s}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
