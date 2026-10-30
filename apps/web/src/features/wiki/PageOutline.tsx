import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { RichText } from '@tasklore/shared';
import { type RefObject, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { issueQuery } from '../../lib/tracking';
import { STATUS_TONE, useMetaName } from '../tracking/icons';

interface DocNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
}

function textOf(node: DocNode): string {
  return node.text ?? (node.content ?? []).map(textOf).join('');
}

function walk(node: DocNode, visit: (node: DocNode) => void) {
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

/** Headings of the page in reading order, as the "on this page" list shows them. */
export function outlineOf(doc: RichText): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  walk(doc as DocNode, (node) => {
    if (node.type === 'heading') {
      headings.push({ level: Number(node.attrs?.level ?? 1), text: textOf(node) });
    }
  });
  return headings;
}

/** Keys of the issue macros on the page, each once. */
function issueKeysOf(doc: RichText): string[] {
  const keys = new Set<string>();
  walk(doc as DocNode, (node) => {
    if (node.type === 'issue' && typeof node.attrs?.key === 'string' && node.attrs.key) {
      keys.add(node.attrs.key);
    }
  });
  return [...keys];
}

/** Minutes to read the page at about 200 words a minute, at least one. */
export function readingMinutes(doc: RichText): number {
  const words = textOf(doc as DocNode)
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function LinkedIssue({ issueKey }: { issueKey: string }) {
  // Same query as the issue macro: shares its cache, and hidden issues stay hidden.
  const issue = useQuery({ ...issueQuery(issueKey), retry: false });
  const metaName = useMetaName();
  if (!issue.data) return null;
  return (
    <li className="flex min-w-0 items-center gap-2">
      <Link
        to="/issues/$key"
        params={{ key: issueKey }}
        title={issue.data.summary}
        className="tl-key no-underline hover:underline"
      >
        {issueKey}
      </Link>
      <span
        className={`truncate rounded-[4px] px-1.5 text-[11.5px] leading-[18px] font-medium ${STATUS_TONE[issue.data.status.category]}`}
      >
        {metaName('status', issue.data.status)}
      </span>
    </li>
  );
}

/**
 * The narrow column beside a Lore page (1a S8): its headings, the current one marked while
 * reading, and the issues the page embeds. `article` is where the rendered headings live.
 */
export function PageOutline({
  doc,
  article,
}: {
  doc: RichText;
  article: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const headings = outlineOf(doc).filter((heading) => heading.level <= 3);
  const issueKeys = issueKeysOf(doc);
  const [current, setCurrent] = useState(0);
  const top = Math.min(...headings.map((heading) => heading.level));

  const headingCount = headings.length;

  useEffect(() => {
    // Re-run when headings come or go; the rendered article follows the doc.
    if (headingCount < 2) return;
    const elements = [...(article.current?.querySelectorAll('h1, h2, h3') ?? [])];
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setCurrent(elements.indexOf(visible.target));
      },
      { rootMargin: '0px 0px -70% 0px' },
    );
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [article, headingCount]);

  if (headings.length < 2 && issueKeys.length === 0) return null;
  return (
    <div className="flex flex-col gap-5 text-[13px]">
      {headings.length >= 2 && (
        <nav aria-label={t('wiki.onThisPage')} className="flex flex-col gap-2">
          <h2 className="tl-label m-0 text-[var(--ink-muted)]">{t('wiki.onThisPage')}</h2>
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
            {headings.map((heading, index) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: headings are positional
                key={index}
                style={{ paddingLeft: `${(heading.level - top) * 0.75}rem` }}
              >
                <button
                  type="button"
                  aria-current={index === current ? 'location' : undefined}
                  onClick={() =>
                    article.current
                      ?.querySelectorAll('h1, h2, h3')
                      [index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                  className="cursor-pointer border-0 bg-transparent p-0 text-left text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)] aria-[current=location]:font-medium aria-[current=location]:text-[var(--ink)]"
                >
                  {heading.text || '—'}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {issueKeys.length > 0 && (
        <section aria-label={t('wiki.linkedIssues')} className="flex flex-col gap-2">
          <h2 className="tl-label m-0 text-[var(--ink-muted)]">{t('wiki.linkedIssues')}</h2>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {issueKeys.map((key) => (
              <LinkedIssue key={key} issueKey={key} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
