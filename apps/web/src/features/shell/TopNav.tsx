import {
  Bell,
  CaretDown,
  MagnifyingGlass,
  PaintBrush,
  Question,
  ShieldCheck,
  SignOut,
  UserCircle,
} from '@phosphor-icons/react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { Me } from '@toolvibes/shared';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { noticeQuery, useModules } from '../../lib/instance';
import type { Area } from '../../lib/navigation';
import { unreadCountQuery } from '../../lib/notifications';
import { initials, presenceColor } from '../../lib/presence';
import { projectsQuery } from '../../lib/tracking';
import { LogoMark } from '../../ui/Logo';
import { TimerBar } from '../time/TimerBar';
import { projectTarget, useProjectTargets } from './projectTargets';
import type { Nav } from './useNav';

const TAB =
  'flex h-[38px] items-center gap-2 rounded-[11px] px-[13px] text-[13.5px] font-medium whitespace-nowrap text-[var(--ink-soft)] no-underline transition-colors hover:bg-[var(--border)] hover:text-[var(--ink)] aria-[current=page]:bg-[var(--surface-1)] aria-[current=page]:font-bold aria-[current=page]:text-[var(--ink)] aria-[current=page]:shadow-[var(--shadow-control)] aria-[current=true]:bg-[var(--surface-1)] aria-[current=true]:font-bold aria-[current=true]:text-[var(--ink)] aria-[current=true]:shadow-[var(--shadow-control)]';
const ICON_BUTTON =
  'relative grid size-[38px] place-items-center rounded-[11px] text-[var(--ink-soft)] transition-colors hover:bg-[var(--border)] hover:text-[var(--ink)] aria-[current=page]:bg-[var(--surface-1)] aria-[current=page]:text-[var(--accent-hover)] aria-[current=page]:shadow-[var(--shadow-control)]';
const MENU =
  'z-50 min-w-56 rounded-[var(--radius-lg)] bg-[var(--surface-1)] p-1.5 text-[13.5px] shadow-[var(--shadow-float)]';
const MENU_ITEM =
  'flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-[var(--ink)] no-underline outline-none data-[highlighted]:bg-[var(--selected)]';

/** The default page of each area (the project tab picks the project's board). */
const AREA_HOME: Record<Exclude<Area, 'project'>, string> = {
  start: '/',
  planning: '/projects',
  wiki: '/spaces',
  service: '/portal',
};

