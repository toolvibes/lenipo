import { type SelectHTMLAttributes, useId } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Array<{ value: string; label: string }>;
  /** A line below, as with TextField. */
  help?: string;
}

/** Native select styled like TextField; keyboard and screen readers work out of the box. */
export function Select({ label, options, help, id, className = '', ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const helpId = help ? `${selectId}-hint` : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={selectId} className="tl-field-label">
        {label}
      </label>
      <select
        id={selectId}
        aria-describedby={helpId}
        className={`h-[var(--control-md)] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2.5 text-[var(--ink)] transition-shadow focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_var(--accent-soft)] ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {help && (
        <span id={helpId} className="text-xs text-[var(--ink-muted)]">
          {help}
        </span>
      )}
    </div>
  );
}
