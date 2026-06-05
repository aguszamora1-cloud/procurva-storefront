import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { colorToHex, formatPrice } from '@/lib/utils';

export interface ProductFiltersProps {
  categories: string[];
  sizes: string[];
  colors: string[];
  priceBounds: { min: number; max: number };
  selectedCats: Set<string>;
  selectedSizes: Set<string>;
  selectedColors: Set<string>;
  priceMin: string;
  priceMax: string;
  onToggleCat: (v: string) => void;
  onToggleSize: (v: string) => void;
  onToggleColor: (v: string) => void;
  onPriceMin: (v: string) => void;
  onPriceMax: (v: string) => void;
}

/** Sección colapsable del sidebar de filtros. */
function Accordion({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <span className="text-[13px] font-semibold uppercase tracking-[1px] text-on-surface">
          {title}
          {count ? <span className="ml-2 text-on-surface-subtle">({count})</span> : null}
        </span>
        <ChevronDown className={`h-4 w-4 text-on-surface-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-5">{children}</div>}
    </div>
  );
}

/** Checkbox nativo con color de acento del tenant. */
function CheckboxRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-on-surface">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ accentColor: 'var(--color-accent)' }}
        className="h-4 w-4 shrink-0 cursor-pointer"
      />
      {children}
    </label>
  );
}

/**
 * Sidebar de filtros (categorías, talles, colores, precio). Sólo renderiza los
 * accordions; el encabezado (título + "Limpiar filtros") lo pone el contenedor.
 */
export function ProductFilters(props: ProductFiltersProps) {
  const {
    categories,
    sizes,
    colors,
    priceBounds,
    selectedCats,
    selectedSizes,
    selectedColors,
    priceMin,
    priceMax,
    onToggleCat,
    onToggleSize,
    onToggleColor,
    onPriceMin,
    onPriceMax,
  } = props;

  return (
    <div>
      {categories.length > 0 && (
        <Accordion title="Categorías" count={selectedCats.size || undefined}>
          <ul className="space-y-2.5">
            {categories.map((c) => (
              <li key={c}>
                <CheckboxRow checked={selectedCats.has(c)} onChange={() => onToggleCat(c)}>
                  <span className="capitalize">{c}</span>
                </CheckboxRow>
              </li>
            ))}
          </ul>
        </Accordion>
      )}

      {sizes.length > 0 && (
        <Accordion title="Talles" count={selectedSizes.size || undefined}>
          <ul className="space-y-2.5">
            {sizes.map((s) => (
              <li key={s}>
                <CheckboxRow checked={selectedSizes.has(s)} onChange={() => onToggleSize(s)}>
                  <span className="uppercase">{s}</span>
                </CheckboxRow>
              </li>
            ))}
          </ul>
        </Accordion>
      )}

      {colors.length > 0 && (
        <Accordion title="Colores" count={selectedColors.size || undefined}>
          <ul className="space-y-2.5">
            {colors.map((c) => (
              <li key={c}>
                <CheckboxRow checked={selectedColors.has(c)} onChange={() => onToggleColor(c)}>
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-line"
                    style={{ backgroundColor: colorToHex(c) }}
                  />
                  <span className="capitalize">{c}</span>
                </CheckboxRow>
              </li>
            ))}
          </ul>
        </Accordion>
      )}

      <Accordion title="Precio">
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={priceMin}
            onChange={(e) => onPriceMin(e.target.value)}
            placeholder={String(priceBounds.min)}
            aria-label="Precio mínimo"
            className="w-full border border-line bg-background px-3 py-2 text-[13px] text-on-surface outline-none focus:border-accent"
          />
          <span className="text-on-surface-subtle">—</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={priceMax}
            onChange={(e) => onPriceMax(e.target.value)}
            placeholder={String(priceBounds.max)}
            aria-label="Precio máximo"
            className="w-full border border-line bg-background px-3 py-2 text-[13px] text-on-surface outline-none focus:border-accent"
          />
        </div>
        {priceBounds.max > 0 && (
          <p className="mt-2 text-[11px] text-on-surface-subtle">
            Rango: {formatPrice(priceBounds.min)} – {formatPrice(priceBounds.max)}
          </p>
        )}
      </Accordion>
    </div>
  );
}
