import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { PresenceState } from '@toolvibes/shared';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDateTime, formatRelative } from '../../lib/format';
import { projectQuery } from '../../lib/tracking';
import { FormError } from '../../ui/FormError';
import { TopBar } from '../../ui/TopBar';
import { Avatar } from './UserPicker';

const STATE_TONES: Record<PresenceState, string> = {
  active: 'var(--success)',
  waiting: 'var(--warning)',
  blocked: 'var(--danger)',
  offline: 'var(--ink-muted)',
};

/**
 * Who works in the project (TL-93, E-145): people and agents with their state from heartbeats or
 * recent use, the issue and branch they are on, and their last activity.
 */
export function ProjectTeamPage({ projectKey }: { projectKey: string }) {
  const { t } = useTranslation();
  const project = useQuery(projectQuery(projectKey));
  const team = useQuery({
    queryKey: ['project', projectKey, 'team'],
    queryFn: () =>
      unwrap(client.GET('/api/v1/projects/{key}/team', { params: { path: { key: projectKey } } })),
    // Heartbeats come every few minutes; no realtime signal for them.
    refetchInterval: 60_000,
  });
  const claims = useQuery({
    queryKey: ['project', projectKey, 'claims'],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/projects/{key}/claims', { params: { path: { key: projectKey } } }),
      ),
    refetchInterval: 60_000,
  });
  return (
    <>
      <TopBar crumbs={[project.data?.name ?? projectKey, t('team.title')]} />
      <main className="flex max-w-[960px] flex-col gap-5 px-6 py-6 lg:px-10">
        <header className="flex flex-col gap-1">
          <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.015em]">
            {t('team.title')}
          </h1>
          <p className="m-0 max-w-[680px] text-[var(--ink-muted)]">{t('team.intro')}</p>
        </header>
        {team.error && <FormError message={team.error.message} />}
        {team.data && team.data.length === 0 && (
          <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('team.empty')}</p>
        )}
        {team.data && team.data.length > 0 && (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[var(--ink-muted)]">
                <th className="tl-label py-1.5 pr-3 font-semibold">{t('team.who')}</th>
                <th className="tl-label py-1.5 pr-3 font-semibold">{t('team.state')}</th>
                <th className="tl-label py-1.5 pr-3 font-semibold">{t('team.workingOn')}</th>
                <th className="tl-label py-1.5 pr-3 font-semibold">{t('team.open')}</th>
                <th className="tl-label py-1.5 font-semibold">{t('team.lastActivity')}</th>
              </tr>
            </thead>
            <tbody>
              {team.data.map((member) => (
                <tr key={member.user.id} className="border-t border-[var(--border)] align-top">
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <Avatar user={member.user} />
                      <span className="font-semibold">{member.user.displayName}</span>
                      {member.agent && (
                        <span className="text-xs text-[var(--ink-muted)]">{t('agents.badge')}</span>
                      )}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ backgroundColor: STATE_TONES[member.state] }}
                      />
                      {t(`team.states.${member.state}`)}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {member.issue && (
                      <Link
                        to="/issues/$key"
                        params={{ key: member.issue.key }}
                        className="text-[var(--accent)]"
                      >
                        {member.issue.key}
                      </Link>
                    )}
                    {member.issue && <span> {member.issue.summary}</span>}
                    {member.branch && (
                      <span className="block text-xs text-[var(--ink-muted)]">
                        <code>{member.branch}</code>
                      </span>
                    )}
                    {member.note && (
                      <span className="block text-xs text-[var(--ink-muted)]">{member.note}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{member.openIssues}</td>
                  <td className="py-2 text-[var(--ink-muted)]">
                    {member.lastActivityAt ? formatRelative(member.lastActivityAt) : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {claims.data && claims.data.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="m-0 text-base font-semibold">{t('claims.title')}</h2>
            <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('claims.intro')}</p>
            <ul className="m-0 flex list-none flex-col p-0 text-[13px]">
              {claims.data.map((claim) => (
                <li key={claim.issue.key} className="border-t border-[var(--border)] py-2">
                  <Link
                    to="/issues/$key"
                    params={{ key: claim.issue.key }}
                    className="text-[var(--accent)]"
                  >
                    {claim.issue.key}
                  </Link>{' '}
                  {claim.issue.summary} ·{' '}
                  {t('claims.until', {
                    name: claim.user.displayName,
                    time: formatDateTime(claim.expiresAt),
                  })}
                  {claim.forced && (
                    <span className="text-[var(--warning)]"> · {t('claims.forced')}</span>
                  )}
                  {(claim.branch || claim.paths.length > 0) && (
                    <span className="block text-xs text-[var(--ink-muted)]">
                      {[claim.branch, claim.paths.join(', ')].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
