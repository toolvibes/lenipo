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
import type { IssueTypeInfo, PriorityInfo, StatusInfo } from '@tasklore/shared';
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

const CATEGORY_STYLE = {
  todo: 'bg-[var(--status-todo-bg)] text-[var(--status-todo-fg)]',
  in_progress: 'bg-[var(--status-progress-bg)] text-[var(--status-progress-fg)]',
  done: 'bg-[var(--status-done-bg)] text-[var(--status-done-fg)]',
} as const;

/** Status as a quiet badge with its name, never by colour alone (E-67). */
export function StatusLozenge({ status }: { status: StatusInfo }) {
  const name = useMetaName();
  return (
    <span
      className={`inline-flex items-center rounded-[4px] px-1.5 text-[11.5px] leading-[18px] font-medium whitespace-nowrap ${CATEGORY_STYLE[status.category]}`}
    >
      {name('status', status)}
    </span>
  );
}
