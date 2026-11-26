import { useId, type ComponentType } from 'react';
import { useStore } from '@/context/StoreProvider';
import { formatPrice } from '@/lib/utils';
import type { TierPurchase } from '@/hooks/useTierPurchase';
import type { PdpState } from './commerce';

/**
 * Escalones «Lleva N» en las plantillas (P1.2-B2). Sólo presentación: los números
 * (precio por unidad, tarjeta, ahorro, destacado) llegan YA CALCULADOS por
 * useTierPurchase, el mismo hook de Classic. Respeta los ajustes del comercio que
 * usa QuantityTierSelector (mostrar ahorro, mostrar tarjeta, tarjetas o lista).
 *
 * Cada plantilla le da su estilo con su prefijo de clases (`at`, `di`, `mo`).
 * Las opciones son radios nativos dentro de labels: se recorren con flechas y
 * el lector de pantalla las anuncia como un grupo, igual que en Classic.
 */
export function TierPicker({ tier, prefix }: { tier: TierPurchase; prefix: string }) {
  const config = useStore();
  const name = `${prefix}-tiers-${useId()}`;
  if (!tier.hasTiers) return null;
  const list = config.quantityTiersLayout === 'list';
  return (
    <fieldset className={`${prefix}-tiers`} data-layout={list ? 'list' : 'cards'} data-count={tier.tierOptions.length}>
      <legend>Elegí cuántas llevás</legend>
      <div className={`${prefix}-tiers__opts`}>
        {tier.tierOptions.map((o) => (
          <label key={o.units} className={`${prefix}-tier`} data-active={o.isActive || undefined} data-featured={o.isFeatured || undefined}>
            <input type="radio" className="tpl-sr" name={name} checked={!!o.isActive} onChange={() => tier.setTierUnits(o.units)} />
            {o.isFeatured && <span className={`${prefix}-tier__badge`}>Más elegido</span>}
            <span className={`${prefix}-tier__head`}>
              <span className={`${prefix}-tier__units`}>Lleva {o.units}</span>
              {o.discountPct > 0 && <span className={`${prefix}-tier__off`}>{o.discountPct}% OFF</span>}
            </span>
            <span className={`${prefix}-tier__price`}>
              {o.strikePrice != null && <s>{formatPrice(o.strikePrice)}</s>}
              <b>{formatPrice(o.unitPrice)}</b> c/u
            </span>
            {config.quantityTiersShowCardPrice && o.cardPrice != null && (
              <span className={`${prefix}-tier__card`}>{formatPrice(o.cardPrice)} con tarjeta c/u</span>
            )}
            {config.quantityTiersShowSavings && (o.savings ?? 0) > 0 && (
              <span className={`${prefix}-tier__save`}>Ahorrás {formatPrice(o.savings as number)} en total</span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Lo que recibe el selector de color y talle de cada plantilla. */
export interface ChoicesProps {
  colors: string[];
  sizes: string[];
  color: string | null;
  size: string | null;
  onColor: (c: string) => void;
  onSize: (s: string) => void;
  colorDisabled: (c: string) => boolean;
  sizeDisabled: (s: string) => boolean;
}

/**
 * Filas por unidad: una por unidad del escalón, cada una con el selector de
 * color y talle PROPIO de la plantilla. Mismas reglas que UnitVariantRows de
 * Classic: cambiar el color de una unidad borra su talle; los talles se
 * deshabilitan según el color de esa unidad.
 */
export function TierUnits({ tier, pdp, prefix, Choices }: { tier: TierPurchase; pdp: PdpState; prefix: string; Choices: ComponentType<ChoicesProps> }) {
  if (!tier.perUnitOpen) return null;
  return (
    <div className={`${prefix}-units`}>
      {tier.tierSelections.map((sel, i) => (
        <fieldset key={i} className={`${prefix}-unit`} data-unit={i}>
          <legend>Unidad {i + 1}</legend>
          <Choices
            colors={pdp.colors}
            sizes={pdp.unitSizes}
            color={sel.color}
            size={sel.size}
            onColor={(c) => tier.updateTierUnit(i, { color: c, size: null })}
            onSize={(s) => tier.updateTierUnit(i, { size: s })}
            colorDisabled={pdp.colorDisabled}
            sizeDisabled={tier.sizeDisabledFor(sel.color)}
          />
        </fieldset>
      ))}
    </div>
  );
}
