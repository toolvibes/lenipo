import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CustomFieldValue,
  IssueSummary,
  Transition,
  UpdateIssueRequest,
  UserRef,
} from '@tasklore/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { meQuery } from '../../lib/queries';
import { trackingMetaQuery, transitionsQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';
import { FieldEditor } from './CustomFields';
import { inputClass } from './fields';
import { useMetaName } from './icons';
import { Avatar, UserPicker } from './UserPicker';

/** What a move sends besides the transition: fields set with it and a comment (TL-85). */
export interface TransitionExtras {
  fields?: UpdateIssueRequest;
  comment?: { markdown: string };
}

/** Whether a field the move needs is still empty, as far as the list data tells. */
function isEmpty(issue: IssueSummary, field: string): boolean {
  switch (field) {
    case 'assignee':
      return !issue.assignee;
    case 'description':
      return 'description' in issue && issue.description === null;
    case 'dueDate':
    case 'startDate':
    case 'storyPoints':
      return issue[field] === null;
    case 'labels':
    case 'components':
    case 'fixVersions':
      return issue[field].length === 0;
    default: {
      const value = issue.customFields[field];
      return value === undefined || value === null || (Array.isArray(value) && value.length === 0);
    }
  }
}

/**
 * A move asks first when its rule says so, wants a comment or needs a field that is still empty
 * (TL-85, E-127).
 */
export function needsScreen(transition: Transition, issue: IssueSummary): boolean {
  return (
    transition.screen ||
    transition.comment === 'required' ||
    transition.requiredFields.some((field) => isEmpty(issue, field))
  );
}

/**
 * Moves through the dialog where the transition asks for it. `ask` resolves true when the dialog
 * took over; otherwise the caller moves at once as before.
 */
export function useTransitionScreen(
  move: (issue: IssueSummary, transitionId: string, extras: TransitionExtras) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<{ issue: IssueSummary; transition: Transition } | null>(
    null,
  );
  async function ask(
    issue: IssueSummary,
    pick: (transitions: Transition[]) => Transition | undefined,
  ): Promise<boolean> {
    const transitions = await queryClient
      .fetchQuery(transitionsQuery(issue.key))
      .catch(() => [] as Transition[]);
    const transition = pick(transitions);
    if (!transition || !needsScreen(transition, issue)) return false;
    setPending({ issue, transition });
    return true;
  }
  const dialog = pending && (
    <TransitionDialog
      key={`${pending.issue.key}:${pending.transition.id}`}
      issue={pending.issue}
      transition={pending.transition}
      onOpenChange={(open) => !open && setPending(null)}
      onSubmit={(extras) => move(pending.issue, pending.transition.id, extras)}
    />
  );
  return { ask, dialog };
}

const list = (text: string) =>
  text
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

/**
 * The small form of a transition: the fields its rule needs, filled with the issue's values,
 * and the comment. Only changed fields are sent; the move and the changes happen together or
 * not at all.
 */
export function TransitionDialog({
  issue,
  transition,
  onOpenChange,
  onSubmit,
}: {
  issue: IssueSummary;
  /** The move to ask for; null closes the dialog. */
  transition: Transition | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (extras: TransitionExtras) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const metaName = useMetaName();
  const me = useQuery(meQuery).data;
  const customFields = useQuery(trackingMetaQuery).data?.customFields ?? [];
  const [fields, setFields] = useState<UpdateIssueRequest>({});
  const [shown, setShown] = useState<Record<string, CustomFieldValue | null>>({});
  const [assignee, setAssignee] = useState<UserRef | null>(issue.assignee);
  const [picking, setPicking] = useState(false);
  const [comment, setComment] = useState('');
  const send = useMutation({
    mutationFn: () =>
      onSubmit({
        ...(Object.keys(fields).length > 0 ? { fields } : {}),
        ...(comment.trim() ? { comment: { markdown: comment } } : {}),
      }),
    onSuccess: () => close(false),
  });

  function close(open: boolean) {
    if (open) return;
    setFields({});
    setShown({});
    setComment('');
    send.reset();
    onOpenChange(false);
  }

  const set = (patch: UpdateIssueRequest) => setFields((previous) => ({ ...previous, ...patch }));
  if (!transition) return null;
  const commentRequired = transition.comment === 'required';
  const value = <K extends keyof UpdateIssueRequest>(key: K, current: string) =>
    key in fields ? String(fields[key] ?? '') : current;

  function field(id: string) {
    switch (id) {
      case 'assignee':
        return (
          <div key={id} className="flex flex-col gap-1">
            <span className="tl-field-label">{t('issues.assignee')}</span>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className={`${inputClass} flex items-center gap-2 text-left`}
            >
              {assignee ? (
                <>
                  <Avatar user={assignee} size={20} />
                  {assignee.displayName}
                </>
              ) : (
                <span className="text-[var(--ink-muted)]">{t('issues.unassigned')}</span>
              )}
            </button>
            {me && (
              <UserPicker
                open={picking}
                onOpenChange={setPicking}
                me={me}
                projectKey={issue.project.key}
                onPick={(user) => {
                  setAssignee(user);
                  set({ assigneeId: user?.id ?? null });
                }}
              />
            )}
          </div>
        );
      case 'description':
        return (
          <label key={id} className="flex flex-col gap-1">
            <span className="tl-field-label">{t('workflow.fields.description')}</span>
            <textarea
              rows={3}
              value={(fields.description as { markdown?: string } | undefined)?.markdown ?? ''}
              placeholder={t('transitionScreen.keepEmpty')}
              onChange={(event) =>
                set({ description: event.target.value ? { markdown: event.target.value } : null })
              }
              className={`${inputClass} !h-auto resize-y py-1`}
            />
          </label>
        );
      case 'dueDate':
      case 'startDate':
        return (
          <TextField
            key={id}
            type="date"
            label={t(`workflow.fields.${id}`)}
            value={value(id, issue[id] ?? '')}
            onChange={(event) => set({ [id]: event.target.value || null })}
          />
        );
      case 'storyPoints':
        return (
          <TextField
            key={id}
            type="number"
            min={0}
            step="any"
            label={t('workflow.fields.storyPoints')}
            value={value(id, issue.storyPoints === null ? '' : String(issue.storyPoints))}
            onChange={(event) =>
              set({ storyPoints: event.target.value === '' ? null : Number(event.target.value) })
            }
          />
        );
      case 'labels':
      case 'components':
      case 'fixVersions': {
        const current =
          id === 'labels'
            ? issue.labels
            : (id === 'components' ? issue.components : issue.fixVersions).map(
                (entry) => entry.name,
              );
        return (
          <TextField
            key={id}
            label={t(`workflow.fields.${id}`)}
            help={t('transitionScreen.commaList')}
            value={
              id in fields
                ? ((fields[id] as string[] | undefined) ?? []).join(', ')
                : current.join(', ')
            }
            onChange={(event) => set({ [id]: list(event.target.value) })}
          />
        );
      }
      default: {
        const custom = customFields.find((entry) => entry.id === id);
        if (!custom) return null;
        return (
          <div key={id} className="flex flex-col gap-1">
            <span className="tl-field-label">{custom.name}</span>
            <FieldEditor
              field={custom}
              value={id in shown ? (shown[id] ?? undefined) : issue.customFields[id]}
              projectKey={issue.project.key}
              disabled={false}
              onChange={(input, display) => {
                setShown((previous) => ({ ...previous, [id]: display ?? null }));
                set({ customFields: { ...fields.customFields, [id]: input } });
              }}
            />
          </div>
        );
      }
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    send.mutate();
  }

  return (
    <Dialog
      open
      onOpenChange={close}
      title={t('transitionScreen.title', {
        key: issue.key,
        status: metaName('status', transition.to),
      })}
      width={480}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {send.error && <FormError message={send.error.message} />}
        {transition.requiredFields.map(field)}
        {transition.comment !== 'none' && (
          <label className="flex flex-col gap-1">
            <span className="tl-field-label">
              {commentRequired
                ? t('transitionScreen.commentRequired')
                : t('transitionScreen.comment')}
            </span>
            <textarea
              rows={4}
              value={comment}
              required={commentRequired}
              onChange={(event) => setComment(event.target.value)}
              className={`${inputClass} !h-auto resize-y py-1`}
            />
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => close(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={send.isPending || (commentRequired && !comment.trim())}
          >
            {t('transitionScreen.run')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
