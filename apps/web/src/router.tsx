import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { REPORT_KINDS, type ReportKind, safeRedirectPath } from '@toolvibes/shared';
import { ISSUE_KEY } from '@toolvibes/tql';
import { useTranslation } from 'react-i18next';
import { AccessCheckPage } from './features/admin/AccessCheckPage';
import { AdminLayout } from './features/admin/AdminLayout';
import { CustomFieldsPage } from './features/admin/CustomFieldsPage';
import { DirectoriesPage } from './features/admin/DirectoriesPage';
import { EmbedHostsPage } from './features/admin/EmbedHostsPage';
import { GitConnectionsPage } from './features/admin/GitConnectionsPage';
import { ImportPage } from './features/admin/ImportPage';
import { MaintenancePage } from './features/admin/MaintenancePage';
import {
  NotificationSchemeEditor,
  NotificationSchemesPage,
} from './features/admin/NotificationSchemes';
import { OperationsPage } from './features/admin/OperationsPage';
import { PermissionSchemeEditor, PermissionSchemesPage } from './features/admin/PermissionSchemes';
import { SecuritySchemeEditor, SecuritySchemesPage } from './features/admin/SecuritySchemes';
import { SignInSettingsPage } from './features/admin/SignInSettingsPage';
import { TimeTrackingSettingsPage } from './features/admin/TimeTrackingSettingsPage';
import { WebhookPage, WebhooksPage } from './features/admin/WebhooksPage';
import { AccessibilityPage } from './features/auth/AccessibilityPage';
import { InvitePage, RegisterPage } from './features/auth/InvitePage';
import { type LoginError, LoginPage } from './features/auth/LoginPage';
import { type AuthorizeParams, OAuthConsentPage } from './features/auth/OAuthConsentPage';
import { SetupPage } from './features/auth/SetupPage';
import { TwoFactorPage } from './features/auth/TwoFactorPage';
import { WelcomePage } from './features/auth/WelcomePage';
import { RuleEditorPage } from './features/automation/RuleEditorPage';
import { RulesList } from './features/automation/RulesList';
import { BacklogPage } from './features/boards/BacklogPage';
import { BoardPage } from './features/boards/BoardPage';
import { BoardsPage } from './features/boards/BoardsPage';
import { CalendarPage, type CalendarView } from './features/calendar/CalendarPage';
import { DashboardPage, StartPage } from './features/dashboards/DashboardPage';
import { DashboardsPage } from './features/dashboards/DashboardsPage';
import {
  NotificationsPage,
  type NotificationTab,
} from './features/notifications/NotificationsPage';
import { ActivityPage } from './features/personal/ActivityPage';
import { ProfilePage } from './features/personal/ProfilePage';
import { PlanPage } from './features/plans/PlanPage';
import { PlansPage } from './features/plans/PlansPage';
import { PortalDeskPage, PortalPage, PortalRequestPage } from './features/portal/PortalPages';
import { ReleasePage, ReleasesPage } from './features/releases/ReleasesPage';
import { ProjectReportsPage } from './features/reports/ProjectReportsPage';
import { type ReportKind as BoardReportKind, ReportsPage } from './features/reports/ReportsPage';
import { EverythingPage } from './features/search/EverythingPage';
import { IssuePrintPage } from './features/search/IssueExport';
import { SearchPage } from './features/search/SearchPage';
import { ProjectSettingsPage } from './features/settings/ProjectSettingsPage';
import { MaintenanceScreen } from './features/shell/Announcement';
import { AppShell } from './features/shell/AppShell';
import { HelpPage } from './features/shell/HelpPage';
import { TimesheetPage } from './features/time/TimesheetPage';
import { TimelinePage } from './features/timeline/TimelinePage';
import { IssuePage } from './features/tracking/IssuePage';
import { ProjectIssuesPage } from './features/tracking/ProjectIssuesPage';
import { ProjectsPage } from './features/tracking/ProjectsPage';
import { BlogPage } from './features/wiki/BlogPage';
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
import { ApiError } from './lib/api';
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

