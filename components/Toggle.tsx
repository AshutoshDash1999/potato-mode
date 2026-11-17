// A cartoon on/off switch with a label and an optional hint underneath.

interface Props {
  label: string;
  emoji?: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function Toggle({ label, emoji, hint, checked, disabled, onChange }: Props) {
  return (
    <label className={`pm-toggle${disabled ? ' is-disabled' : ''}`}>
      <span className="pm-toggle__text">
        <span className="pm-toggle__label">
          {emoji && <span aria-hidden="true">{emoji} </span>}
          {label}
        </span>
        {hint && <span className="pm-toggle__hint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="pm-toggle__input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="pm-toggle__track" aria-hidden="true">
        <span className="pm-toggle__knob" />
      </span>
    </label>
  );
}
