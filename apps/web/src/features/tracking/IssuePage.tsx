import { CaretDown, Eye, EyeSlash } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Comment, Issue, Me, RichText, UpdateIssueRequest } from '@tasklore/shared';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, client, unwrap } from '../../lib/api';
import { formatDate, formatDateTime, formatRelative } from '../../lib/format';
import {
  commentsQuery,
  historyQuery,
  issueQuery,
  projectQuery,
  trackingMetaQuery,
  transitionsQuery,
} from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Attachments } from './Attachments';
import { ComponentsField } from './ComponentsField';
import { IssueLinks } from './IssueLinks';
import { IssueTypeIcon, PriorityIcon, StatusLozenge, useMetaName } from './icons';
import { RichTextEditor, RichTextView } from './RichTextEditor';
import { Avatar, UserPicker } from './UserPicker';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="tl-label pt-1.5 uppercase text-[var(--ink-muted)]">{label}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </>
  );
}

const inputClass =
  'h-[var(--control-sm)] w-full rounded-[var(--radius-md)] border border-transparent bg-transparent px-1.5 text-[var(--ink)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] disabled:hover:border-transparent';

/** Text-like field that saves on blur or Enter when the value changed. */
function InlineInput({
  value,
  onSave,
  disabled,
  ...props
}: { value: string; onSave: (value: string) => void; disabled: boolean } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
>) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onSave(draft);
  };
  return (
    <input
      {...props}
      value={draft}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        if (event.key === 'Escape') setDraft(value);
      }}
      className={`${inputClass} ${props.className ?? ''}`}
    />
  );
}