/** Accepting an invitation or finishing a registration (P-USR-15, TL-67, E-119). */
const inviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invite',
  validateSearch: (search: Record<string, unknown>): { token: string } => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  component: function Invite() {
    const { token } = inviteRoute.useSearch();
    return <InvitePage token={token} />;
  },
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: RegisterPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string; error?: LoginError } => ({
    redirect: safeRedirectPath(search.redirect),
    error:
      search.error === 'oidc' || search.error === 'oidc_denied' || search.error === 'saml'
        ? search.error
        : undefined,
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

/** The second step of a sign-in, or setting it up where a group demands it (TL-18, E-100). */
const twoFactorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/two-factor',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: safeRedirectPath(search.redirect),
  }),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) throw redirect({ to: '/login' });
    if (!me.twoFactor.pending) throw redirect({ to: '/' });
    applyLocale(me.locale);
    return { me };
  },
  component: function TwoFactor() {
    const { redirect: target } = twoFactorRoute.useSearch();
    return <TwoFactorPage me={twoFactorRoute.useRouteContext().me} redirect={target} />;
  },
});

/** Consent for MCP clients signing in with OAuth (TL-69, E-115); needs a signed-in person. */
const oauthAuthorizeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/oauth/authorize',
  validateSearch: (search: Record<string, unknown>): AuthorizeParams =>
    Object.fromEntries(
      [
        'response_type',
        'client_id',
        'redirect_uri',
        'code_challenge',
        'code_challenge_method',
        'state',
        'scope',
        'resource',
      ].flatMap((key) => {
        const value = search[key];
        return typeof value === 'string' || typeof value === 'number' ? [[key, String(value)]] : [];
      }),
    ),
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) throw redirect({ to: '/login', search: { redirect: location.href } });
    applyLocale(me.locale);
  },
  component: function OAuthAuthorize() {
    return <OAuthConsentPage params={oauthAuthorizeRoute.useSearch()} />;
  },
});

/** The welcome steps after the first sign-in, full screen outside the app shell (E-71). */
const welcomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/welcome',
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) throw redirect({ to: '/login', search: { redirect: '/welcome' } });
    if (me.twoFactor.pending)
      throw redirect({ to: '/two-factor', search: { redirect: '/welcome' } });
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
  validateSearch: (
    search: Record<string, unknown>,
  ): { children?: boolean; contents?: boolean; auto?: boolean } => ({
    children: search.children === true || search.children === 'true' ? true : undefined,
    contents: search.contents === true || search.contents === 'true' ? true : undefined,
    auto: search.auto === true || search.auto === 'true' || search.auto === 1 ? true : undefined,
  }),
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) throw redirect({ to: '/login', search: { redirect: location.href } });
    applyLocale(me.locale);
  },
  component: function Print() {
    const { key, id } = printRoute.useParams();
    const { children, contents, auto } = printRoute.useSearch();
    return (
      <PrintPage
        spaceKey={key.toUpperCase()}
        id={id}
        withChildren={children ?? false}
        contents={contents ?? false}
        auto={auto ?? false}
      />
    );
  },
});

/** The accessibility statement, readable without signing in (TL-43, E-124). */
const accessibilityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accessibility',
  component: AccessibilityPage,
});

/** While maintenance mode keeps people out (TL-40, E-121). */
const maintenanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/maintenance',
  component: MaintenanceScreen,
});

/** Everything below requires a signed-in user. */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQuery).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 503) throw redirect({ to: '/maintenance' });
      throw error;
    });
    if (!me) throw redirect({ to: '/login', search: { redirect: location.href } });
    if (me.twoFactor.pending) {
      throw redirect({ to: '/two-factor', search: { redirect: location.href } });
    }
    applyLocale(me.locale);
    // New people start with the welcome steps (E-71).
    if (!me.onboarded) throw redirect({ to: '/welcome' });
    return { me };
  },
  component: function App() {
    return <AppShell me={appRoute.useRouteContext().me} />;
  },
});

const helpRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/help',
  component: HelpPage,
});

const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: function Home() {
    return <StartPage me={homeRoute.useRouteContext().me} />;
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

const blogRoute = createRoute({
  getParentRoute: () => spaceRoute,
  path: '/blog',
  component: function SpaceBlog() {
    return <BlogPage spaceKey={spaceRoute.useParams().key.toUpperCase()} />;
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

const releasesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects/$key/releases',
  component: function Releases() {
    const { key } = releasesRoute.useParams();
    return <ReleasesPage key={key} projectKey={key.toUpperCase()} />;
  },
});

const releaseRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects/$key/releases/$id',
  component: function ReleaseView() {
    const { key, id } = releaseRoute.useParams();
    return <ReleasePage key={id} projectKey={key.toUpperCase()} id={id} />;
  },
});

const projectReportsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects/$key/reports',
  validateSearch: (search: Record<string, unknown>): { kind?: ReportKind } => ({
    kind: (REPORT_KINDS as readonly unknown[]).includes(search.kind)
      ? (search.kind as ReportKind)
      : undefined,
  }),
  component: function ProjectReports() {
    const { key } = projectReportsRoute.useParams();
    const { kind } = projectReportsRoute.useSearch();
    return <ProjectReportsPage key={key} projectKey={key.toUpperCase()} kind={kind ?? 'cfd'} />;
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

/** Issues by a date field on a month or week grid (T-VIEW-02, E-113). */
const calendarRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/calendar',
  validateSearch: (
    search: Record<string, unknown>,
  ): { q?: string; field?: string; date?: string; view?: CalendarView } => ({
    q: typeof search.q === 'string' ? search.q : undefined,
    field: typeof search.field === 'string' ? search.field : undefined,
    date:
      typeof search.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.date)
        ? search.date
        : undefined,
    view: search.view === 'week' ? 'week' : undefined,
  }),
  component: function Calendar() {
    const { q, field, date, view } = calendarRoute.useSearch();
    return (
      <CalendarPage query={q ?? ''} field={field ?? 'due'} date={date} view={view ?? 'month'} />
    );
  },
});

/** Search results for paper, outside the app shell like the page print view (T-QRY-09). */
const issuesPrintRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/issues/print',
  validateSearch: (search: Record<string, unknown>): { q?: string; auto?: boolean } => ({
    q: typeof search.q === 'string' ? search.q : undefined,
    auto: search.auto === true || search.auto === 'true' ? true : undefined,
  }),
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) throw redirect({ to: '/login', search: { redirect: location.href } });
    applyLocale(me.locale);
  },
  component: function IssuesPrint() {
    const { q, auto } = issuesPrintRoute.useSearch();
    return <IssuePrintPage query={q ?? ''} auto={auto ?? false} />;
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

const dashboardsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/dashboards',
  component: function Dashboards() {
    return <DashboardsPage me={dashboardsRoute.useRouteContext().me} />;
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/dashboards/$id',
  component: function DashboardRoute() {
    const { id } = dashboardRoute.useParams();
    return <DashboardPage key={id} id={id} me={dashboardRoute.useRouteContext().me} />;
  },
});

const plansRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/plans',
  component: PlansPage,
});

const planRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/plans/$id',
  component: function Plan() {
    const { id } = planRoute.useParams();
    return <PlanPage key={id} id={id} />;
  },
});

const portalRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/portal',
  component: PortalPage,
});

const portalDeskRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/portal/$key',
  component: function PortalDesk() {
    const { key } = portalDeskRoute.useParams();
    return <PortalDeskPage key={key} deskKey={key.toUpperCase()} />;
  },
});

const portalRequestRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/portal/requests/$key',
  component: function PortalRequest() {
    const { key } = portalRequestRoute.useParams();
    return <PortalRequestPage key={key} issueKey={key.toUpperCase()} />;
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
  validateSearch: (
    search: Record<string, unknown>,
  ): { report?: BoardReportKind; sprint?: string } => ({
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

const securitySchemesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/security-schemes',
  component: SecuritySchemesPage,
});

const securitySchemeRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/security-schemes/$id',
  component: function SecurityScheme() {
    const { id } = securitySchemeRoute.useParams();
    return <SecuritySchemeEditor key={id} id={id} />;
  },
});

const accessCheckRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/access-check',
  component: AccessCheckPage,
});

const customFieldsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/custom-fields',
  component: CustomFieldsPage,
});

const directoriesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/directories',
  component: DirectoriesPage,
});

const maintenancePageRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/maintenance',
  component: MaintenancePage,
});

const operationsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/operations',
  component: OperationsPage,
});

const importRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/import',
  component: ImportPage,
});

const gitConnectionsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/git',
  component: GitConnectionsPage,
});

const embedHostsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/embeds',
  component: EmbedHostsPage,
});

const automationAdminRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/automation',
  component: function GlobalRules() {
    return (
      <main className="flex max-w-[960px] flex-col gap-5 px-10 py-7">
        <RulesList />
      </main>
    );
  },
});

const timesheetRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/timesheet',
  validateSearch: (search: Record<string, unknown>): { user?: string; week?: string } => ({
    user: typeof search.user === 'string' ? search.user : undefined,
    week: typeof search.week === 'string' ? search.week : undefined,
  }),
  component: function Timesheet() {
    const { user, week } = timesheetRoute.useSearch();
    return <TimesheetPage user={user} week={week} />;
  },
});

const newRuleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/automation/new',
  validateSearch: (search: Record<string, unknown>): { project?: string; template?: string } => ({
    project: typeof search.project === 'string' ? search.project : undefined,
    template: typeof search.template === 'string' ? search.template : undefined,
  }),
  component: function NewRule() {
    const { project, template } = newRuleRoute.useSearch();
    return (
      <RuleEditorPage key={`${project}:${template}`} projectKey={project} template={template} />
    );
  },
});

const ruleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/automation/rules/$id',
  component: function Rule() {
    const { id } = ruleRoute.useParams();
    return <RuleEditorPage key={id} id={id} />;
  },
});

const signInSettingsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/sign-in',
  component: SignInSettingsPage,
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
  accessibilityRoute,
  maintenanceRoute,
  twoFactorRoute,
  loginRoute,
  welcomeRoute,
  printRoute,
  inviteRoute,
  registerRoute,
  oauthAuthorizeRoute,
  issuesPrintRoute,
  appRoute.addChildren([
    homeRoute,
    helpRoute,
    dashboardsRoute,
    dashboardRoute,
    plansRoute,
    planRoute,
    portalRoute,
    portalDeskRoute,
    portalRequestRoute,
    spacesRoute,
    spaceRoute.addChildren([
      spaceHomeRoute,
      wikiPageRoute,
      pageEditRoute,
      pageHistoryRoute,
      trashRoute,
      blogRoute,
      spaceSettingsRoute,
      spaceTemplateRoute,
      spaceLabelsRoute,
    ]),
    labelRoute,
    projectsRoute,
    projectRoute,
    timelineRoute,
    projectReportsRoute,
    releasesRoute,
    releaseRoute,
    newRuleRoute,
    timesheetRoute,
    ruleRoute,
    projectSettingsRoute,
    everythingRoute,
    searchRoute,
    calendarRoute,
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
      signInSettingsRoute,
      timeTrackingRoute,
      automationAdminRoute,
      embedHostsRoute,
      gitConnectionsRoute,
      importRoute,
      maintenancePageRoute,
      operationsRoute,
      directoriesRoute,
      permissionSchemesRoute,
      permissionSchemeRoute,
      notificationSchemesRoute,
      notificationSchemeRoute,
      securitySchemesRoute,
      securitySchemeRoute,
      accessCheckRoute,
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
