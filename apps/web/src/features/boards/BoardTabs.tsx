import { Link } from '@tanstack/react-router';
import type { BoardType } from '@tasklore/shared';
import { useTranslation } from 'react-i18next';

const TAB =
  'h-8 border-b-2 border-transparent px-1 pt-1 text-[13px] text-[var(--ink-muted)] no-underline hover:text-[var(--ink)] aria-[current=page]:border-[var(--ink)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--ink)]';

/** Board and backlog of a Scrum board (E-55); Kanban boards have no backlog view. */
export function BoardTabs({
  id,
  type,
  current,
}: {
  id: string;
  type: BoardType;
  current: 'board' | 'backlog' | 'reports';
}) {
  const { t } = useTranslation();
  if (type !== 'scrum') return null;
  return (
    <nav aria-label={t('boards.views')} className="flex gap-4 border-b border-[var(--border)]">
      <Link
        to="/boards/$id/backlog"
        params={{ id }}
        search={{}}
        activeOptions={{ exact: true }}
        aria-current={current === 'backlog' ? 'page' : undefined}
        className={TAB}
      >
        {t('sprints.backlog')}
      </Link>
      <Link
        to="/boards/$id"
        params={{ id }}
        search={{}}
        activeOptions={{ exact: true }}
        aria-current={current === 'board' ? 'page' : undefined}
        className={TAB}
      >
        {t('sprints.activeSprint')}
      </Link>
      <Link
        to="/boards/$id/reports"
        params={{ id }}
        search={{}}
        activeOptions={{ exact: true }}
        aria-current={current === 'reports' ? 'page' : undefined}
        className={TAB}
      >
        {t('reports.title')}
      </Link>
    </nav>
  );
}