/** The project tab: into the last project from elsewhere, the project switcher inside it. */
function ProjectTab({ nav }: { nav: Nav }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const targets = useProjectTargets(nav.project?.key ?? null);
  const projects = useQuery(projectsQuery);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const active = nav.area === 'project';
  const label = (
    <>
      {nav.project && (
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-[4px]"
          style={{ backgroundColor: presenceColor(nav.project.key) }}
        />
      )}
      <span className="max-w-[180px] truncate">{nav.project?.name ?? t('nav.project')}</span>
      <CaretDown size={14} weight="bold" aria-hidden />
    </>
  );
  if (!active) {
    if (!nav.project) {
      return (
        <Link to="/projects" className={TAB}>
          {label}
        </Link>
      );
    }
    const key = nav.project.key;
    return targets.board ? (
      <Link to="/boards/$id" params={{ id: targets.board.id }} search={{}} className={TAB}>
        {label}
      </Link>
    ) : (
      <Link to="/projects/$key" params={{ key }} className={TAB}>
        {label}
      </Link>
    );
  }
  const needle = filter.trim().toLowerCase();
  const shown = (projects.data ?? []).filter(
    (project) =>
      !needle ||
      project.name.toLowerCase().includes(needle) ||
      project.key.toLowerCase().includes(needle),
  );
  async function choose(key: string) {
    setOpen(false);
    setFilter('');
    await navigate({ href: await projectTarget(queryClient, key, nav.item) });
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={`${TAB} cursor-pointer border-0`}
        aria-current="true"
        aria-label={t('nav.switchProject', { name: nav.project?.name ?? t('nav.project') })}
      >
        {label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 flex w-80 flex-col gap-0.5 rounded-[16px] bg-[var(--surface-1)] p-2.5 shadow-[var(--shadow-float)]"
        >
          <label className="tl-field-group mb-1.5 flex h-9 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface-input)] px-3 text-[13px] text-[var(--ink-muted)]">
            <MagnifyingGlass size={15} aria-hidden />
            <input
              type="search"
              // biome-ignore lint/a11y/noAutofocus: the switcher opens to search
              autoFocus
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={t('nav.searchProject')}
              aria-label={t('nav.searchProject')}
              className="min-w-0 flex-1 border-0 bg-transparent text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus-visible:outline-none"
            />
          </label>
          <ul className="m-0 flex max-h-80 list-none flex-col gap-0.5 overflow-y-auto p-0">
            {shown.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => choose(project.key)}
                  aria-current={project.key === nav.project?.key ? 'true' : undefined}
                  className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] border-0 bg-transparent px-2.5 text-left text-[13.5px] font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] aria-[current=true]:bg-[var(--selected)] aria-[current=true]:font-bold"
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
                </button>
              </li>
            ))}
            {shown.length === 0 && (
              <li className="px-2.5 py-2 text-[13px] text-[var(--ink-muted)]">
                {t('projects.noMatch')}
              </li>
            )}
          </ul>
          <div className="mx-1 my-1.5 h-px bg-[var(--border)]" />
          <Link
            to="/projects"
            onClick={() => setOpen(false)}
            className="flex h-[38px] items-center rounded-[var(--radius-md)] px-2.5 text-[13px] font-semibold text-[var(--accent)] no-underline hover:bg-[var(--surface-hover)]"
          >
            {t('nav.allProjects')}
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Area tabs: Start, the project, Planung, Wiki, Service. */
export function AreaTabs({ nav, vertical = false }: { nav: Nav; vertical?: boolean }) {
  const { t } = useTranslation();
  const tab = (area: Exclude<Area, 'project'>) => (
    <Link
      key={area}
      to={AREA_HOME[area]}
      activeOptions={{ exact: true, includeSearch: true }}
      activeProps={{}}
      aria-current={nav.area === area ? 'true' : undefined}
      className={TAB}
    >
      {t(`nav.areas.${area}`)}
    </Link>
  );
  return (
    <nav
      aria-label={t('nav.areasLabel')}
      className={vertical ? 'flex flex-col gap-0.5' : 'flex items-center gap-[3px]'}
    >
      {tab('start')}
      <ProjectTab nav={nav} />
      {tab('planning')}
      {tab('wiki')}
      {tab('service')}
    </nav>
  );
}