function StatusMenu({
  issue,
  enabled,
  onTransition,
}: {
  issue: Issue;
  enabled: boolean;
  onTransition: (id: string) => void;
}) {
  const { t } = useTranslation();
  const metaName = useMetaName();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const transitions = useQuery({ ...transitionsQuery(issue.key), enabled: open });

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !container.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('issues.changeStatus')}
        disabled={!enabled}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-[var(--radius-sm)] disabled:cursor-default"
      >
        <StatusLozenge status={issue.status} />
        {enabled && <CaretDown size={14} aria-hidden className="text-[var(--ink-muted)]" />}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-10 mt-1 min-w-48 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-1 shadow-[var(--shadow-float)]"
        >
          {transitions.data?.map((transition) => (
            <button
              key={transition.id}
              type="button"
              role="menuitem"
              aria-label={metaName('status', transition.to)}
              onClick={() => {
                setOpen(false);
                onTransition(transition.id);
              }}
              className="flex w-full items-center rounded-[var(--radius-md)] px-2 py-1.5 text-left hover:bg-[var(--surface-2)]"
            >
              <StatusLozenge status={transition.to} />
            </button>
          ))}
          {transitions.data?.length === 0 && (
            <div className="px-2 py-1.5 text-[var(--ink-muted)]">
              {metaName('status', issue.status)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** One comment; own comments can be edited and deleted, administrators delete any (E-42). */
function CommentItem({
  comment,
  issueKey,
  projectKey,
}: {
  comment: Comment;
  issueKey: string;
  projectKey: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const path = { params: { path: { key: issueKey, commentId: comment.id } } };
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['issue', issueKey, 'comments'] });
  const edit = useMutation({
    mutationFn: (body: RichText) =>
      unwrap(
        client.PATCH('/api/v1/issues/{key}/comments/{commentId}', { ...path, body: { body } }),
      ),
    onSuccess: async () => {
      await refresh();
      setEditing(false);
    },
  });
  const remove = useMutation({
    mutationFn: () => unwrap(client.DELETE('/api/v1/issues/{key}/comments/{commentId}', path)),
    onSuccess: refresh,
  });
  const action =
    'text-xs text-[var(--ink-muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline';

  return (
    <article className="flex gap-3">
      {comment.author && <Avatar user={comment.author} size={28} />}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <strong className="font-semibold">{comment.author?.displayName}</strong>
          <span
            className="text-xs text-[var(--ink-muted)]"
            title={formatDateTime(comment.createdAt)}
          >
            {formatRelative(comment.createdAt)}
          </span>
          {comment.edited && (
            <span
              className="text-xs text-[var(--ink-muted)]"
              title={formatDateTime(comment.updatedAt)}
            >
              {t('issues.edited')}
            </span>
          )}
          {!editing && comment.canEdit && (
            <button type="button" className={action} onClick={() => setEditing(true)}>
              {t('issues.editComment')}
            </button>
          )}
          {!editing && comment.canDelete && (
            <button type="button" className={action} onClick={() => setConfirming(true)}>
              {t('issues.deleteComment')}
            </button>
          )}
        </span>
        {(edit.error ?? remove.error) && (
          <FormError message={(edit.error ?? remove.error)?.message ?? ''} />
        )}
        {confirming && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-[var(--danger-soft)] px-3 py-2"
          >
            <span className="flex-1">{t('issues.deleteCommentConfirm')}</span>
            <Button
              size="sm"
              variant="danger"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {t('issues.deleteComment')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        )}
        {editing ? (
          <RichTextEditor
            initial={comment.body}
            placeholder={t('issues.addComment')}
            submitLabel={t('common.save')}
            autoFocus
            busy={edit.isPending}
            mentionProjectKey={projectKey}
            onCancel={() => setEditing(false)}
            onSubmit={(body) => edit.mutate(body)}
          />
        ) : (
          <div className="[&_.tl-prose]:text-[15px] [&_.tl-prose]:leading-6">
            <RichTextView doc={comment.body} />
          </div>
        )}
      </div>
    </article>
  );
}

function Activity({
  issueKey,
  projectKey,
  canComment,
}: {
  issueKey: string;
  projectKey: string;
  canComment: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'comments' | 'history'>('comments');
  const comments = useQuery(commentsQuery(issueKey));
  const history = useQuery({ ...historyQuery(issueKey), enabled: tab === 'history' });
  const addComment = useMutation({
    mutationFn: (body: RichText) =>
      unwrap(
        client.POST('/api/v1/issues/{key}/comments', {
          params: { path: { key: issueKey } },
          body: { body },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['issue', issueKey] }),
  });

  const tabButton = (value: typeof tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === value}
      onClick={() => setTab(value)}
      className={`h-8 border-b-2 px-2.5 ${tab === value ? 'border-[var(--accent)] font-semibold text-[var(--accent)]' : 'border-transparent text-[var(--ink-muted)]'}`}
    >
      {label}
    </button>
  );

  return (
    <section aria-label={t('issues.activity')} className="flex flex-col gap-3">
      <div role="tablist" className="flex gap-1 border-b border-[var(--border)]">
        {tabButton(
          'comments',
          `${t('issues.comments')}${comments.data ? ` · ${comments.data.length}` : ''}`,
        )}
        {tabButton('history', t('issues.history'))}
      </div>
      {tab === 'comments' ? (
        <>
          {canComment && (
            <RichTextEditor
              initial={null}
              placeholder={t('issues.addComment')}
              submitLabel={t('issues.postComment')}
              onSubmit={(body) => addComment.mutate(body)}
              busy={addComment.isPending}
              clearOnSubmit
              mentionProjectKey={projectKey}
            />
          )}
          {addComment.error && <FormError message={addComment.error.message} />}
          {comments.data?.length === 0 && (
            <p className="text-[var(--ink-muted)]">{t('issues.noComments')}</p>
          )}
          {[...(comments.data ?? [])].reverse().map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              issueKey={issueKey}
              projectKey={projectKey}
            />
          ))}
        </>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {history.data?.length === 0 && (
            <li className="text-[var(--ink-muted)]">{t('issues.noHistory')}</li>
          )}
          {history.data?.map((group) => (
            <li key={group.id} className="flex gap-3">
              {group.author && <Avatar user={group.author} size={24} />}
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs text-[var(--ink-muted)]">
                  <strong className="font-semibold text-[var(--ink)]">
                    {group.author?.displayName}
                  </strong>{' '}
                  · {formatRelative(group.createdAt)}
                </span>
                {/* A change group records each field at most once. */}
                {group.items.map((item) => (
                  <span key={item.field} className="min-w-0 break-words">
                    {item.field === 'description' ? (
                      t('issues.descriptionChanged')
                    ) : (
                      <>
                        <span className="text-[var(--ink-muted)]">
                          {t(`issues.field.${item.field}` as never)}:{' '}
                        </span>
                        {t('issues.changedFrom', {
                          from: item.from ?? t('issues.none'),
                          to: item.to ?? t('issues.none'),
                        })}
                      </>
                    )}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function IssuePage({ me, issueKey }: { me: Me; issueKey: string }) {
  const { t } = useTranslation();
  const metaName = useMetaName();
  const queryClient = useQueryClient();
  const issue = useQuery(issueQuery(issueKey));
  const project = useQuery({
    ...projectQuery(issue.data?.project.key ?? ''),
    enabled: !!issue.data,
  });
  const meta = useQuery(trackingMetaQuery);
  const [editingDescription, setEditingDescription] = useState(false);
  const [pickingAssignee, setPickingAssignee] = useState(false);

  const refresh = (updated: Issue) => {
    queryClient.setQueryData(issueQuery(issueKey).queryKey, updated);
    void queryClient.invalidateQueries({ queryKey: ['issue', issueKey, 'history'] });
    void queryClient.invalidateQueries({ queryKey: ['issue', issueKey, 'transitions'] });
    void queryClient.invalidateQueries({ queryKey: ['project-issues'] });
  };
  const update = useMutation({
    mutationFn: (body: UpdateIssueRequest) =>
      unwrap(client.PATCH('/api/v1/issues/{key}', { params: { path: { key: issueKey } }, body })),
    onSuccess: refresh,
  });
  const transition = useMutation({
    mutationFn: (transitionId: string) =>
      unwrap(
        client.POST('/api/v1/issues/{key}/transitions', {
          params: { path: { key: issueKey } },
          body: { transitionId },
        }),
      ),
    onSuccess: refresh,
  });
  const watch = useMutation({
    mutationFn: async (watching: boolean) => {
      const options = { params: { path: { key: issueKey } } };
      await (watching
        ? client.PUT('/api/v1/issues/{key}/watching', options)
        : client.DELETE('/api/v1/issues/{key}/watching', options));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: issueQuery(issueKey).queryKey }),
  });

  if (issue.error) {
    return (
      <p className="px-6 py-8 text-[var(--ink-muted)]">
        {issue.error instanceof ApiError && issue.error.status === 404
          ? t('issues.notFound')
          : issue.error.message}
      </p>
    );
  }
  if (!issue.data)
    return <p className="px-6 py-8 text-[var(--ink-muted)]">{t('common.loading')}</p>;
  const data = issue.data;
  const permissions = new Set(project.data?.permissions ?? []);
  const canEdit = permissions.has('edit-issues');
  const error = update.error ?? transition.error;

  return (
    <main className="flex flex-col gap-4 px-6 py-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 max-w-[880px] flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-muted)]">
            <Link
              to="/projects/$key"
              params={{ key: data.project.key }}
              className="no-underline hover:underline"
            >
              {data.project.name}
            </Link>
            {data.parent && (
              <>
                {' / '}
                <Link
                  to="/issues/$key"
                  params={{ key: data.parent.key }}
                  className="tl-key no-underline hover:underline"
                >
                  {data.parent.key}
                </Link>
              </>
            )}
            {' / '}
            <IssueTypeIcon type={data.issueType} size={14} />
            <span className="tl-key">{data.key}</span>
          </span>
          <InlineInput
            value={data.summary}
            disabled={!canEdit}
            aria-label={t('issues.summary')}
            onSave={(summary) => summary.trim() && update.mutate({ summary: summary.trim() })}
            className="tl-heading-lg !h-auto py-0.5"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusMenu
            issue={data}
            enabled={permissions.has('transition-issues')}
            onTransition={(id) => transition.mutate(id)}
          />
          <Button size="sm" onClick={() => watch.mutate(!data.watching)}>
            {data.watching ? <EyeSlash size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            {data.watching ? t('issues.unwatch') : t('issues.watch')} · {data.watcherCount}
          </Button>
        </div>
      </header>
      {error && <FormError message={error.message} />}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <section aria-label={t('issues.description')} className="flex flex-col gap-2">
            <h2 className="tl-heading-md">{t('issues.description')}</h2>
            {editingDescription ? (
              <RichTextEditor
                initial={data.description}
                placeholder={t('issues.descriptionPlaceholder')}
                submitLabel={t('common.save')}
                autoFocus
                busy={update.isPending}
                mentionProjectKey={data.project.key}
                onCancel={() => setEditingDescription(false)}
                onSubmit={(description) =>
                  update.mutate({ description }, { onSuccess: () => setEditingDescription(false) })
                }
              />
            ) : (
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setEditingDescription(true)}
                className="rounded-[var(--radius-md)] border border-transparent px-4 py-3 text-left hover:border-[var(--border)] disabled:hover:border-transparent"
              >
                {data.description ? (
                  <RichTextView doc={data.description} />
                ) : (
                  <span className="text-[var(--ink-muted)]">
                    {t('issues.descriptionPlaceholder')}
                  </span>
                )}
              </button>
            )}
          </section>

          {data.children.length > 0 && (
            <section aria-label={t('issues.children')} className="flex flex-col gap-2">
              <h2 className="tl-heading-md">{t('issues.children')}</h2>
              <ul className="m-0 list-none overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-0">
                {data.children.map((child) => (
                  <li
                    key={child.id}
                    className="flex h-[var(--row-comfortable)] items-center gap-2 border-b border-[var(--border)] px-3 last:border-b-0"
                  >
                    <IssueTypeIcon type={child.issueType} />
                    <Link
                      to="/issues/$key"
                      params={{ key: child.key }}
                      className="tl-key no-underline hover:underline"
                    >
                      {child.key}
                    </Link>
                    <span className="min-w-0 flex-1 truncate">{child.summary}</span>
                    <StatusLozenge status={child.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Attachments issueKey={data.key} canAttach={permissions.has('comment')} />

          <IssueLinks
            issue={data}
            canEdit={canEdit}
            onChanged={(updated) =>
              updated
                ? refresh(updated)
                : void queryClient.invalidateQueries({ queryKey: ['issue', issueKey] })
            }
          />

          <Activity
            issueKey={data.key}
            projectKey={data.project.key}
            canComment={permissions.has('comment')}
          />
        </div>

        <aside className="flex max-w-full min-w-0 flex-[1_1_300px] flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-4">
          <dl className="m-0 grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] gap-x-3 gap-y-2">
            <Field label={t('issues.assignee')}>
              <button
                type="button"
                disabled={!permissions.has('assign-issues')}
                onClick={() => setPickingAssignee(true)}
                className={`${inputClass} flex items-center gap-2 text-left`}
              >
                {data.assignee ? (
                  <>
                    <Avatar user={data.assignee} size={20} />
                    <span className="truncate">{data.assignee.displayName}</span>
                  </>
                ) : (
                  <span className="text-[var(--ink-muted)]">{t('issues.unassigned')}</span>
                )}
              </button>
            </Field>
            <Field label={t('issues.reporter')}>
              <span className="flex h-[var(--control-sm)] items-center gap-2 px-1.5">
                {data.reporter && <Avatar user={data.reporter} size={20} />}
                {data.reporter?.displayName ?? t('issues.none')}
              </span>
            </Field>
            <Field label={t('issues.priority')}>
              <span className="flex items-center gap-1 pl-1.5">
                <PriorityIcon priority={data.priority} />
                <select
                  aria-label={t('issues.priority')}
                  value={data.priority.key}
                  disabled={!canEdit}
                  onChange={(event) => update.mutate({ priority: event.target.value })}
                  className={inputClass}
                >
                  {meta.data?.priorities.map((priority) => (
                    <option key={priority.id} value={priority.key}>
                      {metaName('priority', priority)}
                    </option>
                  ))}
                </select>
              </span>
            </Field>
            <Field label={t('issues.storyPoints')}>
              <InlineInput
                type="number"
                min={0}
                step={0.5}
                aria-label={t('issues.storyPoints')}
                value={data.storyPoints?.toString() ?? ''}
                disabled={!canEdit}
                onSave={(value) =>
                  update.mutate({ storyPoints: value === '' ? null : Number(value) })
                }
              />
            </Field>
            <Field label={t('issues.dueDate')}>
              <InlineInput
                type="date"
                aria-label={t('issues.dueDate')}
                value={data.dueDate ?? ''}
                disabled={!canEdit}
                onSave={(value) => update.mutate({ dueDate: value || null })}
              />
            </Field>
            <Field label={t('issues.labels')}>
              <InlineInput
                aria-label={t('issues.labels')}
                value={data.labels.join(' ')}
                disabled={!canEdit}
                onSave={(value) => update.mutate({ labels: value.split(/\s+/).filter(Boolean) })}
              />
            </Field>
            <Field label={t('issues.components')}>
              <ComponentsField
                projectKey={data.project.key}
                value={data.components}
                disabled={!canEdit}
                onChange={(components) => update.mutate({ components })}
              />
            </Field>
            {data.issueType.hierarchyLevel < 1 && (
              <Field label={t('issues.parent')}>
                <InlineInput
                  aria-label={t('issues.parent')}
                  value={data.parent?.key ?? ''}
                  placeholder={t('issues.parentPlaceholder')}
                  disabled={!canEdit}
                  onSave={(value) =>
                    update.mutate({ parentKey: value.trim() ? value.trim().toUpperCase() : null })
                  }
                  className="tl-key"
                />
              </Field>
            )}
            {data.resolution && (
              <Field label={t('issues.resolution')}>
                <span className="block px-1.5 pt-1">{metaName('resolution', data.resolution)}</span>
              </Field>
            )}
          </dl>
          <p className="m-0 text-xs text-[var(--ink-muted)]">
            {t('issues.created', { date: formatDateTime(data.createdAt) })} ·{' '}
            {t('issues.updated', { date: formatRelative(data.updatedAt) })}
            {data.dueDate && ` · ${t('issues.dueDate')} ${formatDate(data.dueDate)}`}
          </p>
        </aside>
      </div>

      <UserPicker
        open={pickingAssignee}
        onOpenChange={setPickingAssignee}
        me={{ id: me.id, displayName: me.displayName }}
        projectKey={data.project.key}
        onPick={(user) => update.mutate({ assigneeId: user?.id ?? null })}
      />
    </main>
  );
}
