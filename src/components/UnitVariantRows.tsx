import type { CSSProperties } from 'react';
import { ColorSelector } from '@/components/ColorSelector';
import { SizeSelector } from '@/components/SizeSelector';

export interface UnitSelection {
  size: string | null;
  color: string | null;
}

interface Props {
  /** Una entrada por unidad del escalón. El largo manda: N bloques. */
  selections: UnitSelection[];
  sizes: string[];
  colors: string[];
  /** Talles sin stock para el color de esa unidad. */
  sizeDisabledFor: (color: string | null) => (size: string) => boolean;
  /** Color sin stock (no cruza con el talle, ver ProductDetail). */
  colorDisabled: (color: string) => boolean;
  onChange: (index: number, patch: Partial<UnitSelection>) => void;
}

/**
 * Elección de variante unidad por unidad, en modo escalón ("Lleva 3").
 *
 * FORMA: agrupado POR UNIDAD. Cada unidad es un bloque —"Unidad N", después sus
 * chips de color y abajo los de talle— y las unidades se separan con una
 * hairline. Es el orden en que piensa el comprador: "la unidad 2 la quiero
 * blanca y L". Agrupar por atributo (todos los colores primero, todos los talles
 * después) parte esa decisión en dos secciones distantes.
 *
 * SIN encabezados: ni los sub-encabezados COLOR/TALLE por unidad —los chips se
 * distinguen solos, los de color llevan círculo + nombre y los de talle son
 * cortos— ni uno general arriba de todo, que decía lo mismo que el "Unidad 1" de
 * 4px más abajo. Medido: ese encabezado costaba 24px de los 671px que hay hasta
 * el primer chip de talle.
 *
 * Sin borde ni caja: la separación la da la hairline, nada más.
 *
 * COLOR va primero dentro de cada unidad, igual que en el flujo suelto: el talle
 * disponible se calcula contra el color de esa unidad (elegir color resetea el
 * talle), así que el color es el eje que manda.
 */
export function UnitVariantRows({ selections, sizes, colors, sizeDisabledFor, colorDisabled, onChange }: Props) {
  if (selections.length === 0 || (colors.length === 0 && sizes.length === 0)) return null;

  return (
    <div className="divide-y divide-line">
      {selections.map((sel, i) => (
        // `key` por índice a propósito: hace que al subir de escalón sólo las
        // filas NUEVAS sean nodos nuevos, y la animación de entrada —que la
        // dispara el montaje— corra sólo en ellas. Ver .animate-unit-row-in en
        // globals.css: el escalonado sale de --unit-index.
        <div
          key={i}
          className="animate-unit-row-in space-y-1 py-2.5 first:pt-1 last:pb-0"
          style={{ '--unit-index': i } as CSSProperties}
        >
          <p className="text-[12px] font-semibold text-subtle">Unidad {i + 1}</p>
          {colors.length > 0 && (
            <ColorSelector
              colors={colors}
              selected={sel.color}
              isDisabled={colorDisabled}
              onSelect={(c) => onChange(i, { color: c, size: null })}
              hideHeading
              ariaLabel={`Color de la unidad ${i + 1}`}
            />
          )}
          {sizes.length > 0 && (
            <SizeSelector
              sizes={sizes}
              selected={sel.size}
              isDisabled={sizeDisabledFor(sel.color)}
              onSelect={(s) => onChange(i, { size: s })}
              hideHeading
              ariaLabel={`Talle de la unidad ${i + 1}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