function HelpMenu() {
  const { t } = useTranslation();
  const notice = useQuery(noticeQuery).data;
  const helpUrl = notice?.helpUrl ?? null;
  const supportUrl = notice?.supportUrl ?? null;
  const legal = notice?.legal;
  const external = (href: string, label: ReactNode) => (
    <Menu.Item asChild>
      <a href={href} target="_blank" rel="noreferrer" className={MENU_ITEM}>
        {label}
      </a>
    </Menu.Item>
  );
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={t('sidebar.help')}
        title={t('sidebar.help')}
        className={`${ICON_BUTTON} cursor-pointer border-0 bg-transparent`}
      >
        <Question size={19} aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} className={MENU}>
          {helpUrl ? (
            external(helpUrl, t('nav.handbook'))
          ) : (
            <Menu.Item asChild>
              <Link to="/help" className={MENU_ITEM}>
                {t('nav.handbook')}
              </Link>
            </Menu.Item>
          )}
          {supportUrl && external(supportUrl, t('sidebar.support'))}
          <Menu.Item asChild>
            <Link to="/accessibility" className={MENU_ITEM}>
              {t('accessibility.link')}
            </Link>
          </Menu.Item>
          {(legal?.imprintUrl || legal?.privacyUrl) && (
            <Menu.Separator className="mx-1 my-1 h-px bg-[var(--border)]" />
          )}
          {legal?.imprintUrl && external(legal.imprintUrl, t('legal.imprint'))}
          {legal?.privacyUrl && external(legal.privacyUrl, t('legal.privacy'))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

function AccountMenu({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const { t } = useTranslation();
  const isAdmin = me.globalPermissions.includes('admin');
  return (
    <Menu.Root>
      <Menu.Trigger
        title={t('nav.account')}
        className="ml-1 grid size-[34px] cursor-pointer place-items-center rounded-full border-0 text-[11.5px] font-bold text-white"
        style={{ backgroundColor: presenceColor(me.id) }}
      >
        {/* The name comes from the content, so it holds the visible initials (WCAG 2.5.3). */}
        <span className="sr-only">{t('nav.account')}: </span>
        {initials(me.displayName)}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} className={MENU}>
          <div className="flex flex-col px-2.5 pt-1.5 pb-2 leading-tight">
            <span className="truncate font-bold">{me.displayName}</span>
            <span className="truncate text-[12px] text-[var(--ink-muted)]">{me.email}</span>
          </div>
          <Menu.Separator className="mx-1 mb-1 h-px bg-[var(--border)]" />
          <Menu.Item asChild>
            <Link to="/profile" className={MENU_ITEM}>
              <UserCircle size={17} aria-hidden />
              {t('nav.profile')}
            </Link>
          </Menu.Item>
          <Menu.Item asChild>
            <Link to="/profile" hash="notifications" className={MENU_ITEM}>
              <Bell size={17} aria-hidden />
              {t('notifications.title')}
            </Link>
          </Menu.Item>
          <Menu.Item asChild>
            <Link to="/profile" hash="appearance" className={MENU_ITEM}>
              <PaintBrush size={17} aria-hidden />
              {t('profile.appearance')}
            </Link>
          </Menu.Item>
          {isAdmin && (
            <Menu.Item asChild>
              <Link to="/admin/webhooks" className={MENU_ITEM}>
                <ShieldCheck size={17} aria-hidden />
                {t('shell.administration')}
              </Link>
            </Menu.Item>
          )}
          <Menu.Separator className="mx-1 my-1 h-px bg-[var(--border)]" />
          <Menu.Item onSelect={onSignOut} className={MENU_ITEM}>
            <SignOut size={17} aria-hidden />
            {t('common.signOut')}
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** The bell: notifications live only here; the count of unread ones on it. */
export function NotificationsButton({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const count = useQuery(unreadCountQuery).data?.count ?? 0;
  return (
    <Link
      to="/notifications"
      search={{}}
      aria-current={active ? 'page' : undefined}
      aria-label={
        count > 0 ? t('notifications.openWithCount', { count }) : t('notifications.title')
      }
      className={ICON_BUTTON}
    >
      <Bell size={19} aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute top-1 right-[3px] rounded-full bg-[var(--accent)] px-[5px] py-px font-[family-name:var(--font-mono)] text-[9.5px] font-semibold text-[var(--on-accent)] shadow-[0_0_0_2px_var(--surface-2)]"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

/** The top bar over the full width (62 px): logo, areas, search, help, bell, account. */
export function TopNav({
  me,
  nav,
  path,
  onSearch,
  onSignOut,
}: {
  me: Me;
  nav: Nav;
  path: string;
  onSearch: () => void;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const modules = useModules();
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] items-center gap-1.5 bg-[var(--surface-2)] pr-3.5 pl-5">
      <Link
        to="/"
        activeOptions={{ exact: true }}
        activeProps={{}}
        className="mr-[18px] flex items-center gap-2.5 text-[var(--ink)] no-underline"
      >
        <LogoMark size={28} />
        <span className="text-[17px] font-extrabold tracking-[-0.02em]">{t('common.product')}</span>
      </Link>
      <AreaTabs nav={nav} />
      <span className="flex-1" />
      {modules['time-tracking'] && <TimerBar />}
      <button
        type="button"
        onClick={onSearch}
        className="mr-1.5 flex h-[38px] w-[230px] cursor-pointer items-center gap-2 rounded-[11px] border-0 bg-[var(--surface-1)] pr-2.5 pl-3 text-left text-[13px] text-[var(--ink-muted)] shadow-[var(--shadow-control)] transition-shadow hover:shadow-[var(--shadow-raised)]"
      >
        <MagnifyingGlass size={16} aria-hidden />
        <span className="flex-1">{t('sidebar.search')}</span>
        <kbd className="rounded-[6px] bg-[var(--surface-input)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] font-medium">
          {isMac ? '⌘K' : t('shell.paletteShortcut')}
        </kbd>
      </button>
      <HelpMenu />
      <NotificationsButton active={path === '/notifications'} />
      <AccountMenu me={me} onSignOut={onSignOut} />
    </header>
  );
}

export { AccountMenu, HelpMenu };
