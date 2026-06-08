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
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
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
              className={`h-11 rounded-lg border-[1.5px] px-4 text-[14px] uppercase tracking-wide transition-all duration-150 ${
                active ? 'border-text bg-primary font-bold text-on-primary' : 'border-line bg-background font-semibold text-text hover:border-text'
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
