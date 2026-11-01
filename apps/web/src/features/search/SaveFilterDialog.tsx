import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FilterShareInput, SavedFilter } from '@toolvibes/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, client, unwrap } from '../../lib/api';
import { projectsQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';

type Visibility = 'private' | 'authenticated' | 'project';

function visibilityOf(filter: SavedFilter | undefined): {
  visibility: Visibility;
  projectId: string;
} {
  const share = filter?.shares[0];
  if (share?.type === 'authenticated') return { visibility: 'authenticated', projectId: '' };
  if (share?.type === 'project') return { visibility: 'project', projectId: share.project.id };
  return { visibility: 'private', projectId: '' };
}

interface SaveFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The query to save; ignored when editing the details of an existing filter. */
  query: string;
  /** Edit name, description and sharing of this filter instead of creating a new one. */
  editing?: SavedFilter;
  canShare: boolean;
  onSaved: (filter: SavedFilter) => void;
}

export function SaveFilterDialog({
  open,
  onOpenChange,
  query,
  editing,
  canShare,
  onSaved,
}: SaveFilterDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const projects = useQuery({ ...projectsQuery, enabled: open && canShare });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [projectId, setProjectId] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    const current = visibilityOf(editing);
    setVisibility(current.visibility);
    setProjectId(current.projectId);
  }, [open, editing]);

  const save = useMutation({
    mutationFn: () => {
      const shares: FilterShareInput[] =
        visibility === 'authenticated'
          ? [{ type: 'authenticated' }]
          : visibility === 'project' && projectId
            ? [{ type: 'project', projectId }]
            : [];
      // Without the permission, sharing stays as it is.
      const sharing = canShare ? { shares } : {};
      return editing
        ? unwrap(
            client.PATCH('/api/v1/filters/{id}', {
              params: { path: { id: editing.id } },
              body: { name, description, ...sharing },
            }),
          )
        : unwrap(
            client.POST('/api/v1/filters', {
              body: { name, description, query, favourite: true, ...sharing },
            }),
          );
    },
    onSuccess: async (filter) => {
      await queryClient.invalidateQueries({ queryKey: ['filters'] });
      queryClient.setQueryData(['filter', filter.id], filter);
      onOpenChange(false);
      onSaved(filter);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) save.mutate();
  }

  const projectOptions = (projects.data ?? []).map((project) => ({
    value: project.id,
    label: `${project.name} (${project.key})`,
  }));

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('search.dialog.editTitle') : t('search.dialog.title')}
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {save.error && (
          <FormError
            message={save.error instanceof ApiError ? save.error.message : String(save.error)}
          />
        )}
        <TextField
          label={t('search.dialog.name')}
          value={name}
          required
          maxLength={100}
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label={t('search.dialog.description')}
          value={description}
          maxLength={1000}
          onChange={(event) => setDescription(event.target.value)}
        />
        {canShare ? (
          <>
            <Select
              label={t('search.dialog.visibility')}
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as Visibility)}
              options={[
                { value: 'private', label: t('search.dialog.private') },
                { value: 'authenticated', label: t('search.dialog.authenticated') },
                { value: 'project', label: t('search.dialog.project') },
              ]}
            />
            {visibility === 'project' && (
              <Select
                label={t('search.dialog.projectLabel')}
                value={projectId}
                required
                onChange={(event) => setProjectId(event.target.value)}
                options={[{ value: '', label: '–' }, ...projectOptions]}
              />
            )}
          </>
        ) : (
          <p className="text-[var(--ink-muted)]">{t('search.dialog.noSharing')}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={save.isPending || !name.trim() || (visibility === 'project' && !projectId)}
          >
            {save.isPending ? t('search.dialog.saving') : t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
