import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { Me } from '@toolvibes/shared';
import { useTranslation } from 'react-i18next';
import { activityQuery } from '../../lib/personal';
import { projectsQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { ActivityFeed } from './ActivityFeed';

/** The whole activity stream, optionally for one project or only one's own actions. */
export function ActivityPage({ me, project, user }: { me: Me; project?: string; user?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const projects = useQuery(projectsQuery);
  const activity = useInfiniteQuery(activityQuery({ project, user }));
  const entries = activity.data?.pages.flatMap((page) => page.entries) ?? [];

  const go = (next: { project?: string; user?: string }) =>
    void navigate({ to: '/activity', search: { project: next.project, user: next.user } });

  return (
    <main className="flex max-w-3xl flex-col gap-4 px-6 py-5">
      <h1 className="tl-heading-xl">{t('activity.title')}</h1>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Select
            label={t('activity.project')}
            value={project ?? ''}
            onChange={(event) => go({ project: event.target.value || undefined, user })}
            options={[
              { value: '', label: t('activity.allProjects') },
              ...(projects.data ?? []).map((entry) => ({ value: entry.key, label: entry.name })),
            ]}
          />
        </div>
        <label className="flex h-[var(--control-md)] items-center gap-2">
          <input
            type="checkbox"
            checked={user === me.id}
            onChange={(event) => go({ project, user: event.target.checked ? me.id : undefined })}
          />
          {t('activity.onlyMine')}
        </label>
      </div>
      {activity.error && <FormError message={activity.error.message} />}
      {activity.data && entries.length === 0 && (
        <p className="text-[var(--ink-muted)]">{t('activity.empty')}</p>
      )}
      <ActivityFeed entries={entries} showProject={!project} />
      {activity.hasNextPage && (
        <Button
          className="self-start"
          onClick={() => void activity.fetchNextPage()}
          disabled={activity.isFetchingNextPage}
        >
          {t('activity.more')}
        </Button>
      )}
    </main>
  );
}
