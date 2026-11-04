import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { client, unwrap } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { spaceQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';

/** The blog of a space: newest first, archive by month, Atom feed (W-PAG-10, TL-29, E-110). */
export function BlogPage({ spaceKey }: { spaceKey: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const space = useQuery(spaceQuery(spaceKey));
  const [month, setMonth] = useState<string | undefined>();
  const blog = useQuery({
    queryKey: ['space', spaceKey, 'blog', month ?? 'latest'],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/spaces/{key}/blog', {
          params: { path: { key: spaceKey }, query: { limit: 20, ...(month ? { month } : {}) } },
        }),
      ),
  });
  const feed = useQuery({
    queryKey: ['me', 'feed-token'],
    queryFn: () => unwrap(client.GET('/api/v1/me/feed-token')),
  });
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/spaces/{key}/pages', {
          params: { path: { key: spaceKey } },
          body: { title: t('blog.newTitle'), kind: 'blog' },
        }),
      ),
    onSuccess: (page) =>
      navigate({ to: '/spaces/$key/pages/$id/edit', params: { key: spaceKey, id: page.id } }),
  });
  const monthName = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(
      new Date(`${value}-15T12:00:00Z`),
    );
  const canEdit = space.data?.permissions.includes('edit');
  return (
    <main className="flex max-w-[960px] flex-col gap-5 px-6 py-6 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 text-[24px] leading-[30px] font-extrabold tracking-[-0.025em]">
          {t('blog.title')}
        </h1>
        <div className="flex items-center gap-3 text-[13px]">
          {feed.data && (
            <a href={`/api/v1/feeds/spaces/${spaceKey}/blog.atom?token=${feed.data.token}`}>
              {t('blog.feed')}
            </a>
          )}
          {canEdit && (
            <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
              {t('blog.new')}
            </Button>
          )}
        </div>
      </header>
      {(blog.error ?? create.error) && (
        <FormError message={(blog.error ?? create.error)?.message ?? ''} />
      )}
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_200px]">
        <div className="flex flex-col gap-5">
          {blog.data?.posts.length === 0 && (
            <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('blog.empty')}</p>
          )}
          {blog.data?.posts.map((post) => (
            <article
              key={post.id}
              className="flex flex-col gap-1 border-b border-[var(--border)] pb-4"
            >
              <Link
                to="/spaces/$key/pages/$id"
                params={{ key: spaceKey, id: post.id }}
                className="text-[18px] font-semibold text-[var(--ink)] no-underline hover:underline"
              >
                {post.title}
              </Link>
              <span className="text-xs text-[var(--ink-muted)]">
                {formatDate(post.publishedAt.slice(0, 10))}
                {post.author && ` · ${post.author.displayName}`}
              </span>
              <p className="m-0 text-[14px]">{post.excerpt}</p>
            </article>
          ))}
        </div>
        <nav aria-label={t('blog.archive')} className="flex flex-col gap-1 text-[13px]">
          <span className="tl-label text-[var(--ink-muted)]">{t('blog.archive')}</span>
          <button
            type="button"
            className="text-left hover:underline"
            onClick={() => setMonth(undefined)}
          >
            {t('blog.latest')}
          </button>
          {blog.data?.months.map((entry) => (
            <button
              key={entry.month}
              type="button"
              aria-pressed={month === entry.month}
              onClick={() => setMonth(entry.month)}
              className="text-left hover:underline aria-pressed:font-semibold"
            >
              {monthName(entry.month)} ({entry.count})
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}
