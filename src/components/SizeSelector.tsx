interface Props {
  sizes: string[];
  selected: string | null;
  isDisabled: (size: string) => boolean;
  onSelect: (size: string) => void;
}

/** Selector de talle con botones (estilo RSW). */
export function SizeSelector({ sizes, selected, isDisabled, onSelect }: Props) {
  if (sizes.length === 0) return null;
  return (
    <div>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[1.5px] text-muted">
        Talle{selected && <span className="text-text">: {selected}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {sizes.map((s) => {
          const disabled = isDisabled(s);
          const active = selected === s;
          return (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onSelect(s)}
              className={`h-12 min-w-[48px] rounded-lg border-2 px-3 text-[13px] font-semibold tracking-wide transition-all duration-150 ${
                active
                  ? 'border-text bg-primary text-on-primary'
                  : disabled
                    ? 'cursor-not-allowed border-line bg-secondary text-subtle line-through'
                    : 'border-line bg-background text-text hover:border-text'
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
