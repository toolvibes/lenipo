import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The bar above every page of direction 1a (E-67): where you are as a breadcrumb, page-wide
 * actions on the right. The last crumb is the current page.
 */
export function TopBar({ crumbs, actions }: { crumbs: ReactNode[]; actions?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2">
      <nav aria-label={t('shell.breadcrumbs')} className="min-w-0 flex-1">
        <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-[13px] text-[var(--ink-muted)]">
          {crumbs.map((crumb, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: crumbs are positional
            <Fragment key={index}>
              {index > 0 && (
                <li aria-hidden className="text-[var(--ink-muted)] opacity-60">
                  /
                </li>
              )}
              <li
                aria-current={index === crumbs.length - 1 ? 'page' : undefined}
                className="min-w-0 truncate aria-[current=page]:font-semibold aria-[current=page]:text-[var(--ink)] [&_a]:text-[var(--ink-muted)] [&_a]:no-underline [&_a:hover]:text-[var(--ink)]"
              >
                {crumb}
              </li>
            </Fragment>
          ))}
        </ol>
      </nav>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Title block below the top bar: page title, a line of context, the page's main actions. */
export function PageHeading({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5 pb-3.5">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="tl-heading-xl m-0 flex items-center gap-2">{title}</h1>
        {subtitle && <div className="text-[13px] text-[var(--ink-muted)]">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A filter chip: dark when on (E-67). */
export const CHIP =
  'inline-flex h-[30px] items-center gap-1 rounded-full bg-[var(--surface-2)] px-3 text-[12.5px] font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--selected)] hover:text-[var(--ink)] aria-pressed:bg-[var(--ink)] aria-pressed:font-semibold aria-pressed:text-[var(--surface-1)]';
