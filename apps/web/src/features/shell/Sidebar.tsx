import {
  BookOpen,
  CalendarBlank,
  ChartBarHorizontal,
  ChartLine,
  CheckCircle,
  Folder,
  Gauge,
  Headset,
  type Icon,
  Kanban,
  Lifebuoy,
  ListBullets,
  ListChecks,
  MapTrifold,
  Plus,
  Pulse,
  Question,
  Robot,
  RocketLaunch,
  SignOut,
  SlidersHorizontal,
  SquaresFour,
  Timer,
  UsersThree,
} from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link, useRouterState } from '@tanstack/react-router';
import type { Favourite, Me } from '@toolvibes/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { boardsQuery } from '../../lib/boards';
import { noticeQuery, useModules } from '../../lib/instance';
import { favouritesQuery } from '../../lib/personal';
import { initials, presenceColor } from '../../lib/presence';
import { useCurrentProjectKey } from '../../lib/shortcuts';
import { projectsQuery } from '../../lib/tracking';
import { projectSpacesQuery, spacesQuery } from '../../lib/wiki';
import { LogoMark } from '../../ui/Logo';
import { NotificationBell } from '../notifications/NotificationBell';
import { TimerBar } from '../time/TimerBar';
import { LegalLinks } from './LegalLinks';

/** Assigned to me and not done: "Meine Aufgaben" (S2, E-67). */
export const MY_ISSUES =
  'assignee = currentUser() AND resolution is EMPTY ORDER BY priority, updated DESC';

const ROW =
  'flex h-9 items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[13.5px] font-medium text-[var(--ink-soft)] no-underline transition-colors hover:bg-[var(--surface-1)] hover:text-[var(--ink)]';
const ACTIVE =
  'bg-[var(--surface-1)] font-bold text-[var(--accent-hover)] shadow-[var(--shadow-raised)] hover:bg-[var(--surface-1)] hover:text-[var(--accent-hover)]';

function NavRow({
  to,
  search,
  params,
  active,
  children,
  small = false,
  icon: RowIcon,
}: {
  to: string;
  search?: Record<string, string>;
  params?: Record<string, string>;
  active: boolean;
  children: ReactNode;
  small?: boolean;
  icon?: Icon;
}) {
  return (
    <Link
      to={to}
      search={search}
      params={params}
      aria-current={active ? 'page' : undefined}
      className={`${ROW} ${small ? 'h-[34px] text-[13px]' : ''} ${active ? ACTIVE : ''}`}
    >
      {RowIcon && <RowIcon size={small ? 16 : 18} className="shrink-0" aria-hidden />}
      {children}
    </Link>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="tl-label px-2.5 pb-1.5 tracking-[0.06em] text-[var(--ink-muted)]">
      {children}
    </div>
  );
}

