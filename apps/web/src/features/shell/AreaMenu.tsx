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
  ListBullets,
  ListChecks,
  MapTrifold,
  Plus,
  Pulse,
  Robot,
  RocketLaunch,
  SlidersHorizontal,
  SquaresFour,
  Star,
  Timer,
  UsersThree,
} from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Favourite, Me } from '@toolvibes/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useModules } from '../../lib/instance';
import { MY_ISSUES } from '../../lib/navigation';
import { favouritesQuery } from '../../lib/personal';
import { spacesQuery } from '../../lib/wiki';
import { useProjectTargets } from './projectTargets';
import type { Nav } from './useNav';

const ITEM =
  'flex h-9 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[13.5px] font-medium text-[var(--ink-soft)] no-underline transition-colors hover:bg-[var(--border)] hover:text-[var(--ink)] aria-[current=page]:bg-[var(--surface-1)] aria-[current=page]:font-bold aria-[current=page]:text-[var(--accent-hover)] aria-[current=page]:shadow-[0_1px_3px_rgba(23,22,43,0.1)]';

function Item({
  icon: ItemIcon,
  active,
  children,
  ...link
}: {
  icon: Icon;
  active: boolean;
  children: ReactNode;
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
}) {
  return (
    // Exact matching only: which entry is current is decided by the route model, not by prefixes.
    <Link
      {...link}
      activeOptions={{ exact: true, includeSearch: true }}
      activeProps={{}}
      aria-current={active ? 'page' : undefined}
      className={ITEM}
    >
      <ItemIcon size={18} className="shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </Link>
  );
}

