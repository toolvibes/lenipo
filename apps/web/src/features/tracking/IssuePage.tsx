import { ArrowsOut, Check, Eye, EyeSlash, LinkSimple, Lock, X } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Comment, Issue, Me, RichText, UpdateIssueRequest } from '@tasklore/shared';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, client, unwrap } from '../../lib/api';
import { formatDateTime, formatRelative } from '../../lib/format';
import { useRecordView } from '../../lib/personal';
import { useRealtimeRooms } from '../../lib/realtime';
import { useCurrentProject, useShortcuts } from '../../lib/shortcuts';
import {
  commentsQuery,
  historyQuery,
  issueQuery,
  projectQuery,
  trackingMetaQuery,
} from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TopBar } from '../../ui/TopBar';
import { Attachments } from './Attachments';
import { ComponentsField } from './ComponentsField';
import { CustomFieldRows } from './CustomFields';
import { useFieldLabel } from './fieldLabel';
import { InlineInput, inputClass, StatusMenu } from './fields';
import { IssueLinks } from './IssueLinks';
import { IssueWikiPages } from './IssueWikiPages';
import { IssueTypeIcon, PriorityIcon, StatusLozenge, useMetaName } from './icons';
import { RichTextEditor, RichTextView, storedDoc } from './RichTextEditor';
import { LogWorkDialog, TimeTrackingPanel, WorklogList } from './TimeTracking';
import { Avatar, UserPicker } from './UserPicker';
import { VersionsField } from './VersionsField';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="pt-1.5 text-[13px] text-[var(--ink-muted)]">{label}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </>
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
            initial={storedDoc(comment.body)}
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
            <RichTextView doc={storedDoc(comment.body)} />
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
  const [tab, setTab] = useState<'comments' | 'worklogs' | 'history'>('comments');
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

  const label = useFieldLabel();
  const fieldName = label.name;
  const shown = label.value;

  const tabButton = (value: typeof tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === value}
      onClick={() => setTab(value)}
      className={`-mb-px border-0 border-b-2 bg-transparent px-0 pb-2 text-[13px] ${tab === value ? 'border-[var(--ink)] font-semibold text-[var(--ink)]' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]'}`}
    >
      {label}
    </button>
  );

  return (
    <section aria-label={t('issues.activity')} className="flex flex-col gap-3">
      <div role="tablist" className="flex gap-[18px] border-b border-[var(--border)]">
        {tabButton(
          'comments',
          `${t('issues.comments')}${comments.data ? ` · ${comments.data.length}` : ''}`,
        )}
        {tabButton('worklogs', t('time.worklogs'))}
        {tabButton('history', t('issues.history'))}
      </div>
      {tab === 'worklogs' && <WorklogList issueKey={issueKey} />}
      {tab === 'comments' && (
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
      )}
      {tab === 'history' && (
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
                  {group.via === 'mcp' && ` · ${t('issues.viaMcp')}`}
                  {group.via === 'workflow' && ` · ${t('issues.viaWorkflow')}`}
                </span>
                {/* A change group records each field at most once. */}
                {group.items.map((item) => (
                  <span key={item.field} className="min-w-0 break-words">
                    {item.field === 'description' ? (
                      t('issues.descriptionChanged')
                    ) : (
                      <>
                        <span className="text-[var(--ink-muted)]">{fieldName(item.field)}: </span>
                        {t('issues.changedFrom', {
                          from: shown(item.field, item.from),
                          to: shown(item.field, item.to),
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

/** The panel's bar: open the full page or close the panel (E-49). */
function PanelBar({ issueKey, onClose }: { issueKey: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        to="/issues/$key"
        params={{ key: issueKey }}
        className="flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-xs text-[var(--ink-muted)] no-underline hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
      >
        <ArrowsOut size={16} aria-hidden />
        {t('issues.openFullPage')}
      </Link>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('issues.closeDetail')}
        title={t('issues.closeDetail')}
        className="grid size-8 place-items-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}

/**
 * An issue with all its fields, as a full page or as the panel beside a list (T-ISS-15).
 * In the panel, `onClose` closes it.
 */
export function IssuePage({
  me,
  issueKey,
  variant = 'page',
  onClose,
}: {
  me: Me;
  issueKey: string;
  variant?: 'page' | 'panel';
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  const metaName = useMetaName();
  const queryClient = useQueryClient();
  const issue = useQuery(issueQuery(issueKey));
  // Comments, status and fields from others appear without reloading (E-58).
  useRealtimeRooms([`issue:${issueKey}`]);
  const project = useQuery({
    ...projectQuery(issue.data?.project.key ?? ''),
    enabled: !!issue.data,
  });
  const meta = useQuery(trackingMetaQuery);
  const [editingDescription, setEditingDescription] = useState(false);
  const [pickingAssignee, setPickingAssignee] = useState(false);
  const [loggingWork, setLoggingWork] = useState(false);
  const [copied, setCopied] = useState(false);
  // Only once the issue loaded, so missing or hidden issues are not recorded.
  useRecordView('issue', issue.data?.key);

  const refresh = (updated: Issue) => {
    queryClient.setQueryData(issueQuery(issueKey).queryKey, updated);
    void queryClient.invalidateQueries({ queryKey: ['issue', issueKey, 'history'] });
    void queryClient.invalidateQueries({ queryKey: ['issue', issueKey, 'transitions'] });
    void queryClient.invalidateQueries({ queryKey: ['project-issues'] });
    void queryClient.invalidateQueries({ queryKey: ['search'] });
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

  useCurrentProject(issue.data?.project.key);
  // In the panel the list keeps the keyboard; shortcuts belong to the full page (T-VIEW-04).
  useShortcuts(
    variant === 'panel'
      ? []
      : [
          {
            keys: 'a',
            label: 'shortcuts.assign',
            group: 'issue',
            run: () => issue.data?.canAssign && setPickingAssignee(true),
          },
          {
            keys: 'i',
            label: 'shortcuts.assignMe',
            group: 'issue',
            run: () => issue.data?.canAssign && update.mutate({ assigneeId: me.id }),
          },
          {
            keys: 'w',
            label: 'shortcuts.watch',
            group: 'issue',
            run: () => issue.data && watch.mutate(!issue.data.watching),
          },
          {
            keys: 'm',
            label: 'shortcuts.comment',
            group: 'issue',
            run: () =>
              document
                .querySelector<HTMLElement>(
                  `section[aria-label="${t('issues.activity')}"] [contenteditable="true"]`,
                )
                ?.focus(),
          },
        ],
  );
  const panel = variant === 'panel' && onClose;
  const bar = panel && <PanelBar issueKey={issueKey} onClose={onClose} />;
  if (issue.error || !issue.data) {
    return (
      <div className={panel ? 'flex flex-col gap-2 p-4' : 'px-6 py-8'}>
        {bar}
        <p className="m-0 text-[var(--ink-muted)]">
          {!issue.error
            ? t('common.loading')
            : issue.error instanceof ApiError && issue.error.status === 404
              ? t('issues.notFound')
              : issue.error.message}
        </p>
      </div>
    );
  }
  const data = issue.data;
  const Root = panel ? 'section' : 'main';
  const permissions = new Set(project.data?.permissions ?? []);
  const canEdit = permissions.has('edit-issues');
  const sameLevelTypes = (project.data?.issueTypes ?? []).filter(
    (type) => type.hierarchyLevel === data.issueType.hierarchyLevel,
  );
  const error = update.error ?? transition.error;

  const copyLink = () =>
    void navigator.clipboard.writeText(`${window.location.origin}/issues/${data.key}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  const watchButton = (
    <Button
      size="sm"
      variant={panel ? 'secondary' : 'ghost'}
      onClick={() => watch.mutate(!data.watching)}
    >
      {data.watching ? <EyeSlash size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
      {data.watching ? t('issues.unwatch') : t('issues.watch')} · {data.watcherCount}
    </Button>
  );
  const statusMenu = (
    <StatusMenu
      issue={data}
      enabled={permissions.has('transition-issues')}
      onTransition={(id) => transition.mutate(id)}
      block={!panel}
    />
  );

  return (
    <Root
      aria-label={panel ? t('issues.detail', { key: data.key }) : undefined}
      className={`flex flex-col ${panel ? 'gap-4 p-4' : 'min-h-full'}`}
    >
      {bar}
      {!panel && (
        <TopBar
          crumbs={[
            <Link key="project" to="/projects/$key" params={{ key: data.project.key }}>
              {data.project.name}
            </Link>,
            ...(data.parent
              ? [
                  <Link key="parent" to="/issues/$key" params={{ key: data.parent.key }}>
                    {data.parent.summary}
                  </Link>,
                ]
              : []),
            <span key="issue" className="font-[family-name:var(--font-mono)]">
              {data.key}
            </span>,
          ]}
          actions={
            <>
              <Button size="sm" variant="ghost" onClick={copyLink}>
                {copied ? <Check size={16} aria-hidden /> : <LinkSimple size={16} aria-hidden />}
                {copied ? t('issues.linkCopied') : t('issues.copyLink')}
              </Button>
              {watchButton}
            </>
          }
        />
      )}

      <div className={panel ? 'flex flex-wrap items-start gap-6' : 'flex flex-1 flex-wrap'}>
        <div
          className={`flex min-w-0 flex-[999_1_560px] flex-col gap-6 ${panel ? '' : 'px-10 py-6'}`}
        >
          <header className="flex flex-col gap-2.5">
            <span className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-muted)]">
              <IssueTypeIcon type={data.issueType} size={14} />
              {canEdit && sameLevelTypes.length > 1 ? (
                // Only within the hierarchy level: a story can become a bug, not an epic (TL-56).
                <select
                  aria-label={t('issues.type')}
                  value={data.issueType.key}
                  onChange={(event) => update.mutate({ issueType: event.target.value })}
                  className="-ml-1 cursor-pointer rounded-[var(--radius-sm)] border-0 bg-transparent py-0.5 pr-1 pl-1 text-[12.5px] font-semibold text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                >
                  {sameLevelTypes.map((type) => (
                    <option key={type.id} value={type.key}>
                      {metaName('issueType', type)}
                    </option>
                  ))}
                </select>
              ) : (
                metaName('issueType', data.issueType)
              )}
              {panel && (
                <>
                  <span aria-hidden>·</span>
                  <span className="tl-key">{data.key}</span>
                </>
              )}
            </span>
            <InlineInput
              value={data.summary}
              disabled={!canEdit}
              aria-label={t('issues.summary')}
              onSave={(summary) => summary.trim() && update.mutate({ summary: summary.trim() })}
              className={
                panel
                  ? '-mx-1.5 tl-heading-lg !h-auto py-0.5'
                  : '-mx-1.5 !h-auto py-0.5 text-[26px] leading-[1.25] font-semibold tracking-[-0.02em]'
              }
            />
            {panel && (
              <div className="flex flex-wrap items-center gap-2">
                {statusMenu}
                {watchButton}
              </div>
            )}
          </header>
          {error && <FormError message={error.message} />}

          <section
            aria-label={t('issues.description')}
            className="flex max-w-[680px] flex-col gap-2"
          >
            <h2 className="tl-label text-[var(--ink-muted)]">{t('issues.description')}</h2>
            {editingDescription ? (
              <RichTextEditor
                initial={storedDoc(data.description)}
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
                className="-mx-3 rounded-[var(--radius-md)] border border-transparent bg-transparent px-3 py-2 text-left text-[14.5px] leading-[1.65] hover:border-[var(--border)] disabled:hover:border-transparent"
              >
                {data.description ? (
                  <RichTextView doc={storedDoc(data.description)} />
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
              <h2 className="tl-label text-[var(--ink-muted)]">
                {t('issues.children')} ·{' '}
                {data.children.filter((child) => child.status.category === 'done').length}/
                {data.children.length}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {data.children.map((child) => (
                  <li
                    key={child.id}
                    className="flex min-h-[34px] items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 text-[13.5px]"
                  >
                    <IssueTypeIcon type={child.issueType} />
                    <Link
                      to="/issues/$key"
                      params={{ key: child.key }}
                      className="tl-key no-underline hover:underline"
                    >
                      {child.key}
                    </Link>
                    <span
                      className={`min-w-0 flex-1 truncate ${child.status.category === 'done' ? 'text-[var(--ink-muted)] line-through' : ''}`}
                    >
                      {child.summary}
                    </span>
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

          <IssueWikiPages issueKey={data.key} />

          <Activity
            issueKey={data.key}
            projectKey={data.project.key}
            canComment={permissions.has('comment')}
          />
        </div>

        <aside
          className={
            panel
              ? 'flex max-w-full min-w-0 flex-[1_1_300px] flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-4'
              : 'flex max-w-full min-w-0 flex-[1_1_300px] flex-col gap-4 border-l border-[var(--border)] px-6 py-6 lg:max-w-[340px]'
          }
        >
          {!panel && statusMenu}
          <dl className="m-0 grid grid-cols-[minmax(0,96px)_minmax(0,1fr)] gap-x-3 gap-y-2">
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
            {(data.securityLevel || (project.data?.securityLevels.length ?? 0) > 0) && (
              <Field label={t('security.level')}>
                <span className="flex items-center gap-1 pl-1.5">
                  {data.securityLevel && <Lock size={14} aria-hidden />}
                  <select
                    aria-label={t('security.level')}
                    value={data.securityLevel?.id ?? ''}
                    // Subtasks follow their parent (E-94).
                    disabled={!canEdit || !permissions.has('set-issue-security') || !!data.parent}
                    onChange={(event) =>
                      update.mutate({ securityLevelId: event.target.value || null })
                    }
                    className={inputClass}
                  >
                    <option value="">{t('security.noLevel')}</option>
                    {data.securityLevel &&
                      !project.data?.securityLevels.some(
                        (l) => l.id === data.securityLevel?.id,
                      ) && <option value={data.securityLevel.id}>{data.securityLevel.name}</option>}
                    {project.data?.securityLevels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                </span>
              </Field>
            )}
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
            <Field label={t('issues.startDate')}>
              <InlineInput
                type="date"
                aria-label={t('issues.startDate')}
                value={data.startDate ?? ''}
                disabled={!canEdit}
                onSave={(value) => update.mutate({ startDate: value || null })}
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
            <Field label={t('versions.fix')}>
              <VersionsField
                projectKey={data.project.key}
                label={t('versions.fix')}
                value={data.fixVersions}
                disabled={!canEdit}
                onChange={(fixVersions) => update.mutate({ fixVersions })}
              />
            </Field>
            <Field label={t('versions.affects')}>
              <VersionsField
                projectKey={data.project.key}
                label={t('versions.affects')}
                value={data.affectsVersions}
                disabled={!canEdit}
                onChange={(affectsVersions) => update.mutate({ affectsVersions })}
              />
            </Field>
            <CustomFieldRows
              issue={data}
              fieldIds={project.data?.customFieldIds ?? []}
              settings={project.data?.customFieldSettings}
              disabled={!canEdit}
              onChange={(fieldId, value) => update.mutate({ customFields: { [fieldId]: value } })}
            />
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
            {data.sprint && (
              <Field label={t('issues.sprint')}>
                <span className="block px-1.5 pt-1">
                  {data.sprint.name}
                  {data.sprint.state === 'active' && ` · ${t('sprints.active')}`}
                </span>
              </Field>
            )}
            {data.resolution && (
              <Field label={t('issues.resolution')}>
                <span className="block px-1.5 pt-1">{metaName('resolution', data.resolution)}</span>
              </Field>
            )}
          </dl>
          <TimeTrackingPanel
            issue={data}
            canEdit={canEdit}
            onUpdate={(body) => update.mutate(body)}
            onLogWork={() => setLoggingWork(true)}
          />
          <p className="m-0 mt-auto flex flex-col text-xs leading-normal text-[var(--ink-muted)]">
            <span>
              {data.reporter
                ? t('issues.createdBy', {
                    date: formatDateTime(data.createdAt),
                    name: data.reporter.displayName,
                  })
                : t('issues.created', { date: formatDateTime(data.createdAt) })}
            </span>
            <span>{t('issues.updated', { date: formatRelative(data.updatedAt) })}</span>
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
      <LogWorkDialog issueKey={data.key} open={loggingWork} onOpenChange={setLoggingWork} />
    </Root>
  );
}
