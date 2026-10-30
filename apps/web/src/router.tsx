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
import { AdminLayout } from './features/admin/AdminLayout';
import { CustomFieldsPage } from './features/admin/CustomFieldsPage';
import { TimeTrackingSettingsPage } from './features/admin/TimeTrackingSettingsPage';
import { WebhookPage, WebhooksPage } from './features/admin/WebhooksPage';
import { type LoginError, LoginPage } from './features/auth/LoginPage';
import { SetupPage } from './features/auth/SetupPage';
import { BacklogPage } from './features/boards/BacklogPage';
import { BoardPage } from './features/boards/BoardPage';
import { BoardsPage } from './features/boards/BoardsPage';
import {
  NotificationsPage,
  type NotificationTab,
} from './features/notifications/NotificationsPage';
import { ActivityPage } from './features/personal/ActivityPage';
import { type ReportKind, ReportsPage } from './features/reports/ReportsPage';
import { EverythingPage } from './features/search/EverythingPage';
import { SearchPage } from './features/search/SearchPage';
import { AppShell } from './features/shell/AppShell';
import { HomePage } from './features/shell/HomePage';
import { TimelinePage } from './features/timeline/TimelinePage';
import { IssuePage } from './features/tracking/IssuePage';
import { ProjectIssuesPage } from './features/tracking/ProjectIssuesPage';
import { ProjectsPage } from './features/tracking/ProjectsPage';
import { LabelPages, SpaceLabelsPage } from './features/wiki/LabelPages';
import { PageEditor } from './features/wiki/PageEditor';
import { PageHistory } from './features/wiki/PageHistory';
import { SpaceHome, SpaceLayout } from './features/wiki/SpaceLayout';
import { SpaceSettingsPage } from './features/wiki/SpaceSettingsPage';
import { SpacesPage } from './features/wiki/SpacesPage';
import { TrashPage } from './features/wiki/TrashPage';
import { WikiPage } from './features/wiki/WikiPage';
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

/** Everything below requires a signed-in user. */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) throw redirect({ to: '/login', search: { redirect: location.href } });
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
      spaceLabelsRoute,
    ]),
    labelRoute,
    projectsRoute,
    projectRoute,
    timelineRoute,
    everythingRoute,
    searchRoute,
    issueRoute,
    activityRoute,
    notificationsRoute,
    boardsRoute,
    boardRoute,
    backlogRoute,
    reportsRoute,
    adminRoute.addChildren([webhooksRoute, webhookRoute, timeTrackingRoute, customFieldsRoute]),
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
