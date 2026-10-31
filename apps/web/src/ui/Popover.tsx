import * as RadixPopover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';

const TRIGGER =
  'flex h-[var(--control-sm)] max-w-64 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2.5 hover:bg-[var(--surface-2)] data-[active=true]:border-[var(--accent)] data-[active=true]:bg-[var(--accent-soft)] data-[active=true]:text-[var(--accent)]';

/**
 * A button that opens a floating panel below it, rendered in a portal so table cells and
 * scroll containers do not clip it; Escape and a click outside close it.
 */
export function Popover({
  trigger,
  label,
  active = false,
  align = 'start',
  disabled = false,
  triggerClassName = TRIGGER,
  triggerLabel,
  children,
}: {
  trigger: ReactNode;
  /** Accessible name of the panel. */
  label: string;
  /** Highlights the button, e.g. while a filter is set. */
  active?: boolean;
  align?: 'start' | 'end';
  disabled?: boolean;
  triggerClassName?: string;
  /** Accessible name of the button when its content does not say it. */
  triggerLabel?: string;
  children: ReactNode;
}) {
  return (
    <RadixPopover.Root>
      <RadixPopover.Trigger
        type="button"
        disabled={disabled}
        data-active={active}
        className={triggerClassName}
      >
        {/* A hidden prefix keeps the visible text part of the name (WCAG 2.5.3, TL-43). */}
        {triggerLabel && <span className="sr-only">{triggerLabel}: </span>}
        {trigger}
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          aria-label={label}
          align={align}
          sideOffset={4}
          collisionPadding={8}
          className="z-50 flex max-h-[min(20rem,var(--radix-popover-content-available-height))] w-64 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] shadow-[var(--shadow-float)]"
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
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
