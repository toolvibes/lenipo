import { type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../lib/api';
import { buttonClass } from '../../ui/Button';
import { LogoMark } from '../../ui/Logo';
import { MaintenanceScreen } from './Announcement';

type Kind = 'unreachable' | 'maintenance' | 'forbidden' | 'missing' | 'other';

/** What went wrong, in the terms people can act on. */
export function kindOf(error: unknown): Kind {
  if (error instanceof ApiError) {
    if (error.problem.type === 'urn:lenipo:problem:maintenance') return 'maintenance';
    // The proxy in front answers for a server that is restarting or gone.
    if ([502, 503, 504].includes(error.status)) return 'unreachable';
    if (error.status === 403) return 'forbidden';
    if (error.status === 404) return 'missing';
    return 'other';
  }
  // fetch rejects without an answer: no connection, or the server is down.
  if (error instanceof TypeError) return 'unreachable';
  return 'other';
}

/** How often to look whether the server is back. */
const RETRY_MS = 4_000;

/**
 * Shown instead of a page that failed to load: a server that is restarting or being updated
 * (with an automatic retry), maintenance, missing rights, a missing page, or another error with
 * its details.
 */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const kind = kindOf(error);
  const [checking, setChecking] = useState(false);

  const retry = async () => {
    reset();
    await router.invalidate();
  };

  // While the server is away, look every few seconds and carry on once it answers.
  useEffect(() => {
    if (kind !== 'unreachable') return;
    let stopped = false;
    const timer = setInterval(async () => {
      setChecking(true);
      try {
        const response = await fetch('/api/v1/health/live', { cache: 'no-store' });
        if (response.ok && !stopped) {
          clearInterval(timer);
          reset();
          await router.invalidate();
        }
      } catch {
        // Still away.
      } finally {
        if (!stopped) setChecking(false);
      }
    }, RETRY_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [kind, reset, router]);

  if (kind === 'maintenance') return <MaintenanceScreen />;

  const message = error instanceof Error ? error.message : String(error);
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[520px] flex-col justify-center gap-4 px-4 py-10">
      <LogoMark size={28} />
      <h1 className="m-0 text-[22px] leading-tight font-semibold tracking-[-0.01em]">
        {t(`routeError.${kind}.title`)}
      </h1>
      <p className="m-0 text-[var(--ink-muted)]">{t(`routeError.${kind}.text`)}</p>
      {kind === 'unreachable' && (
        <p
          className="m-0 flex items-center gap-2 text-[13px] text-[var(--ink-muted)]"
          role="status"
        >
          <span
            aria-hidden
            className={`size-2 shrink-0 rounded-full bg-[var(--warning)] ${checking ? 'animate-pulse' : ''}`}
          />
          {t('routeError.unreachable.waiting')}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {kind !== 'missing' && kind !== 'forbidden' && (
          <button type="button" className={buttonClass('primary')} onClick={() => void retry()}>
            {t('routeError.retry')}
          </button>
        )}
        <Link
          to="/"
          className={buttonClass(
            kind === 'missing' || kind === 'forbidden' ? 'primary' : 'secondary',
          )}
        >
          {t('routeError.home')}
        </Link>
      </div>
      {kind === 'other' && (
        <details className="text-[13px] text-[var(--ink-muted)]">
          <summary className="cursor-pointer">{t('routeError.details')}</summary>
          <pre className="mt-2 overflow-x-auto rounded-[var(--radius-md)] bg-[var(--surface-2)] p-3 text-xs whitespace-pre-wrap">
            {error instanceof ApiError
              ? `${error.status} ${error.problem.title}\n${error.problem.type}\n${message}`
              : message}
          </pre>
        </details>
      )}
    </main>
  );
}

/** For addresses no route knows. */
export function RouteNotFound() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[520px] flex-col justify-center gap-4 px-4 py-10">
      <LogoMark size={28} />
      <h1 className="m-0 text-[22px] leading-tight font-semibold tracking-[-0.01em]">
        {t('routeError.missing.title')}
      </h1>
      <p className="m-0 text-[var(--ink-muted)]">{t('routeError.missing.text')}</p>
      <div>
        <Link to="/" className={buttonClass('primary')}>
          {t('routeError.home')}
        </Link>
      </div>
    </main>
  );
}
