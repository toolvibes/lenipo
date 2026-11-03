import { useQuery } from '@tanstack/react-query';
import type { AppModule, AppSummary } from '@toolvibes/shared';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { meQuery } from '../../lib/queries';

export const appsQuery = {
  queryKey: ['apps'],
  queryFn: () => unwrap(client.GET('/api/v1/apps')),
  staleTime: 5 * 60_000,
};

/** Where a module is shown and on what; goes to the app as its context. */
export interface AppPlace {
  kind: 'issuePanel' | 'macro' | 'gadget';
  issueKey?: string;
  projectKey?: string;
  pageId?: string;
  /** Free text the macro or gadget was configured with. */
  config?: string;
}

const MIN_HEIGHT = 40;
const MAX_HEIGHT = 2_000;

function theme(): 'light' | 'dark' {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * A module of an installed app (TL-50, E-140) in a sandboxed iframe on the app's origin.
 * Messages: the app sends `lenipo:ready`, `lenipo:resize {height}` and `lenipo:token`; Lenipo
 * answers with `lenipo:context` and `lenipo:token {accessToken, expiresIn, apiBase}`. Both
 * sides check the other's origin.
 */
export function AppFrame({
  app,
  module,
  place,
  height: initialHeight = 200,
}: {
  app: AppSummary;
  module: AppModule;
  place: AppPlace;
  height?: number;
}) {
  const { t, i18n } = useTranslation();
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(initialHeight);
  const me = useQuery(meQuery).data;
  const context = JSON.stringify({
    app: app.key,
    module: module.key,
    ...place,
    user: me ? { id: me.id, displayName: me.displayName } : null,
    locale: i18n.language,
    theme: theme(),
  });

  // Also on load: a quick page may say "ready" before this listener exists.
  const sendContext = () =>
    frame.current?.contentWindow?.postMessage(
      { type: 'lenipo:context', context: JSON.parse(context) },
      app.origin,
    );

  useEffect(() => {
    const post = (message: Record<string, unknown>) =>
      frame.current?.contentWindow?.postMessage(message, app.origin);
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== app.origin) return;
      const data = event.data as { type?: unknown; height?: unknown };
      if (data?.type === 'lenipo:ready') {
        post({ type: 'lenipo:context', context: JSON.parse(context) });
      } else if (data?.type === 'lenipo:resize' && typeof data.height === 'number') {
        setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(data.height))));
      } else if (data?.type === 'lenipo:token' && app.usesApi) {
        unwrap(client.POST('/api/v1/apps/{id}/token', { params: { path: { id: app.id } } })).then(
          (token) =>
            post({
              type: 'lenipo:token',
              accessToken: token.accessToken,
              expiresIn: token.expiresIn,
              scopes: token.scopes,
              apiBase: `${window.location.origin}/api/v1`,
            }),
          (error: Error) => post({ type: 'lenipo:error', message: error.message }),
        );
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [app, context]);

  return (
    <iframe
      ref={frame}
      onLoad={sendContext}
      title={t('apps.frameTitle', { app: app.name, module: module.title })}
      src={module.url}
      height={height}
      // Its own origin (never ours, checked at install), so allow-same-origin only gives the
      // app its own storage.
      sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
      referrerPolicy="no-referrer"
      loading="lazy"
      className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)]"
    />
  );
}

/** The issue panels of all enabled apps, below the issue's other panels. */
export function AppIssuePanels({ issueKey, projectKey }: { issueKey: string; projectKey: string }) {
  const apps = useQuery(appsQuery).data ?? [];
  const panels = apps.flatMap((app) => app.modules.issuePanels.map((module) => ({ app, module })));
  if (panels.length === 0) return null;
  return (
    <>
      {panels.map(({ app, module }) => (
        <section key={`${app.id}:${module.key}`} className="flex flex-col gap-1 text-[13px]">
          <h3 className="tl-label m-0 text-[var(--ink-muted)]">{module.title}</h3>
          <AppFrame
            app={app}
            module={module}
            place={{ kind: 'issuePanel', issueKey, projectKey }}
          />
        </section>
      ))}
    </>
  );
}