/** The sub-pages of the project being worked on: its issues, backlog, board and Wiki. */
function ProjectPages({ projectKey, path }: { projectKey: string; path: string }) {
  const { t } = useTranslation();
  const modules = useModules();
  const boards = useQuery({ ...boardsQuery(projectKey), enabled: modules.boards });
  const spaces = useQuery({ ...projectSpacesQuery(projectKey), enabled: modules.wiki });
  const board = modules.boards ? boards.data?.[0] : undefined;
  const scrum = modules.boards ? boards.data?.find((entry) => entry.type === 'scrum') : undefined;
  const lore = modules.wiki ? spaces.data?.[0] : undefined;
  return (
    <div className="flex flex-col gap-0.5 pl-3">
      <NavRow
        icon={ListChecks}
        small
        to="/projects/$key"
        params={{ key: projectKey }}
        active={path === `/projects/${projectKey}`}
      >
        {t('sidebar.issues')}
      </NavRow>
      {modules.boards && boards.isSuccess && boards.data.length === 0 && (
        <NavRow small icon={Plus} to="/boards" search={{ create: projectKey }} active={false}>
          {t('sidebar.createBoard')}
        </NavRow>
      )}
      {scrum && (
        <NavRow
          icon={ListBullets}
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
          icon={Kanban}
          small
          to="/boards/$id"
          params={{ id: board.id }}
          active={path.startsWith('/boards/') && !path.endsWith('/backlog')}
        >
          {t('sidebar.board')}
        </NavRow>
      )}
      <NavRow
        icon={ChartBarHorizontal}
        small
        to="/projects/$key/timeline"
        params={{ key: projectKey }}
        active={path === `/projects/${projectKey}/timeline`}
      >
        {t('sidebar.timeline')}
      </NavRow>
      <NavRow
        icon={ChartLine}
        small
        to="/projects/$key/reports"
        params={{ key: projectKey }}
        search={{}}
        active={path === `/projects/${projectKey}/reports`}
      >
        {t('analysis.title')}
      </NavRow>
      <NavRow
        icon={UsersThree}
        small
        to="/projects/$key/team"
        params={{ key: projectKey }}
        active={path === `/projects/${projectKey}/team`}
      >
        {t('team.title')}
      </NavRow>
      <NavRow
        icon={CalendarBlank}
        small
        to="/calendar"
        search={{ q: `project = ${projectKey}` }}
        active={path === '/calendar'}
      >
        {t('calendar.title')}
      </NavRow>
      <NavRow
        icon={RocketLaunch}
        small
        to="/projects/$key/releases"
        params={{ key: projectKey }}
        active={path.startsWith(`/projects/${projectKey}/releases`)}
      >
        {t('releases.title')}
      </NavRow>
      {lore && (
        <NavRow
          icon={BookOpen}
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

/** Starred filters, boards, spaces and pages; starred projects are listed with the projects. */
function OtherFavourites({ path }: { path: string }) {
  const { t } = useTranslation();
  const favourites = useQuery(favouritesQuery);
  // Starred spaces are listed in the wiki section (TL-83).
  const list = (favourites.data ?? []).filter(
    (favourite) => favourite.kind !== 'project' && favourite.kind !== 'space',
  );
  if (list.length === 0) return null;
  const row = (favourite: Favourite) => {
    if (favourite.kind === 'filter') {
      return (
        <NavRow to="/issues" search={{ filter: favourite.ref }} active={false}>
          <span className="truncate">{favourite.name}</span>
        </NavRow>
      );
    }
    if (favourite.kind === 'dashboard') {
      return (
        <NavRow
          to="/dashboards/$id"
          params={{ id: favourite.ref }}
          active={path === `/dashboards/${favourite.ref}`}
        >
          <span className="truncate">{favourite.name}</span>
        </NavRow>
      );
    }
    if (favourite.kind === 'board') {
      return (
        <NavRow
          to="/boards/$id"
          params={{ id: favourite.ref }}
          search={{}}
          active={path.startsWith(`/boards/${favourite.ref}`)}
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
    <div className="flex flex-col gap-0.5">
      <SectionLabel>{t('favourites.title')}</SectionLabel>
      {list.map((favourite) => (
        <div key={`${favourite.kind}:${favourite.id}`}>{row(favourite)}</div>
      ))}
    </div>
  );
}

/** How many spaces the wiki section lists before "all spaces" takes over. */
const WIKI_SPACES = 8;

/**
 * The wiki on its own, apart from projects (TL-83, E-130): its start page, then starred spaces
 * and the general ones that belong to no project.
 */
function WikiSection({ path }: { path: string }) {
  const { t } = useTranslation();
  const spaces = useQuery(spacesQuery);
  const listed = (spaces.data ?? [])
    .filter((space) => space.type !== 'personal' && (space.favourite || !space.project))
    .sort((a, b) => Number(b.favourite) - Number(a.favourite) || a.name.localeCompare(b.name))
    .slice(0, WIKI_SPACES);
  return (
    <div className="flex flex-col gap-0.5">
      <SectionLabel>{t('wikiHome.title')}</SectionLabel>
      <NavRow icon={BookOpen} to="/spaces" active={path === '/spaces'}>
        {t('wikiHome.start')}
      </NavRow>
      {listed.map((space) => (
        <NavRow
          key={space.id}
          to="/spaces/$key"
          params={{ key: space.key }}
          active={path === `/spaces/${space.key}` || path.startsWith(`/spaces/${space.key}/`)}
        >
          <span className="min-w-0 flex-1 truncate">{space.name}</span>
          <span className="font-[family-name:var(--font-mono)] text-[11px] font-medium text-[var(--ink-muted)]">
            {space.key}
          </span>
        </NavRow>
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
  const modules = useModules();
  const notice = useQuery(noticeQuery).data;
  const helpUrl = notice?.helpUrl ?? null;
  const supportUrl = notice?.supportUrl ?? null;

  return (
    <nav
      aria-label={t('shell.navigation')}
      className="flex max-w-full flex-[1_1_var(--sidebar-width)] flex-col gap-5 bg-[var(--surface-2)] px-3 pt-[18px] pb-3.5 md:sticky md:top-0 md:h-screen md:max-w-[var(--sidebar-width)] md:overflow-y-auto"
    >
      <Link to="/" className="flex items-center gap-2.5 px-2 py-0.5 text-[var(--ink)] no-underline">
        <LogoMark size={26} />
        <span className="text-[17px] font-extrabold tracking-[-0.02em]">{t('common.product')}</span>
      </Link>

      <button
        type="button"
        onClick={onSearch}
        className="flex h-9 items-center gap-2 rounded-[11px] bg-[var(--surface-1)] pr-2.5 pl-3 text-left text-[13px] text-[var(--ink-muted)] shadow-[var(--shadow-control)] transition-shadow hover:shadow-[var(--shadow-raised)]"
      >
        <span className="flex-1">{t('sidebar.search')}</span>
        <kbd className="rounded-[6px] bg-[var(--surface-2)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] font-medium">
          {isMac ? '⌘K' : t('shell.paletteShortcut')}
        </kbd>
      </button>

      <div className="flex flex-col gap-0.5">
        <NavRow icon={SquaresFour} to="/" active={path === '/'}>
          {t('sidebar.overview')}
        </NavRow>
        <NavRow
          icon={CheckCircle}
          to="/issues"
          search={{ q: MY_ISSUES }}
          active={path === '/issues' && search.q === MY_ISSUES}
        >
          {t('sidebar.myIssues')}
        </NavRow>
        <NotificationBell active={path === '/notifications'} />
      </div>

      <div className="flex flex-col gap-0.5">
        <SectionLabel>{t('shell.projects')}</SectionLabel>
        {listed.map((project) => {
          const open = project.key === current;
          return (
            <div key={project.id} className="flex flex-col gap-px">
              <Link
                to="/projects/$key"
                params={{ key: project.key }}
                className={`${ROW} ${open ? 'font-bold text-[var(--ink)]' : ''}`}
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[4px]"
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

      {modules.wiki && <WikiSection path={path} />}

      <OtherFavourites path={path} />

      {modules['time-tracking'] && <TimerBar />}

      <div className="mt-auto flex flex-col gap-px">
        <NavRow icon={Folder} to="/projects" active={path === '/projects'}>
          {t('sidebar.allProjects')}
        </NavRow>
        {modules.boards && (
          <NavRow icon={Kanban} to="/boards" active={path === '/boards'}>
            {t('sidebar.allBoards')}
          </NavRow>
        )}
        <NavRow icon={MapTrifold} to="/plans" active={path.startsWith('/plans')}>
          {t('plans.title')}
        </NavRow>
        {me.globalPermissions.includes('browse-users') && (
          <NavRow icon={Robot} to="/agents" active={path.startsWith('/agents')}>
            {t('guard.title')}
          </NavRow>
        )}
        <NavRow icon={Headset} to="/portal" active={path.startsWith('/portal')}>
          {t('portal.title')}
        </NavRow>
        {modules.dashboards && (
          <NavRow icon={Gauge} to="/dashboards" active={path === '/dashboards'}>
            {t('dashboards.title')}
          </NavRow>
        )}
        <NavRow icon={Pulse} to="/activity" active={path === '/activity'}>
          {t('activity.title')}
        </NavRow>
        {modules['time-tracking'] && (
          <NavRow icon={Timer} to="/timesheet" search={{}} active={path === '/timesheet'}>
            {t('timesheet.title')}
          </NavRow>
        )}
        {helpUrl ? (
          <a href={helpUrl} target="_blank" rel="noreferrer" className={ROW}>
            <Question size={18} className="shrink-0" aria-hidden />
            {t('sidebar.help')}
          </a>
        ) : (
          <NavRow icon={Question} to="/help" active={path === '/help'}>
            {t('sidebar.help')}
          </NavRow>
        )}
        {supportUrl && (
          <a href={supportUrl} target="_blank" rel="noreferrer" className={ROW}>
            <Lifebuoy size={18} className="shrink-0" aria-hidden />
            {t('sidebar.support')}
          </a>
        )}
        {isAdmin && (
          <NavRow icon={SlidersHorizontal} to="/admin/webhooks" active={path.startsWith('/admin')}>
            {t('sidebar.settings')}
          </NavRow>
        )}
        <LegalLinks className="px-2.5 pt-1.5" />
      </div>

      <div className="flex items-center gap-2.5 rounded-[13px] bg-[var(--surface-1)] p-2.5 shadow-[var(--shadow-card)]">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full text-[11.5px] font-bold text-white"
          style={{ backgroundColor: presenceColor(me.id) }}
          aria-hidden
        >
          {initials(me.displayName)}
        </span>
        <Link
          to="/profile"
          aria-current={path === '/profile' ? 'page' : undefined}
          title={t('profile.title')}
          className="flex min-w-0 flex-1 flex-col rounded-[6px] px-1 leading-tight text-[var(--ink)] no-underline hover:bg-[var(--selected)]"
        >
          <span className="truncate text-[13px] font-bold">{me.displayName}</span>
          <span className="truncate text-[11.5px] text-[var(--ink-muted)]">{me.email}</span>
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          aria-label={t('common.signOut')}
          title={t('common.signOut')}
          className="grid size-7 place-items-center rounded-[8px] text-[var(--ink-muted)] hover:bg-[var(--selected)] hover:text-[var(--ink)]"
        >
          <SignOut size={16} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
