import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[var(--accent)] px-3.5 text-[var(--on-accent)] shadow-[var(--shadow-accent)] hover:bg-[var(--accent-hover)]',
  secondary:
    'bg-[var(--surface-1)] px-3.5 text-[var(--ink)] shadow-[var(--shadow-control)] hover:bg-[var(--surface-2)]',
  ghost: 'px-3 text-[var(--ink-soft)] hover:bg-[var(--selected)] hover:text-[var(--ink)]',
  danger:
    'bg-[var(--surface-1)] px-3.5 text-[var(--danger)] shadow-[inset_0_0_0_1px_var(--danger)] hover:bg-[var(--danger-soft)]',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'sm';
}

/** Classes of a Button, for links that look like one. */
export function buttonClass(variant: Variant = 'secondary', size: 'md' | 'sm' = 'md') {
  const height = size === 'md' ? 'h-[var(--control-md)]' : 'h-[var(--control-sm)] !px-2.5';
  return `inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] text-[13px] font-semibold whitespace-nowrap no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${height} ${VARIANTS[variant]}`;
}

/** Design system Button (E-67): one primary action per view, verb first. */
export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}
