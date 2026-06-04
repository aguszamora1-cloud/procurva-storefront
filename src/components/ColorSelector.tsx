import { colorToHex } from '@/lib/utils';

interface Props {
  colors: string[];
  selected: string | null;
  onSelect: (color: string) => void;
}

/** Selector de color con swatches circulares (estilo RSW quick-add). */
export function ColorSelector({ colors, selected, onSelect }: Props) {
  if (colors.length === 0) return null;
  return (
    <div>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[1.5px] text-muted">
        Color{selected && <span className="text-text">: {selected}</span>}
      </p>
      <div className="flex flex-wrap gap-2.5">
        {colors.map((c) => {
          const active = selected === c;
          return (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={`Color ${c}`}
              onClick={() => onSelect(c)}
              className={`shape-circle h-9 w-9 border transition-all ${
                active ? 'border-text ring-2 ring-text ring-offset-2' : 'border-line hover:border-subtle'
              }`}
              style={{ backgroundColor: colorToHex(c) }}
            />
          );
        })}
      </div>
    </div>
  );
}
