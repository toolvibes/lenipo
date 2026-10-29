import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CreateIssueRequest, type ProjectDetails, type RichText } from '@tasklore/shared';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, client, unwrap } from '../../lib/api';
import { componentsQuery, trackingMetaQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { useMetaName } from './icons';

interface CreateIssueDialogProps {
  project: ProjectDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  myId: string;
  /** Shown above the fields, e.g. a project picker for "c" from anywhere. */
  header?: ReactNode;
}

export function CreateIssueDialog({
  project,
  open,
  onOpenChange,
  myId,
  header,
}: CreateIssueDialogProps) {
  const { t } = useTranslation();
  const metaName = useMetaName();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meta = useQuery(trackingMetaQuery);
  const components = useQuery({ ...componentsQuery(project.key), enabled: open });
  const [componentIds, setComponentIds] = useState<string[]>([]);
  const defaultType =
    project.issueTypes.find((type) => type.hierarchyLevel === 0) ?? project.issueTypes[0];
  const [form, setForm] = useState({
    issueType: defaultType?.key ?? '',
    summary: '',
    priority: 'medium',
    parentKey: '',
    labels: '',
    storyPoints: '',
    assignToMe: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const canAssign = project.permissions.includes('assign-issues');

  const create = useMutation({
    mutationFn: (request: CreateIssueRequest) =>
      unwrap(client.POST('/api/v1/issues', { body: request })),
    onSuccess: async (issue) => {
      await queryClient.invalidateQueries({ queryKey: ['project-issues', project.key] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      onOpenChange(false);
      setForm((previous) => ({
        ...previous,
        summary: '',
        parentKey: '',
        labels: '',
        storyPoints: '',
      }));
      setComponentIds([]);
      await navigate({ to: '/issues/$key', params: { key: issue.key } });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const description: RichText | null = null;
    const parsed = CreateIssueRequest.safeParse({
      projectKey: project.key,
      issueType: form.issueType,
      summary: form.summary,
      description,
      priority: form.priority,
      parentKey: form.parentKey.trim() ? form.parentKey.trim().toUpperCase() : null,
      labels: form.labels.split(/\s+/).filter(Boolean),
      storyPoints: form.storyPoints === '' ? null : Number(form.storyPoints),
      assigneeId: form.assignToMe ? myId : null,
      components: componentIds,
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
        ),
      );
      return;
    }
    setErrors({});
    create.mutate(parsed.data);
  }

  const set = (field: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm({ ...form, [field]: event.target.value });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('issues.create')}
      description={project.name}
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {header}
        {create.error && (
          <FormError
            message={create.error instanceof ApiError ? create.error.message : String(create.error)}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t('issues.type')}
            value={form.issueType}
            onChange={set('issueType')}
            options={project.issueTypes.map((type) => ({
              value: type.key,
              label: metaName('issueType', type),
            }))}
          />
          <Select
            label={t('issues.priority')}
            value={form.priority}
            onChange={set('priority')}
            options={(meta.data?.priorities ?? []).map((priority) => ({
              value: priority.key,
              label: metaName('priority', priority),
            }))}
          />
        </div>
        <TextField
          label={t('issues.summary')}
          value={form.summary}
          onChange={set('summary')}
          error={errors.summary}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t('issues.parent')}
            placeholder={t('issues.parentPlaceholder')}
            value={form.parentKey}
            onChange={set('parentKey')}
            className="font-[family-name:var(--font-mono)] uppercase placeholder:normal-case"
          />
          <TextField
            label={t('issues.storyPoints')}
            type="number"
            min={0}
            step={0.5}
            value={form.storyPoints}
            onChange={set('storyPoints')}
            error={errors.storyPoints}
          />
        </div>
        <TextField
          label={t('issues.labels')}
          help={t('issues.labelsHelp')}
          value={form.labels}
          onChange={set('labels')}
          error={errors.labels}
        />
        {components.data && components.data.length > 0 && (
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="tl-label mb-1 text-[var(--ink-muted)]">
              {t('issues.components')}
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {components.data.map((component) => (
                <label key={component.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={componentIds.includes(component.id)}
                    onChange={(event) =>
                      setComponentIds((current) =>
                        event.target.checked
                          ? [...current, component.id]
                          : current.filter((id) => id !== component.id),
                      )
                    }
                  />
                  {component.name}
                  {component.defaultAssignee && (
                    <span className="text-xs text-[var(--ink-muted)]">
                      → {component.defaultAssignee.displayName}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {canAssign && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.assignToMe}
              onChange={(event) => setForm({ ...form, assignToMe: event.target.checked })}
            />
            {t('issues.assignToMe')}
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? t('issues.creating') : t('issues.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
