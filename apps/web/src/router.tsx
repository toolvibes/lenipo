import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { safeRedirectPath } from '@tasklore/shared';
import { ISSUE_KEY } from '@tasklore/tql';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from './features/admin/AdminLayout';
import { CustomFieldsPage } from './features/admin/CustomFieldsPage';
import {
  NotificationSchemeEditor,
  NotificationSchemesPage,
} from './features/admin/NotificationSchemes';
import { PermissionSchemeEditor, PermissionSchemesPage } from './features/admin/PermissionSchemes';
import { TimeTrackingSettingsPage } from './features/admin/TimeTrackingSettingsPage';
import { WebhookPage, WebhooksPage } from './features/admin/WebhooksPage';
import { type LoginError, LoginPage } from './features/auth/LoginPage';
import { SetupPage } from './features/auth/SetupPage';
import { WelcomePage } from './features/auth/WelcomePage';
import { BacklogPage } from './features/boards/BacklogPage';
import { BoardPage } from './features/boards/BoardPage';
import { BoardsPage } from './features/boards/BoardsPage';
import {
  NotificationsPage,
  type NotificationTab,
} from './features/notifications/NotificationsPage';
import { ActivityPage } from './features/personal/ActivityPage';
import { ProfilePage } from './features/personal/ProfilePage';
import { type ReportKind, ReportsPage } from './features/reports/ReportsPage';
import { EverythingPage } from './features/search/EverythingPage';
import { SearchPage } from './features/search/SearchPage';
import { ProjectSettingsPage } from './features/settings/ProjectSettingsPage';
import { AppShell } from './features/shell/AppShell';
import { HomePage } from './features/shell/HomePage';
import { TimelinePage } from './features/timeline/TimelinePage';
import { IssuePage } from './features/tracking/IssuePage';
import { ProjectIssuesPage } from './features/tracking/ProjectIssuesPage';
import { ProjectsPage } from './features/tracking/ProjectsPage';
import { LabelPages, SpaceLabelsPage } from './features/wiki/LabelPages';
import { PageEditor } from './features/wiki/PageEditor';
import { PageHistory } from './features/wiki/PageHistory';
import { PrintPage } from './features/wiki/PrintPage';
import { SpaceHome, SpaceLayout } from './features/wiki/SpaceLayout';
import { SpaceSettingsPage } from './features/wiki/SpaceSettingsPage';
import { SpacesPage } from './features/wiki/SpacesPage';
import { TrashPage } from './features/wiki/TrashPage';
import { TemplateEditorPage, TemplateList } from './features/wiki/templates';
import { WikiPage } from './features/wiki/WikiPage';
import { applyLocale } from './i18n';
import { meQuery, setupStatusQuery } from './lib/queries';
import type { EverythingType } from './lib/search';

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: Outlet });

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup',
  beforeLoad: async ({ context }) => {
    const status = await context.queryClient.fetchQuery(setupStatusQuery);
    if (!status.required) throw redirect({ to: '/login' });
  },
  component: SetupPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string; error?: LoginError } => ({
    redirect: safeRedirectPath(search.redirect),
    error: search.error === 'oidc' || search.error === 'oidc_denied' ? search.error : undefined,
  }),
  beforeLoad: async ({ context }) => {
    const status = await context.queryClient.fetchQuery(setupStatusQuery);
    if (status.required) throw redirect({ to: '/setup' });
  },
  component: function Login() {
    const { redirect, error } = loginRoute.useSearch();
    return <LoginPage redirect={redirect} error={error} />;
  },
});

/** The welcome steps after the first sign-in, full screen outside the app shell (E-71). */
const welcomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/welcome',
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) throw redirect({ to: '/login', search: { redirect: '/welcome' } });
    if (me.onboarded) throw redirect({ to: '/' });
    applyLocale(me.locale);
    return { me };
  },
  component: function Welcome() {
    return <WelcomePage me={welcomeRoute.useRouteContext().me} />;
  },
});

/** A page laid out for paper, outside the app shell (W-EXP-04, E-75). */
const printRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/spaces/$key/pages/$id/print',
  validateSearch: (search: Record<string, unknown>): { children?: boolean; auto?: boolean } => ({
    children: search.children === true || search.children === 'true' ? true : undefined,
    auto: search.auto === true || search.auto === 'true' || search.auto === 1 ? true : undefined,
  }),
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) throw redirect({ to: '/login', search: { redirect: location.href } });
    applyLocale(me.locale);
  },
  component: function Print() {
    const { key, id } = printRoute.useParams();
    const { children, auto } = printRoute.useSearch();
    return (
      <PrintPage
        spaceKey={key.toUpperCase()}
        id={id}
        withChildren={children ?? false}
        auto={auto ?? false}
      />
    );
  },
});

