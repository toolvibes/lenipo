import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]',
  secondary:
    'border border-[var(--border-strong)] bg-[var(--surface-1)] text-[var(--ink)] hover:bg-[var(--surface-2)]',
  ghost: 'text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
  danger: 'border border-[var(--danger)] bg-[var(--surface-1)] text-[var(--danger)]',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'sm';
}

/** Design system Button: one primary action per view, verb first. */
export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  const height = size === 'md' ? 'h-[var(--control-md)] px-3' : 'h-[var(--control-sm)] px-2';
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1 rounded-[var(--radius-md)] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${height} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
