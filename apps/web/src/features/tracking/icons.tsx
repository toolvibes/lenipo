import {
  BookmarkSimple,
  Bug,
  CaretDoubleDown,
  CaretDoubleUp,
  CaretDown,
  CaretUp,
  CheckSquare,
  Equals,
  type Icon,
  Lightning,
  Question,
  TreeStructure,
} from '@phosphor-icons/react';
import type { IssueTypeInfo, PriorityInfo, StatusInfo } from '@toolvibes/shared';
import { useTranslation } from 'react-i18next';

const ICONS: Record<string, Icon> = {
  BookmarkSimple,
  Bug,
  CaretDoubleDown,
  CaretDoubleUp,
  CaretDown,
  CaretUp,
  CheckSquare,
  Equals,
  Lightning,
  TreeStructure,
};

/** Built-in names are translated by key; custom entries keep their stored name. */
export function useMetaName() {
  const { t, i18n } = useTranslation();
  return (
    kind: 'issueType' | 'status' | 'priority' | 'resolution',
    entry: { key: string; name: string },
  ) => {
    const translationKey = `meta.${kind}.${entry.key}`;
    return i18n.exists(translationKey) ? t(translationKey as never) : entry.name;
  };
}

export function IssueTypeIcon({ type, size = 16 }: { type: IssueTypeInfo; size?: number }) {
  const name = useMetaName();
  const IconComponent = ICONS[type.icon] ?? Question;
  return (
    <IconComponent
      size={size}
      role="img"
      aria-label={name('issueType', type)}
      className="shrink-0 text-[var(--ink-muted)]"
    />
  );
}

const PRIORITY_COLOR: Record<string, string> = {
  highest: 'var(--danger)',
  high: 'var(--warning)',
  medium: 'var(--ink-muted)',
  low: 'var(--ink-muted)',
  lowest: 'var(--ink-muted)',
};

export function PriorityIcon({ priority, size = 16 }: { priority: PriorityInfo; size?: number }) {
  const name = useMetaName();
  const IconComponent = ICONS[priority.icon] ?? Equals;
  return (
    <IconComponent
      size={size}
      role="img"
      aria-label={name('priority', priority)}
      className="shrink-0"
      style={{ color: PRIORITY_COLOR[priority.key] ?? 'var(--ink-muted)' }}
    />
  );
}

/** Colours of a status by category, for badges and the status button of the issue page. */
export const STATUS_TONE = {
  todo: 'bg-[var(--status-todo-bg)] text-[var(--status-todo-fg)]',
  in_progress: 'bg-[var(--status-progress-bg)] text-[var(--status-progress-fg)]',
  done: 'bg-[var(--status-done-bg)] text-[var(--status-done-fg)]',
} as const;

/** Built-in statuses with a tone of their own (design: Review, Blockiert), else by category. */
const STATUS_KEY_TONE: Record<string, string> = {
  review: 'bg-[var(--status-review-bg)] text-[var(--status-review-fg)]',
  testing: 'bg-[var(--status-review-bg)] text-[var(--status-review-fg)]',
  blocked: 'bg-[var(--status-blocked-bg)] text-[var(--status-blocked-fg)]',
};

export function statusTone(status: StatusInfo): string {
  return STATUS_KEY_TONE[status.key] ?? STATUS_TONE[status.category];
}

/** Status as a pill with its name, never by colour alone (E-67). */
export function StatusLozenge({ status }: { status: StatusInfo }) {
  const name = useMetaName();
  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-full px-2.5 text-[11.5px] font-semibold whitespace-nowrap ${statusTone(status)}`}
    >
      {name('status', status)}
    </span>
  );
}

const TYPE_TONE: Record<string, string> = {
  story: 'bg-[var(--type-story-bg)] text-[var(--type-story-fg)]',
  bug: 'bg-[var(--type-bug-bg)] text-[var(--type-bug-fg)]',
  task: 'bg-[var(--type-task-bg)] text-[var(--type-task-fg)]',
  subtask: 'bg-[var(--type-task-bg)] text-[var(--type-task-fg)]',
  spike: 'bg-[var(--type-spike-bg)] text-[var(--type-spike-fg)]',
  epic: 'bg-[var(--type-spike-bg)] text-[var(--type-spike-fg)]',
};

/** Issue type as a coloured pill with its name (design: board cards, lists). */
export function IssueTypePill({ type }: { type: IssueTypeInfo }) {
  const name = useMetaName();
  return (
    <span
      className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold whitespace-nowrap ${TYPE_TONE[type.key] ?? STATUS_TONE.todo}`}
    >
      {name('issueType', type)}
    </span>
  );
}
