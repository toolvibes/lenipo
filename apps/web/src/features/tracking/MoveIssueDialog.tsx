import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { Issue } from '@toolvibes/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { projectQuery, projectsQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { useMetaName } from './icons';

/**
 * Moves an issue with its subtasks to another project (T-ISS-10, TL-86, E-99). Type and status
 * follow the proposal unless chosen here; the old key keeps working.
 */
export function MoveIssueDialog({
  issue,
  open,
  onOpenChange,
}: {
  issue: Issue;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const metaName = useMetaName();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const projects = useQuery({ ...projectsQuery, enabled: open });
  const [projectKey, setProjectKey] = useState('');
  const target = useQuery({ ...projectQuery(projectKey), enabled: open && !!projectKey });
  const [issueType, setIssueType] = useState('');
  const [statusId, setStatusId] = useState('');
  const move = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/issues/{key}/move', {
          params: { path: { key: issue.key } },
          body: {
            projectKey,
            ...(issueType ? { issueType } : {}),
            ...(statusId ? { statusId } : {}),
          },
        }),
      ),
    onSuccess: async (moved) => {
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ['issue'] });
      await navigate({ to: '/issues/$key', params: { key: moved.key } });
    },
  });
  const types = (target.data?.issueTypes ?? []).filter(
    (type) => type.hierarchyLevel === issue.issueType.hierarchyLevel,
  );
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('move.title', { key: issue.key })}
      description={t('move.intro')}
      width={480}
    >
      <div className="flex flex-col gap-4">
        {move.error && <FormError message={move.error.message} />}
        <Select
          label={t('move.project')}
          value={projectKey}
          options={[
            { value: '', label: t('move.chooseProject') },
            ...(projects.data ?? [])
              .filter((project) => project.key !== issue.project.key)
              .map((project) => ({
                value: project.key,
                label: `${project.name} (${project.key})`,
              })),
          ]}
          onChange={(event) => {
            setProjectKey(event.target.value);
            setIssueType('');
            setStatusId('');
          }}
        />
        {target.data && (
          <>
            <Select
              label={t('move.type')}
              value={issueType}
              options={[
                {
                  value: '',
                  label: t('move.keepType', { type: metaName('issueType', issue.issueType) }),
                },
                ...types.map((type) => ({ value: type.key, label: metaName('issueType', type) })),
              ]}
              onChange={(event) => setIssueType(event.target.value)}
            />
            <Select
              label={t('move.status')}
              value={statusId}
              options={[
                { value: '', label: t('move.proposedStatus') },
                ...target.data.statuses.map((status) => ({
                  value: status.id,
                  label: metaName('status', status),
                })),
              ]}
              onChange={(event) => setStatusId(event.target.value)}
            />
          </>
        )}
        <p className="m-0 text-xs text-[var(--ink-muted)]">{t('move.hint')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!projectKey || move.isPending}
            onClick={() => move.mutate()}
          >
            {t('move.run')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
