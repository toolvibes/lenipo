import {
  BookmarkSimple,
  Bug,
  CaretDoubleDown,
  CaretDoubleUp,
  CaretDown,
  CaretUp,
  CheckCircle,
  CheckSquare,
  Circle,
  CircleHalf,
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
  todo: { icon: Circle, className: 'bg-[var(--status-todo-bg)] text-[var(--status-todo-fg)]' },
  in_progress: {
    icon: CircleHalf,
    className: 'bg-[var(--status-progress-bg)] text-[var(--status-progress-fg)]',
  },
  done: { icon: CheckCircle, className: 'bg-[var(--status-done-bg)] text-[var(--status-done-fg)]' },
} as const;

/** Status always shown with category icon and name, never by color alone (design: StatusLozenge). */
export function StatusLozenge({ status }: { status: StatusInfo }) {
  const name = useMetaName();
  const style = CATEGORY_STYLE[status.category];
  const IconComponent = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-0.5 text-xs leading-4 font-semibold tracking-[0.04em] whitespace-nowrap uppercase ${style.className}`}
    >
      <IconComponent size={14} aria-hidden />
      {name('status', status)}
    </span>
  );
}
