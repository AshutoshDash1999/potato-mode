// A chunky cartoon segmented control (radio group).

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  emoji?: string;
  title?: string;
}

interface Props<T extends string | number> {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function Segmented<T extends string | number>({ label, value, options, onChange, disabled }: Props<T>) {
  return (
    <div className="pm-seg" role="radiogroup" aria-label={label}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            title={opt.title}
            disabled={disabled}
            className={`pm-seg__opt${selected ? ' is-selected' : ''}`}
            onClick={() => !selected && onChange(opt.value)}
          >
            {opt.emoji && (
              <span className="pm-seg__emoji" aria-hidden="true">
                {opt.emoji}
              </span>
            )}
            <span className="pm-seg__label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
