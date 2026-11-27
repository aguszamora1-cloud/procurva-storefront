/**
 * Atelier 2 · A4: color y talle (contrato ChoicesProps de shared/TierPicker).
 *
 * Lo usan la ficha (selección única) y cada unidad de un escalón «Lleva N»
 * (TierUnits). Sólo dibuja: qué color o talle está agotado lo deciden usePdp y
 * useTierPurchase. Diferencia con Atelier 1: un color sin stock queda
 * deshabilitado (en Atelier 1 se podía tocar y después ningún talle servía). No
 * cambia qué se puede comprar: el talle agotado ya estaba deshabilitado.
 */

import { colorToHex } from '@/lib/utils';
import type { ChoicesProps } from '../shared/TierPicker';

export function Atelier2Choices({ colors, sizes, color, size, onColor, onSize, colorDisabled, sizeDisabled }: ChoicesProps) {
  return (
    <>
      {colors.length > 0 && (
        <fieldset className="a2-pick">
          <legend className="a2-pick__l">
            Color{color ? <b> {color}</b> : null}
          </legend>
          <div className="a2-sw">
            {colors.map((c) => {
              const out = colorDisabled(c);
              return (
                <button
                  key={c}
                  type="button"
                  className="a2-sw__b"
                  aria-pressed={color === c}
                  aria-label={`${c}${out ? ', sin stock' : ''}`}
                  title={out ? `${c} (sin stock)` : c}
                  disabled={out}
                  onClick={() => onColor(c)}
                >
                  <i style={{ backgroundColor: colorToHex(c) }} />
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      {sizes.length > 0 && (
        <fieldset className="a2-pick">
          <legend className="a2-pick__l">
            Talle{size ? <b> {size}</b> : null}
          </legend>
          <div className="a2-sz">
            {sizes.map((s) => {
              const out = sizeDisabled(s);
              return (
                <button
                  key={s}
                  type="button"
                  className="a2-sz__b"
                  aria-pressed={size === s}
                  aria-label={`Talle ${s}${out ? ', sin stock' : ''}`}
                  disabled={out}
                  onClick={() => onSize(s)}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
    </>
  );
}
