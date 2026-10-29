import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

/**
 * A button that opens a floating panel below it; a click outside or Escape closes it and
 * Escape returns focus to the button.
 */
export function Popover({
  trigger,
  label,
  active = false,
  align = 'left',
  children,
}: {
  trigger: ReactNode;
  /** Accessible name of the panel. */
  label: string;
  /** Highlights the button, e.g. while a filter is set. */
  active?: boolean;
  align?: 'left' | 'right';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        data-active={active}
        className="flex h-[var(--control-sm)] max-w-64 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2.5 hover:bg-[var(--surface-2)] data-[active=true]:border-[var(--accent)] data-[active=true]:bg-[var(--accent-soft)] data-[active=true]:text-[var(--accent)]"
      >
        {trigger}
      </button>
      {open && (
        <fieldset
          id={panelId}
          className={`absolute top-full z-20 m-0 mt-1 flex max-h-80 w-64 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] shadow-[var(--shadow-float)] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <legend className="sr-only">{label}</legend>
          {children}
        </fieldset>
      )}
    </div>
  );
}

/** One checkbox row inside a popover. */
export function CheckRow({
  checked,
  onChange,
  disabled,
  children,
  detail,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  children: ReactNode;
  detail?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 hover:bg-[var(--surface-2)] has-[:disabled]:cursor-default has-[:disabled]:opacity-55">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {detail && <span className="truncate text-xs text-[var(--ink-muted)]">{detail}</span>}
    </label>
  );
}
