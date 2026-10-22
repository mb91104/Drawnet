import { useEffect, useState } from "react";

interface TextFieldProps {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  ariaLabel?: string;
}

/**
 * Commits on blur or Enter so that a burst of typing becomes one undo step
 * instead of one per keystroke. Escape restores the stored value.
 */
export function TextField({ value, onCommit, placeholder, mono, ariaLabel }: TextFieldProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <input
      className={`input${mono ? " mono" : ""}`}
      value={draft}
      placeholder={placeholder}
      aria-label={ariaLabel}
      spellCheck={false}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

interface SelectFieldProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}

export function SelectField({ value, options, onChange, ariaLabel }: SelectFieldProps) {
  const known = options.some((option) => option.value === value);
  return (
    <select
      className="select"
      value={known ? value : ""}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    >
      {known ? null : <option value="">—</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
