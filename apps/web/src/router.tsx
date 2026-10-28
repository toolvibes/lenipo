import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { LoginPage } from './features/auth/LoginPage';
import { SetupPage } from './features/auth/SetupPage';
import { PageView } from './features/pages/PageView';
import { AppShell } from './features/shell/AppShell';
import { HomePage } from './features/shell/HomePage';
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
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    // Only same-site paths, never absolute URLs (open redirect).
    typeof search.redirect === 'string' &&
    search.redirect.startsWith('/') &&
    !search.redirect.startsWith('//')
      ? { redirect: search.redirect }
      : {},
  beforeLoad: async ({ context }) => {
    const status = await context.queryClient.fetchQuery(setupStatusQuery);
    if (status.required) throw redirect({ to: '/setup' });
  },
  component: function Login() {
    return <LoginPage redirect={loginRoute.useSearch().redirect} />;
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

const routeTree = rootRoute.addChildren([
  setupRoute,
  loginRoute,
  appRoute.addChildren([homeRoute, pageRoute]),
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent' });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