/** Everything below requires a signed-in user. */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) throw redirect({ to: '/login', search: { redirect: location.href } });
    applyLocale(me.locale);
    // New people start with the welcome steps (E-71).
    if (!me.onboarded) throw redirect({ to: '/welcome' });
    return { me };
  },
  component: function App() {
    return <AppShell me={appRoute.useRouteContext().me} />;
  },
});

const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: function Home() {
    return <HomePage me={homeRoute.useRouteContext().me} />;
  },
});

const spacesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/spaces',
  component: function Spaces() {
    return <SpacesPage me={spacesRoute.useRouteContext().me} />;
  },
});

const spaceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/spaces/$key',
  component: function Space() {
    const { key } = spaceRoute.useParams();
    return <SpaceLayout key={key} spaceKey={key.toUpperCase()} />;
  },
});

const spaceHomeRoute = createRoute({
  getParentRoute: () => spaceRoute,
  path: '/',
  component: function SpaceIndex() {
    return <SpaceHome spaceKey={spaceRoute.useParams().key.toUpperCase()} />;
  },
});

const wikiPageRoute = createRoute({
  getParentRoute: () => spaceRoute,
  path: '/pages/$id',
  component: function WikiPageRouteComponent() {
    const { key, id } = wikiPageRoute.useParams();
    return <WikiPage key={id} spaceKey={key.toUpperCase()} id={id} />;
  },
});

const pageEditRoute = createRoute({
  getParentRoute: () => spaceRoute,
  path: '/pages/$id/edit',
  component: function PageEdit() {
    const { me } = pageEditRoute.useRouteContext();
    const { key, id } = pageEditRoute.useParams();
    // Remount per page, so the editor never mixes two documents.
    return <PageEditor key={id} me={me} spaceKey={key.toUpperCase()} id={id} />;
  },
});

const versionNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
};

const pageHistoryRoute = createRoute({
  getParentRoute: () => spaceRoute,
  path: '/pages/$id/history',
  validateSearch: (
    search: Record<string, unknown>,
  ): { from?: number; to?: number; view?: number } => ({
    from: versionNumber(search.from),
    to: versionNumber(search.to),
    view: versionNumber(search.view),
  }),
  component: function History() {
    const { key, id } = pageHistoryRoute.useParams();
    const search = pageHistoryRoute.useSearch();
    return <PageHistory key={id} spaceKey={key.toUpperCase()} id={id} {...search} />;
  },
});

const trashRoute = createRoute({
  getParentRoute: () => spaceRoute,
  path: '/trash',
  component: function Trash() {
    return <TrashPage spaceKey={spaceRoute.useParams().key.toUpperCase()} />;
  },
});

const spaceLabelsRoute = createRoute({
  getParentRoute: () => spaceRoute,
  path: '/labels',
  component: function SpaceLabels() {
    return <SpaceLabelsPage spaceKey={spaceRoute.useParams().key.toUpperCase()} />;
  },
});

const labelRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/labels/$label',
  validateSearch: (search: Record<string, unknown>): { space?: string } => ({
    space: typeof search.space === 'string' && search.space ? search.space : undefined,
  }),
  component: function Label() {
    const { label } = labelRoute.useParams();
    const { space } = labelRoute.useSearch();
    return <LabelPages key={`${label}:${space ?? ''}`} label={label} space={space} />;
  },
});

const spaceTemplateRoute = createRoute({
  getParentRoute: () => spaceRoute,
  path: '/templates/$id',
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  component: function SpaceTemplate() {
    const { key } = spaceRoute.useParams();
    const { id } = spaceTemplateRoute.useParams();
    const { from } = spaceTemplateRoute.useSearch();
    return (
      <TemplateEditorPage key={`${id}:${from}`} spaceKey={key.toUpperCase()} id={id} from={from} />
    );
  },
});

const spaceSettingsRoute = createRoute({
  getParentRoute: () => spaceRoute,
  path: '/settings',
  component: function SpaceSettings() {
    return <SpaceSettingsPage spaceKey={spaceRoute.useParams().key.toUpperCase()} />;
  },
});

const projectsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects',
  component: function Projects() {
    return <ProjectsPage me={projectsRoute.useRouteContext().me} />;
  },
});

/** An issue key for the detail beside a list (E-49); anything else is dropped. */
function selectedKey(value: unknown): string | undefined {
  return typeof value === 'string' && ISSUE_KEY.test(value) ? value.toUpperCase() : undefined;
}

const projectRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects/$key',
  validateSearch: (search: Record<string, unknown>): { selected?: string } => ({
    selected: selectedKey(search.selected),
  }),
  component: function Project() {
    const { me } = projectRoute.useRouteContext();
    const { key } = projectRoute.useParams();
    const { selected } = projectRoute.useSearch();
    return (
      <ProjectIssuesPage key={key} me={me} projectKey={key.toUpperCase()} selected={selected} />
    );
  },
});

const timelineRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects/$key/timeline',
  component: function Timeline() {
    const { key } = timelineRoute.useParams();
    return <TimelinePage key={key} projectKey={key.toUpperCase()} />;
  },
});

const projectSettingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects/$key/settings',
  component: function ProjectSettings() {
    const { key } = projectSettingsRoute.useParams();
    return <ProjectSettingsPage key={key} projectKey={key.toUpperCase()} />;
  },
});

const everythingRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/search',
  validateSearch: (
    search: Record<string, unknown>,
  ): { q?: string; type?: EverythingType; project?: string } => ({
    q: typeof search.q === 'string' && search.q.trim() ? search.q : undefined,
    type:
      search.type === 'issue' ||
      search.type === 'page' ||
      search.type === 'project' ||
      search.type === 'space'
        ? search.type
        : undefined,
    project: typeof search.project === 'string' ? search.project : undefined,
  }),
  component: function Everything() {
    const { q, type, project } = everythingRoute.useSearch();
    return <EverythingPage q={q ?? ''} type={type} project={project} />;
  },
});

const searchRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/issues',
  validateSearch: (
    search: Record<string, unknown>,
  ): { q?: string; filter?: string; selected?: string } => ({
    q: typeof search.q === 'string' ? search.q : undefined,
    filter: typeof search.filter === 'string' ? search.filter : undefined,
    selected: selectedKey(search.selected),
  }),
  component: function Search() {
    const { me } = searchRoute.useRouteContext();
    const { q, filter, selected } = searchRoute.useSearch();
    return <SearchPage me={me} q={q} filterId={filter} selected={selected} />;
  },
});

const issueRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/issues/$key',
  component: function IssueView() {
    const { me } = issueRoute.useRouteContext();
    const { key } = issueRoute.useParams();
    return <IssuePage key={key} me={me} issueKey={key.toUpperCase()} />;
  },
});

const boardsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/boards',
  component: BoardsPage,
});

const boardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/boards/$id',
  validateSearch: (search: Record<string, unknown>): { filters?: string; selected?: string } => ({
    filters: typeof search.filters === 'string' ? search.filters : undefined,
    selected: selectedKey(search.selected),
  }),
  component: function BoardView() {
    const { me } = boardRoute.useRouteContext();
    const { id } = boardRoute.useParams();
    const { filters, selected } = boardRoute.useSearch();
    return (
      <BoardPage
        key={id}
        me={me}
        id={id}
        filters={filters ? filters.split(',').filter(Boolean) : []}
        selected={selected}
      />
    );
  },
});

const backlogRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/boards/$id/backlog',
  validateSearch: (search: Record<string, unknown>): { selected?: string } => ({
    selected: selectedKey(search.selected),
  }),
  component: function Backlog() {
    const { me } = backlogRoute.useRouteContext();
    const { id } = backlogRoute.useParams();
    const { selected } = backlogRoute.useSearch();
    return <BacklogPage key={id} me={me} id={id} selected={selected} />;
  },
});

const reportsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/boards/$id/reports',
  validateSearch: (search: Record<string, unknown>): { report?: ReportKind; sprint?: string } => ({
    report:
      search.report === 'velocity' || search.report === 'sprint' || search.report === 'burndown'
        ? search.report
        : undefined,
    sprint: typeof search.sprint === 'string' ? search.sprint : undefined,
  }),
  component: function Reports() {
    const { id } = reportsRoute.useParams();
    const { report, sprint } = reportsRoute.useSearch();
    return <ReportsPage key={id} id={id} report={report ?? 'burndown'} sprintId={sprint} />;
  },
});

const activityRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/activity',
  validateSearch: (search: Record<string, unknown>): { project?: string; user?: string } => ({
    project: typeof search.project === 'string' ? search.project : undefined,
    user: typeof search.user === 'string' ? search.user : undefined,
  }),
  component: function Activity() {
    const { me } = activityRoute.useRouteContext();
    const { project, user } = activityRoute.useSearch();
    return <ActivityPage me={me} project={project} user={user} />;
  },
});

const notificationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/notifications',
  validateSearch: (search: Record<string, unknown>): { tab?: NotificationTab } => ({
    tab:
      search.tab === 'mention' || search.tab === 'assigned' || search.tab === 'all'
        ? search.tab
        : undefined,
  }),
  component: function Notifications() {
    const { tab } = notificationsRoute.useSearch();
    return <NotificationsPage key={tab ?? 'unread'} tab={tab ?? 'unread'} />;
  },
});

const profileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/profile',
  component: ProfilePage,
});

/** Administration needs the global permission "admin"; the API checks it again. */
const adminRoute = createRoute({
  getParentRoute: () => appRoute,
  id: 'admin',
  beforeLoad: ({ context }) => {
    if (!context.me.globalPermissions.includes('admin')) throw redirect({ to: '/' });
  },
  component: AdminLayout,
});

const webhooksRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/webhooks',
  component: WebhooksPage,
});

const templatesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/templates',
  component: function Templates() {
    const { t } = useTranslation();
    return (
      <main className="flex max-w-[960px] flex-col gap-5 px-10 py-7">
        <header className="flex flex-col gap-1">
          <h1 className="m-0 text-[22px] leading-7 font-semibold tracking-[-0.015em]">
            {t('templates.globalTitle')}
          </h1>
          <p className="m-0 text-[13.5px] text-[var(--ink-muted)]">{t('templates.globalHelp')}</p>
        </header>
        <TemplateList canManage />
      </main>
    );
  },
});

const templateRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/templates/$id',
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  component: function Template() {
    const { id } = templateRoute.useParams();
    const { from } = templateRoute.useSearch();
    return <TemplateEditorPage key={`${id}:${from}`} id={id} from={from} />;
  },
});

const permissionSchemesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/permission-schemes',
  component: PermissionSchemesPage,
});

const permissionSchemeRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/permission-schemes/$id',
  component: function PermissionScheme() {
    const { id } = permissionSchemeRoute.useParams();
    return <PermissionSchemeEditor key={id} id={id} />;
  },
});

const notificationSchemesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/notification-schemes',
  component: NotificationSchemesPage,
});

const notificationSchemeRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/notification-schemes/$id',
  component: function NotificationScheme() {
    const { id } = notificationSchemeRoute.useParams();
    return <NotificationSchemeEditor key={id} id={id} />;
  },
});

const customFieldsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/custom-fields',
  component: CustomFieldsPage,
});

const timeTrackingRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/time-tracking',
  component: TimeTrackingSettingsPage,
});

const webhookRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/webhooks/$id',
  component: function Webhook() {
    const { id } = webhookRoute.useParams();
    return <WebhookPage key={id} id={id} />;
  },
});

const routeTree = rootRoute.addChildren([
  setupRoute,
  loginRoute,
  welcomeRoute,
  printRoute,
  appRoute.addChildren([
    homeRoute,
    spacesRoute,
    spaceRoute.addChildren([
      spaceHomeRoute,
      wikiPageRoute,
      pageEditRoute,
      pageHistoryRoute,
      trashRoute,
      spaceSettingsRoute,
      spaceTemplateRoute,
      spaceLabelsRoute,
    ]),
    labelRoute,
    projectsRoute,
    projectRoute,
    timelineRoute,
    projectSettingsRoute,
    everythingRoute,
    searchRoute,
    issueRoute,
    activityRoute,
    notificationsRoute,
    profileRoute,
    boardsRoute,
    boardRoute,
    backlogRoute,
    reportsRoute,
    adminRoute.addChildren([
      webhooksRoute,
      webhookRoute,
      timeTrackingRoute,
      permissionSchemesRoute,
      permissionSchemeRoute,
      notificationSchemesRoute,
      notificationSchemeRoute,
      customFieldsRoute,
      templatesRoute,
      templateRoute,
    ]),
  ]),
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent' });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
