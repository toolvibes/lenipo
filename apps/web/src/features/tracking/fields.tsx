import { CaretDown } from '@phosphor-icons/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useQuery } from '@tanstack/react-query';
import type { IssueSummary } from '@toolvibes/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { transitionsQuery } from '../../lib/tracking';
import { STATUS_TONE, StatusLozenge, useMetaName } from './icons';

/** Editable fields shared by the issue page and the cells of result lists (T-ISS-14). */

export const inputClass =
  'h-[var(--control-sm)] w-full rounded-[var(--radius-md)] border border-transparent bg-transparent px-1.5 text-[var(--ink)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] disabled:hover:border-transparent';

/** Text-like field that saves on blur or Enter when the value changed. */
export function InlineInput({
  value,
  onSave,
  disabled,
  ...props
}: { value: string; onSave: (value: string) => void; disabled: boolean } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
>) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onSave(draft);
  };
  return (
    <input
      {...props}
      value={draft}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        if (event.key === 'Escape') setDraft(value);
      }}
      className={`${inputClass} ${props.className ?? ''}`}
    />
  );
}

/**
 * The status as a menu of the workflow's transitions, loaded when it opens. `block` shows it
 * as the full-width status button of the issue page (1a).
 */
export function StatusMenu({
  issue,
  enabled,
  onTransition,
  block = false,
}: {
  issue: Pick<IssueSummary, 'key' | 'status'>;
  enabled: boolean;
  onTransition: (id: string) => void;
  block?: boolean;
}) {
  const { t } = useTranslation();
  const metaName = useMetaName();
  const [open, setOpen] = useState(false);
  // Loaded on hover or focus already, so a menu opened by keyboard can focus its first item.
  const [wanted, setWanted] = useState(false);
  const transitions = useQuery({ ...transitionsQuery(issue.key), enabled: open || wanted });

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger
        disabled={!enabled}
        onPointerEnter={() => setWanted(true)}
        onFocus={() => setWanted(true)}
        aria-label={`${t('issues.changeStatus')}: ${metaName('status', issue.status)}`}
        className={
          block
            ? `flex h-[34px] w-full items-center gap-1 rounded-[var(--radius-md)] border-0 px-3 text-left text-[13.5px] font-semibold disabled:cursor-default ${STATUS_TONE[issue.status.category]}`
            : 'flex items-center gap-1 rounded-[var(--radius-sm)] disabled:cursor-default'
        }
      >
        {block ? (
          <span className="flex-1 truncate">{metaName('status', issue.status)}</span>
        ) : (
          <StatusLozenge status={issue.status} />
        )}
        {enabled && (
          <CaretDown
            size={14}
            aria-hidden
            className={block ? undefined : 'text-[var(--ink-muted)]'}
          />
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-50 min-w-48 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-1 shadow-[var(--shadow-float)]"
        >
          {transitions.data?.map((transition) => (
            <DropdownMenu.Item
              key={transition.id}
              aria-label={metaName('status', transition.to)}
              onSelect={() => onTransition(transition.id)}
              className="flex cursor-pointer items-center rounded-[var(--radius-md)] px-2 py-1.5 outline-none data-[highlighted]:bg-[var(--surface-2)]"
            >
              <StatusLozenge status={transition.to} />
            </DropdownMenu.Item>
          ))}
          {transitions.data?.length === 0 && (
            <div className="px-2 py-1.5 text-[var(--ink-muted)]">
              {metaName('status', issue.status)}
            </div>
          )}
          {!transitions.data && (
            <div className="px-2 py-1.5 text-[var(--ink-muted)]">{t('common.loading')}</div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
