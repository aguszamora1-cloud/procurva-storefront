interface Props {
  colors: string[];
  selected: string | null;
  onSelect: (color: string) => void;
}

/** Selector de color con botones de texto (estilo ficha de RSW: NEGRO, GRIS...). */
export function ColorSelector({ colors, selected, onSelect }: Props) {
  if (colors.length === 0) return null;
  return (
    <div>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[1.5px] text-muted">
        Color{selected && <span className="text-text">: {selected}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => {
          const active = selected === color;
          return (
            <button
              key={color}
              type="button"
              onClick={() => onSelect(color)}
              className={`h-11 rounded-lg border-2 px-4 text-[13px] font-semibold uppercase tracking-wide transition-all duration-150 ${
                active ? 'border-text bg-primary text-on-primary' : 'border-line bg-background text-text hover:border-text'
              }`}
            >
              {color}
            </button>
          );
        })}
      </div>
    </div>
  );
}
