import { type SelectHTMLAttributes, useId } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Array<{ value: string; label: string }>;
}

/** Native select styled like TextField; keyboard and screen readers work out of the box. */
export function Select({ label, options, id, className = '', ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={selectId} className="tl-label text-[var(--ink-muted)]">
        {label}
      </label>
      <select
        id={selectId}
        className={`h-[var(--control-md)] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-[var(--ink)] ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
