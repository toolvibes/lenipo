import { CheckCircle, XCircle } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BulkAction, BulkResult } from '@toolvibes/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { meQuery } from '../../lib/queries';
import { projectsQuery, trackingMetaQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { useMetaName } from '../tracking/icons';

type Kind = 'edit' | 'transition' | 'move' | 'delete' | 'watch' | 'unwatch';

/** One change for the ticked issues (T-ISS-11, TL-16, E-97); each issue reports back. */
export function BulkChangeDialog({
  issueKeys,
  open,
  onOpenChange,
  onDone,
}: {
  issueKeys: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const metaName = useMetaName();
  const queryClient = useQueryClient();
  const meta = useQuery(trackingMetaQuery).data;
  const me = useQuery(meQuery).data;
  const [kind, setKind] = useState<Kind>('edit');
  const [assignee, setAssignee] = useState<'keep' | 'me' | 'nobody'>('keep');
  const [priority, setPriority] = useState('');
  const [addLabels, setAddLabels] = useState('');
  const [removeLabels, setRemoveLabels] = useState('');
  const [statusId, setStatusId] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const projects = useQuery({ ...projectsQuery, enabled: open && kind === 'move' });
  const [result, setResult] = useState<BulkResult | null>(null);
  const words = (text: string) => text.split(/\s+/).filter(Boolean);
  const action = (): BulkAction => {
    switch (kind) {
      case 'edit':
        return {
          type: 'edit',
          ...(assignee === 'keep'
            ? {}
            : { assigneeId: assignee === 'me' ? (me?.id ?? null) : null }),
          ...(priority ? { priority } : {}),
          addLabels: words(addLabels),
          removeLabels: words(removeLabels),
        };
      case 'transition':
        return { type: 'transition', statusId };
      case 'move':
        return { type: 'move', projectKey };
      default:
        return { type: kind };
    }
  };
  const run = useMutation({
    mutationFn: () =>
      unwrap(client.POST('/api/v1/issues/bulk', { body: { issueKeys, action: action() } })),
    onSuccess: (next) => {
      setResult(next);
      void queryClient.invalidateQueries({ queryKey: ['search'] });
      void queryClient.invalidateQueries({ queryKey: ['issue'] });
      onDone();
    },
  });
  const close = (next: boolean) => {
    if (!next) setResult(null);
    onOpenChange(next);
  };
  const ready = (kind !== 'transition' || !!statusId) && (kind !== 'move' || !!projectKey);
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={t('bulk.title', { count: issueKeys.length })}
      width={520}
    >
      {result ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[13.5px]">
            {t('bulk.summary', {
              ok: result.results.filter((entry) => entry.ok).length,
              failed: result.results.filter((entry) => !entry.ok).length,
            })}
          </p>
          <ul className="m-0 flex max-h-72 list-none flex-col gap-1 overflow-y-auto p-0">
            {result.results.map((entry) => (
              <li key={entry.key} className="flex items-start gap-2 text-[13px]">
                {entry.ok ? (
                  <CheckCircle size={16} className="mt-0.5 text-[var(--success)]" aria-hidden />
                ) : (
                  <XCircle size={16} className="mt-0.5 text-[var(--danger)]" aria-hidden />
                )}
                <span className="tl-key">{entry.key}</span>
                {entry.error && <span className="text-[var(--ink-muted)]">{entry.error}</span>}
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => close(false)}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {run.error && <FormError message={run.error.message} />}
          <Select
            label={t('bulk.action')}
            value={kind}
            options={(['edit', 'transition', 'move', 'watch', 'unwatch', 'delete'] as const).map(
              (value) => ({ value, label: t(`bulk.actions.${value}`) }),
            )}
            onChange={(event) => setKind(event.target.value as Kind)}
          />
          {kind === 'edit' && (
            <>
              <Select
                label={t('issues.assignee')}
                value={assignee}
                options={[
                  { value: 'keep', label: t('bulk.keep') },
                  { value: 'me', label: t('issues.assignToMe') },
                  { value: 'nobody', label: t('issues.unassigned') },
                ]}
                onChange={(event) => setAssignee(event.target.value as typeof assignee)}
              />
              <Select
                label={t('issues.priority')}
                value={priority}
                options={[
                  { value: '', label: t('bulk.keep') },
                  ...(meta?.priorities ?? []).map((entry) => ({
                    value: entry.key,
                    label: metaName('priority', entry),
                  })),
                ]}
                onChange={(event) => setPriority(event.target.value)}
              />
              <TextField
                label={t('bulk.addLabels')}
                value={addLabels}
                onChange={(event) => setAddLabels(event.target.value)}
              />
              <TextField
                label={t('bulk.removeLabels')}
                value={removeLabels}
                onChange={(event) => setRemoveLabels(event.target.value)}
              />
            </>
          )}
          {kind === 'transition' && (
            <Select
              label={t('bulk.status')}
              value={statusId}
              options={[
                { value: '', label: t('workflow.choose') },
                ...(meta?.statuses ?? []).map((status) => ({
                  value: status.id,
                  label: metaName('status', status),
                })),
              ]}
              onChange={(event) => setStatusId(event.target.value)}
            />
          )}
          {kind === 'move' && (
            <>
              <Select
                label={t('move.project')}
                value={projectKey}
                options={[
                  { value: '', label: t('move.chooseProject') },
                  ...(projects.data ?? []).map((project) => ({
                    value: project.key,
                    label: `${project.name} (${project.key})`,
                  })),
                ]}
                onChange={(event) => setProjectKey(event.target.value)}
              />
              <p className="m-0 text-xs text-[var(--ink-muted)]">{t('move.hint')}</p>
            </>
          )}
          {kind === 'delete' && (
            <p className="m-0 text-[13px] text-[var(--danger)]">{t('bulk.deleteHint')}</p>
          )}
          <p className="m-0 text-xs text-[var(--ink-muted)]">{t('bulk.hint')}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => close(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={kind === 'delete' ? 'danger' : 'primary'}
              disabled={!ready || run.isPending}
              onClick={() => run.mutate()}
            >
              {t('bulk.run', { count: issueKeys.length })}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
