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
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
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
              className={`h-12 min-w-[48px] rounded border-[1.5px] px-3 text-[14px] tracking-wide transition-all duration-150 ${
                active
                  ? 'border-text bg-primary font-bold text-on-primary'
                  : disabled
                    ? 'cursor-not-allowed border-line bg-secondary font-semibold text-subtle line-through'
                    : 'border-line bg-background font-semibold text-text hover:border-text'
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