function Group({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      {label && (
        <div className="tl-label px-2.5 pb-1.5 tracking-[0.06em] text-[var(--ink-muted)]">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

/** Starred items of the given kinds (Start: projects, boards, filters, dashboards; Wiki: spaces, pages). */
function Favourites({ kinds, nav }: { kinds: Favourite['kind'][]; nav: Nav }) {
  const { t } = useTranslation();
  const favourites = useQuery(favouritesQuery);
  const list = (favourites.data ?? []).filter((entry) => kinds.includes(entry.kind));
  if (list.length === 0) return null;
  const row = (entry: Favourite) => {
    const key = `${entry.kind}:${entry.ref}`;
    switch (entry.kind) {
      case 'project':
        return (
          <Item
            key={key}
            icon={Star}
            to="/projects/$key"
            params={{ key: entry.ref }}
            active={false}
          >
            {entry.name}
          </Item>
        );
      case 'board':
        return (
          <Item
            key={key}
            icon={Star}
            to="/boards/$id"
            params={{ id: entry.ref }}
            search={{}}
            active={false}
          >
            {entry.name}
          </Item>
        );
      case 'filter':
        return (
          <Item key={key} icon={Star} to="/issues" search={{ filter: entry.ref }} active={false}>
            {entry.name}
          </Item>
        );
      case 'dashboard':
        return (
          <Item
            key={key}
            icon={Star}
            to="/dashboards/$id"
            params={{ id: entry.ref }}
            active={false}
          >
            {entry.name}
          </Item>
        );
      case 'space':
        return (
          <Item
            key={key}
            icon={Star}
            to="/spaces/$key"
            params={{ key: entry.ref }}
            active={nav.item === `space:${entry.ref}`}
          >
            {entry.name}
          </Item>
        );
      default:
        return (
          <Item
            key={key}
            icon={Star}
            to="/spaces/$key/pages/$id"
            params={{ key: entry.spaceKey ?? '', id: entry.ref }}
            active={false}
          >
            {entry.name}
          </Item>
        );
    }
  };
  return <Group label={t('favourites.title')}>{list.map(row)}</Group>;
}

function StartMenu({ nav }: { nav: Nav }) {
  const { t } = useTranslation();
  const modules = useModules();
  return (
    <>
      <Group>
        <Item icon={SquaresFour} to="/" active={nav.item === 'overview'}>
          {t('sidebar.overview')}
        </Item>
        <Item
          icon={CheckCircle}
          to="/issues"
          search={{ q: MY_ISSUES }}
          active={nav.item === 'mine'}
        >
          {t('sidebar.myIssues')}
        </Item>
        <Item icon={Pulse} to="/activity" active={nav.item === 'activity'}>
          {t('activity.title')}
        </Item>
        {modules['time-tracking'] && (
          <Item icon={Timer} to="/timesheet" search={{}} active={nav.item === 'time'}>
            {t('timesheet.title')}
          </Item>
        )}
      </Group>
      <Favourites kinds={['project', 'board', 'filter', 'dashboard']} nav={nav} />
    </>
  );
}

function ProjectMenu({ nav }: { nav: Nav }) {
  const { t } = useTranslation();
  const modules = useModules();
  const key = nav.project?.key ?? null;
  const { board, scrum, lore, loaded } = useProjectTargets(key);
  if (!key) {
    return (
      <p className="m-0 px-2.5 text-[13px] text-[var(--ink-muted)]">{t('sidebar.noProjects')}</p>
    );
  }
  const on = (item: string) => nav.area === 'project' && nav.item === item;
  return (
    <>
      <Group label={t('nav.groups.work')}>
        <Item icon={ListChecks} to="/projects/$key" params={{ key }} active={on('issues')}>
          {t('sidebar.issues')}
        </Item>
        {scrum && (
          <Item
            icon={ListBullets}
            to="/boards/$id/backlog"
            params={{ id: scrum.id }}
            active={on('backlog')}
          >
            {t('sidebar.backlog')}
          </Item>
        )}
        {board && (
          <Item
            icon={Kanban}
            to="/boards/$id"
            params={{ id: board.id }}
            search={{}}
            active={on('board')}
          >
            {t('sidebar.board')}
          </Item>
        )}
        {modules.boards && loaded && !board && (
          <Item icon={Plus} to="/boards" search={{ create: key }} active={false}>
            {t('sidebar.createBoard')}
          </Item>
        )}
      </Group>
      <Group label={t('nav.groups.plan')}>
        <Item
          icon={ChartBarHorizontal}
          to="/projects/$key/timeline"
          params={{ key }}
          active={on('timeline')}
        >
          {t('sidebar.timeline')}
        </Item>
        <Item
          icon={CalendarBlank}
          to="/calendar"
          search={{ q: `project = ${key}` }}
          active={on('calendar')}
        >
          {t('calendar.title')}
        </Item>
        <Item
          icon={RocketLaunch}
          to="/projects/$key/releases"
          params={{ key }}
          active={on('releases')}
        >
          {t('releases.title')}
        </Item>
      </Group>
      <Group label={t('nav.groups.project')}>
        <Item
          icon={ChartLine}
          to="/projects/$key/reports"
          params={{ key }}
          search={{}}
          active={on('reports')}
        >
          {t('analysis.title')}
        </Item>
        <Item icon={UsersThree} to="/projects/$key/team" params={{ key }} active={on('team')}>
          {t('team.title')}
        </Item>
        {lore && (
          <Item icon={BookOpen} to="/spaces/$key" params={{ key: lore.key }} active={on('wiki')}>
            {t('sidebar.lore')}
          </Item>
        )}
        <Item
          icon={SlidersHorizontal}
          to="/projects/$key/settings"
          params={{ key }}
          active={on('settings')}
        >
          {t('nav.projectSettings')}
        </Item>
      </Group>
    </>
  );
}

function PlanningMenu({ nav, me }: { nav: Nav; me: Me }) {
  const { t } = useTranslation();
  const modules = useModules();
  return (
    <Group>
      <Item icon={Folder} to="/projects" active={nav.item === 'projects'}>
        {t('sidebar.allProjects')}
      </Item>
      {modules.boards && (
        <Item icon={Kanban} to="/boards" active={nav.item === 'boards'}>
          {t('sidebar.allBoards')}
        </Item>
      )}
      <Item icon={MapTrifold} to="/plans" active={nav.item === 'plans'}>
        {t('plans.title')}
      </Item>
      {modules.dashboards && (
        <Item icon={Gauge} to="/dashboards" active={nav.item === 'dashboards'}>
          {t('dashboards.title')}
        </Item>
      )}
      {me.globalPermissions.includes('browse-users') && (
        <Item icon={Robot} to="/agents" active={nav.item === 'agents'}>
          {t('guard.title')}
        </Item>
      )}
    </Group>
  );
}

function WikiMenu({ nav }: { nav: Nav }) {
  const { t } = useTranslation();
  const spaces = useQuery(spacesQuery);
  const all = [...(spaces.data ?? [])].sort(
    (a, b) => Number(b.favourite) - Number(a.favourite) || a.name.localeCompare(b.name),
  );
  const own = all.filter((space) => !space.project);
  const linked = all.filter((space) => space.project);
  const row = (space: (typeof all)[number]) => (
    <Item
      key={space.id}
      icon={BookOpen}
      to="/spaces/$key"
      params={{ key: space.key }}
      active={nav.item === `space:${space.key}`}
    >
      {space.project ? space.project.name : space.name}
    </Item>
  );
  return (
    <>
      <Group label={t('nav.groups.spaces')}>
        <Item icon={BookOpen} to="/spaces" active={nav.item === 'home'}>
          {t('wikiHome.start')}
        </Item>
        {own.map(row)}
      </Group>
      {linked.length > 0 && <Group label={t('nav.groups.projectWikis')}>{linked.map(row)}</Group>}
      <Favourites kinds={['space', 'page']} nav={nav} />
    </>
  );
}

function ServiceMenu({ nav }: { nav: Nav }) {
  const { t } = useTranslation();
  return (
    <Group>
      <Item icon={Headset} to="/portal" active={nav.item === 'portal'}>
        {t('portal.title')}
      </Item>
    </Group>
  );
}

/** The menu on the left: only the area that is active (or was last). */
export function AreaMenu({ nav, me, inDrawer = false }: { nav: Nav; me: Me; inDrawer?: boolean }) {
  const { t } = useTranslation();
  return (
    <aside
      aria-label={t('nav.areaMenu')}
      className={`flex flex-col gap-4 ${inDrawer ? '' : 'px-3 pt-1.5 pb-3.5'} md:sticky md:top-[var(--topbar-height)] md:h-[calc(100vh-var(--topbar-height))] md:w-[var(--sidebar-width)] md:shrink-0 md:overflow-y-auto`}
    >
      {nav.shown === 'start' && <StartMenu nav={nav} />}
      {nav.shown === 'project' && <ProjectMenu nav={nav} />}
      {nav.shown === 'planning' && <PlanningMenu nav={nav} me={me} />}
      {nav.shown === 'wiki' && <WikiMenu nav={nav} />}
      {nav.shown === 'service' && <ServiceMenu nav={nav} />}
    </aside>
  );
}
