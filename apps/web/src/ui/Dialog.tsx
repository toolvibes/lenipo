import { X } from '@phosphor-icons/react';
import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  width?: number;
}

/** Modal dialog on radius-lg with the float shadow (design system: Dialog). */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  width = 560,
}: DialogProps) {
  const { t } = useTranslation();
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-[rgb(0_0_0/0.35)]" />
        <RadixDialog.Content
          className="fixed top-[10vh] left-1/2 flex max-h-[80vh] -translate-x-1/2 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] shadow-[var(--shadow-float)]"
          style={{ width: `min(${width}px, calc(100vw - 32px))` }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
            <div className="flex flex-col gap-1">
              <RadixDialog.Title className="tl-heading-md">{title}</RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="text-[var(--ink-muted)]">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              aria-label={t('common.close')}
              className="grid size-8 place-items-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
            >
              <X size={18} aria-hidden />
            </RadixDialog.Close>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
