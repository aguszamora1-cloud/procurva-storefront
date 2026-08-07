import { useId } from 'react';
import { resolveColorHex } from '@/lib/colorHelper';
import { SELECTED_CHIP } from '@/components/SizeSelector';

/**
 * Nombre de color para mostrar, en capitalización normal: "Blanco", no "BLANCO".
 *
 * `product_variants.color` es texto libre y viene en cualquier caja según cómo
 * lo cargó cada comercio ("NEGRO", "negro", "Gris Melange"), así que no alcanza
 * con la clase `capitalize` de CSS —que no baja lo que ya está en mayúscula—:
 * hay que normalizar a minúscula y levantar la primera letra.
 *
 * Sólo la PRIMERA, no cada palabra: "Rosa viejo" y "Animal print" se leen como
 * lo que son, un nombre; "Rosa Viejo" parece un título.
 */
export function displayColorName(color: string): string {
  const limpio = color.trim();
  if (!limpio) return limpio;
  return limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase();
}

interface Props {
  colors: string[];
  selected: string | null;
  /** Color sin ninguna variante con stock. Opcional: sin él, ninguno se deshabilita. */
  isDisabled?: (color: string) => boolean;
  onSelect: (color: string) => void;
  /**
   * Oculta el encabezado "COLOR: Negro". Lo usan las filas por unidad del modo
   * escalón, donde el encabezado va UNA sola vez arriba de todas las filas.
   */
  hideHeading?: boolean;
  /** aria-label del radiogroup. Default "Color" (por unidad: "Color de la unidad 2"). */
  ariaLabel?: string;
}

/**
 * Selector de color de la ficha: círculo del color + nombre, en chip de píldora.
 *
 * Misma forma y mismas medidas que SizeSelector (44px en touch, 36px con mouse)
 * y el MISMO tratamiento de "elegido" (`SELECTED_CHIP`, importado de allá): los
 * dos chips viven pegados en la misma zona, así que con formas o estados
 * distintos se leían como dos controles de sistemas diferentes.
 *
 * El círculo se pinta SÓLO si resolveColorHex() conoce el color. Cuando no lo
 * conoce el chip queda de puro texto, sin punto: `product_variants.color` es
 * texto libre y un punto gris de fallback afirmaría que el producto es gris,
 * que es peor que no decir nada. Con los datos reales eso pasa en ~29% de los
 * colores (inglés, plurales, códigos numéricos, "animal print").
 *
 * El nombre va SIEMPRE visible, no sólo en tooltip: es lo único que identifica
 * al color cuando no hay círculo. Va truncado con `title` porque hay comercios
 * que usan el campo color como descripción completa del producto — el más largo
 * medido en producción tiene 79 caracteres.
 *
 * Accesibilidad: radiogroup real (mismo patrón que QuantityTierSelector), con
 * un <input type="radio"> sr-only dentro de cada <label>. Así el grupo se navega
 * con flechas, tiene roving tabindex, saltea los deshabilitados y lo anuncia el
 * lector de pantalla, sin implementar nada a mano.
 */
export function ColorSelector({ colors, selected, isDisabled, onSelect, hideHeading, ariaLabel }: Props) {
  // `name` único por instancia: en modo escalón hay un ColorSelector por unidad
  // y se pisarían la selección entre ellos si compartieran el name.
  const groupName = `color-${useId()}`;
  if (colors.length === 0) return null;
  return (
    <div>
      {!hideHeading && (
        <p className="mb-2 flex items-baseline text-[13px] font-semibold text-muted">
          <span className="shrink-0">Color</span>
          {selected && (
            <span className="min-w-0 truncate text-text" title={displayColorName(selected)}>
              : {displayColorName(selected)}
            </span>
          )}
        </p>
      )}
      <div role="radiogroup" aria-label={ariaLabel ?? 'Color'} className="flex flex-wrap gap-1.5">
        {colors.map((color) => {
          const disabled = isDisabled?.(color) ?? false;
          const active = selected === color;
          const hex = resolveColorHex(color);
          return (
            <label
              key={color}
              title={displayColorName(color)}
              className={`inline-flex h-11 max-w-[160px] cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-3 text-[14px] transition-all duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-1 pointer-fine:h-9 pointer-fine:gap-1.5 pointer-fine:px-2.5 ${
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
                onChange={() => onSelect(color)}
              />
              {/* CONTORNO DEL CÍRCULO — dos hairlines, siempre las mismas, sin
                  ninguna regla condicional por luminancia del color:

                   - `ring-inset` negro al 25%, POR DENTRO: es el que separa un
                     círculo claro (blanco, beige, crema) del chip sin
                     seleccionar, que también es claro. Ahí estaba el bug: con el
                     10% anterior, blanco sobre blanco directamente no se veía.
                   - `outline` blanco al 50%, POR FUERA: el caso inverso, un
                     círculo oscuro sobre chip oscuro. Pasa en los tenants con
                     `--color-background` oscuro. Va como outline y no como
                     border para no comerse 1px del relleno.

                  Las dos juntas cubren cualquier combinación de color de círculo
                  y de fondo de chip: la que no aporta queda invisible, no
                  molesta. `border-line`, que era el contorno anterior, es ink al
                  12% y se desvanece en los dos casos.

                  OJO si tocás esto: los tokens del tenant son `var(--color-*)`
                  sin `<alpha-value>`, así que Tailwind NO genera los
                  modificadores de opacidad sobre ellos (border-on-primary/40 y
                  compañía se caen silenciosamente al gris por defecto). Sobre
                  black/white sí funcionan, porque son colores estáticos — por
                  eso este contorno va en black/white y no en tokens.

                  Los swatches de ProductCard usan EXACTAMENTE este contorno (los
                  mismos dos valores). Si tocás uno, tocá el otro. */}
              {hex && (
                <span
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 rounded-full outline outline-1 outline-white/50 ring-1 ring-inset ring-black/25 ${
                    disabled ? 'opacity-40' : ''
                  }`}
                  style={{ backgroundColor: hex }}
                />
              )}
              <span className="min-w-0 truncate">{displayColorName(color)}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
