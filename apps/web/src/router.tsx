import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { safeRedirectPath } from '@tasklore/shared';
import { type LoginError, LoginPage } from './features/auth/LoginPage';
import { SetupPage } from './features/auth/SetupPage';
import { PageView } from './features/pages/PageView';
import { SearchPage } from './features/search/SearchPage';
import { AppShell } from './features/shell/AppShell';
import { HomePage } from './features/shell/HomePage';
import { IssuePage } from './features/tracking/IssuePage';
import { ProjectIssuesPage } from './features/tracking/ProjectIssuesPage';
import { ProjectsPage } from './features/tracking/ProjectsPage';
import { meQuery, setupStatusQuery } from './lib/queries';

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

const pageRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/pages/$pageId',
  component: function Page() {
    const { me } = pageRoute.useRouteContext();
    const { pageId } = pageRoute.useParams();
    // Remount per page, so the editor never mixes two documents.
    return <PageView key={pageId} me={me} pageId={pageId} />;
  },
});

const projectsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects',
  component: function Projects() {
    return <ProjectsPage me={projectsRoute.useRouteContext().me} />;
  },
});

const projectRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects/$key',
  component: function Project() {
    const { me } = projectRoute.useRouteContext();
    const { key } = projectRoute.useParams();
    return <ProjectIssuesPage key={key} me={me} projectKey={key.toUpperCase()} />;
  },
});

const searchRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/issues',
  validateSearch: (search: Record<string, unknown>): { q?: string; filter?: string } => ({
    q: typeof search.q === 'string' ? search.q : undefined,
    filter: typeof search.filter === 'string' ? search.filter : undefined,
  }),
  component: function Search() {
    const { me } = searchRoute.useRouteContext();
    const { q, filter } = searchRoute.useSearch();
    return <SearchPage me={me} q={q} filterId={filter} />;
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

const routeTree = rootRoute.addChildren([
  setupRoute,
  loginRoute,
  appRoute.addChildren([
    homeRoute,
    pageRoute,
    projectsRoute,
    projectRoute,
    searchRoute,
    issueRoute,
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
