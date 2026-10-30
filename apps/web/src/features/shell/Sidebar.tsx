import { SignOut } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link, useRouterState } from '@tanstack/react-router';
import type { Favourite, Me } from '@tasklore/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { boardsQuery } from '../../lib/boards';
import { favouritesQuery } from '../../lib/personal';
import { initials, presenceColor } from '../../lib/presence';
import { useCurrentProjectKey } from '../../lib/shortcuts';
import { projectsQuery } from '../../lib/tracking';
import { projectSpacesQuery } from '../../lib/wiki';
import { NotificationBell } from '../notifications/NotificationBell';

/** Assigned to me and not done: "Meine Aufgaben" (S2, E-67). */
export const MY_ISSUES =
  'assignee = currentUser() AND resolution is EMPTY ORDER BY priority, updated DESC';

const ROW =
  'flex h-[30px] items-center gap-2 rounded-[5px] px-2.5 text-[13.5px] font-medium text-[var(--ink-muted)] no-underline hover:bg-[var(--selected)] hover:text-[var(--ink)]';
const ACTIVE = 'bg-[var(--selected)] font-semibold text-[var(--ink)]';

function NavRow({
  to,
  search,
  params,
  active,
  children,
  small = false,
}: {
  to: string;
  search?: Record<string, string>;
  params?: Record<string, string>;
  active: boolean;
  children: ReactNode;
  small?: boolean;
}) {
  return (
    <Link
      to={to}
      search={search}
      params={params}
      aria-current={active ? 'page' : undefined}
      className={`${ROW} ${small ? 'h-7 text-[13px]' : ''} ${active ? ACTIVE : ''}`}
    >
      {children}
    </Link>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="tl-label px-2.5 pb-1.5 text-[var(--ink-muted)]">{children}</div>;
}

/** The sub-pages of the project being worked on: its issues, backlog, board and Lore. */
function ProjectPages({ projectKey, path }: { projectKey: string; path: string }) {
  const { t } = useTranslation();
  const boards = useQuery(boardsQuery(projectKey));
  const spaces = useQuery(projectSpacesQuery(projectKey));
  const board = boards.data?.[0];
  const scrum = boards.data?.find((entry) => entry.type === 'scrum');
  const lore = spaces.data?.[0];
  return (
    <div className="flex flex-col gap-px pl-[17px]">
      <NavRow
        small
        to="/projects/$key"
        params={{ key: projectKey }}
        active={path === `/projects/${projectKey}`}
      >
        {t('sidebar.issues')}
      </NavRow>
      {scrum && (
        <NavRow
          small
          to="/boards/$id/backlog"
          params={{ id: scrum.id }}
          active={path === `/boards/${scrum.id}/backlog`}
        >
          {t('sidebar.backlog')}
        </NavRow>
      )}
      {board && (
        <NavRow
          small
          to="/boards/$id"
          params={{ id: board.id }}
          active={path.startsWith('/boards/') && !path.endsWith('/backlog')}
        >
          {t('sidebar.board')}
        </NavRow>
      )}
      {lore && (
        <NavRow
          small
          to="/spaces/$key"
          params={{ key: lore.key }}
          active={path.startsWith(`/spaces/${lore.key}`)}
        >
          {t('sidebar.lore')}
        </NavRow>
      )}
    </div>
  );
}

/** Starred filters, spaces and pages; starred projects are listed with the projects. */
function OtherFavourites({ path }: { path: string }) {
  const { t } = useTranslation();
  const favourites = useQuery(favouritesQuery);
  const list = (favourites.data ?? []).filter((favourite) => favourite.kind !== 'project');
  if (list.length === 0) return null;
  const row = (favourite: Favourite) => {
    if (favourite.kind === 'filter') {
      return (
        <NavRow to="/issues" search={{ filter: favourite.ref }} active={false}>
          <span className="truncate">{favourite.name}</span>
        </NavRow>
      );
    }
    if (favourite.kind === 'space') {
      return (
        <NavRow
          to="/spaces/$key"
          params={{ key: favourite.ref }}
          active={path === `/spaces/${favourite.ref}`}
        >
          <span className="truncate">{favourite.name}</span>
        </NavRow>
      );
    }
    return (
      <NavRow
        to="/spaces/$key/pages/$id"
        params={{ key: favourite.spaceKey ?? '', id: favourite.ref }}
        active={path.endsWith(`/pages/${favourite.ref}`)}
      >
        <span className="truncate">{favourite.name}</span>
      </NavRow>
    );
  };
  return (
    <div className="flex flex-col gap-px">
      <SectionLabel>{t('favourites.title')}</SectionLabel>
      {list.map((favourite) => (
        <div key={`${favourite.kind}:${favourite.id}`}>{row(favourite)}</div>
      ))}
    </div>
  );
}

/**
 * The fixed sidebar of direction 1a (E-67): personal entries, the projects with the current
 * one opened up, then everything else and the signed-in person.
 */
export function Sidebar({
  me,
  onSearch,
  onSignOut,
}: {
  me: Me;
  onSearch: () => void;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.search }) as {
    q?: string;
  };
  const projects = useQuery(projectsQuery);
  const current = useCurrentProjectKey();
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const listed = [...(projects.data ?? [])]
    .sort((a, b) => Number(b.favourite) - Number(a.favourite) || a.name.localeCompare(b.name))
    .slice(0, 8);
  const isAdmin = me.globalPermissions.includes('admin');

  return (
    <nav
      aria-label={t('shell.navigation')}
      className="flex max-w-full flex-[1_1_var(--sidebar-width)] flex-col gap-[18px] border-r border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-3.5 md:sticky md:top-0 md:h-screen md:max-w-[var(--sidebar-width)] md:overflow-y-auto"
    >
      <Link to="/" className="flex items-center gap-2 px-2 py-0.5 text-[var(--ink)] no-underline">
        <span
          aria-hidden
          className="grid size-[22px] place-items-center rounded-[5px] bg-[var(--ink)] text-[12px] font-bold text-[var(--surface-1)]"
        >
          T
        </span>
        <span className="text-[15px] font-bold tracking-[-0.01em]">{t('common.product')}</span>
      </Link>

      <button
        type="button"
        onClick={onSearch}
        className="flex h-8 items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface-1)] px-2.5 text-left text-[13px] text-[var(--ink-muted)] hover:border-[var(--border-strong)]"
      >
        <span className="flex-1">{t('sidebar.search')}</span>
        <kbd className="font-[family-name:var(--font-mono)] text-[11px] font-medium">
          {isMac ? '⌘K' : t('shell.paletteShortcut')}
        </kbd>
      </button>

      <div className="flex flex-col gap-px">
        <NavRow to="/" active={path === '/'}>
          {t('sidebar.overview')}
        </NavRow>
        <NavRow
          to="/issues"
          search={{ q: MY_ISSUES }}
          active={path === '/issues' && search.q === MY_ISSUES}
        >
          {t('sidebar.myIssues')}
        </NavRow>
        <NotificationBell active={path === '/notifications'} />
      </div>

      <div className="flex flex-col gap-px">
        <SectionLabel>{t('shell.projects')}</SectionLabel>
        {listed.map((project) => {
          const open = project.key === current;
          return (
            <div key={project.id} className="flex flex-col gap-px">
              <Link
                to="/projects/$key"
                params={{ key: project.key }}
                className={`${ROW} ${open ? 'font-semibold text-[var(--ink)]' : ''}`}
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: presenceColor(project.key) }}
                />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                <span className="font-[family-name:var(--font-mono)] text-[11px] font-medium text-[var(--ink-muted)]">
                  {project.key}
                </span>
              </Link>
              {open && <ProjectPages projectKey={project.key} path={path} />}
            </div>
          );
        })}
        {projects.data?.length === 0 && (
          <p className="m-0 px-2.5 text-[13px] text-[var(--ink-muted)]">
            {t('sidebar.noProjects')}
          </p>
        )}
      </div>

      <OtherFavourites path={path} />

      <div className="mt-auto flex flex-col gap-px">
        <NavRow to="/projects" active={path === '/projects'}>
          {t('sidebar.allProjects')}
        </NavRow>
        <NavRow to="/spaces" active={path === '/spaces'}>
          {t('sidebar.allSpaces')}
        </NavRow>
        <NavRow to="/boards" active={path === '/boards'}>
          {t('sidebar.allBoards')}
        </NavRow>
        <NavRow to="/activity" active={path === '/activity'}>
          {t('activity.title')}
        </NavRow>
        {isAdmin && (
          <NavRow to="/admin/webhooks" active={path.startsWith('/admin')}>
            {t('sidebar.settings')}
          </NavRow>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border)] px-2 pt-2">
        <span
          className="grid size-[26px] shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
          style={{ backgroundColor: presenceColor(me.id) }}
          aria-hidden
        >
          {initials(me.displayName)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[13px] font-semibold">{me.displayName}</span>
          <span className="truncate text-[11.5px] text-[var(--ink-muted)]">{me.email}</span>
        </span>
        <button
          type="button"
          onClick={onSignOut}
          aria-label={t('common.signOut')}
          title={t('common.signOut')}
          className="grid size-7 place-items-center rounded-[5px] text-[var(--ink-muted)] hover:bg-[var(--selected)] hover:text-[var(--ink)]"
        >
          <SignOut size={16} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
