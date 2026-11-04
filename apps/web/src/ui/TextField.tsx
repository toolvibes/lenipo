import { WarningCircle } from '@phosphor-icons/react';
import { type InputHTMLAttributes, useId } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  help?: string;
  error?: string;
}

/** Design system TextField: label above, help or error below. */
export function TextField({ label, help, error, id, className = '', ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error || help ? `${inputId}-hint` : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={inputId} className="tl-field-label">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-[var(--control-md)] rounded-[var(--radius-md)] border bg-[var(--surface-1)] px-3 text-[var(--ink)] transition-shadow placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_var(--accent-soft)] ${
          error ? 'border-[var(--danger)]' : 'border-[var(--border-strong)]'
        } ${className}`}
        {...props}
      />
      {error ? (
        <span id={describedBy} className="flex items-start gap-1 text-xs text-[var(--danger)]">
          <WarningCircle size={16} className="shrink-0" aria-hidden />
          {error}
        </span>
      ) : help ? (
        <span id={describedBy} className="text-xs text-[var(--ink-muted)]">
          {help}
        </span>
      ) : null}
    </div>
  );
}
