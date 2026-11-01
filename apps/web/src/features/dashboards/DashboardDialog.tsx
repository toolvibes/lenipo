import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  DASHBOARD_LAYOUTS,
  type Dashboard,
  type DashboardLayout,
  type FilterShareInput,
} from '@toolvibes/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { projectsQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';

type Visibility = 'private' | 'authenticated' | 'project';

/** Creates a dashboard, or changes name, layout and who sees it. */
export function DashboardDialog({
  open,
  onOpenChange,
  editing,
  canShare,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Dashboard;
  canShare: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const projects = useQuery({ ...projectsQuery, enabled: open && canShare });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [layout, setLayout] = useState<DashboardLayout>('two');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [projectId, setProjectId] = useState('');
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setLayout(editing?.layout ?? 'two');
    const share = editing?.shares[0];
    setVisibility(
      share?.type === 'authenticated'
        ? 'authenticated'
        : share?.type === 'project'
          ? 'project'
          : 'private',
    );
    setProjectId(share?.type === 'project' ? share.project.id : '');
  }, [open, editing]);
  const save = useMutation({
    mutationFn: () => {
      const shares: FilterShareInput[] =
        visibility === 'authenticated'
          ? [{ type: 'authenticated' }]
          : visibility === 'project' && projectId
            ? [{ type: 'project', projectId }]
            : [];
      const sharing = canShare ? { shares } : {};
      return editing
        ? unwrap(
            client.PATCH('/api/v1/dashboards/{id}', {
              params: { path: { id: editing.id } },
              body: { name, description, layout, ...sharing },
            }),
          )
        : unwrap(
            client.POST('/api/v1/dashboards', { body: { name, description, layout, ...sharing } }),
          );
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(['dashboard', saved.id], saved);
      await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      await queryClient.invalidateQueries({ queryKey: ['favourites'] });
      onOpenChange(false);
      if (!editing) await navigate({ to: '/dashboards/$id', params: { id: saved.id } });
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) save.mutate();
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('dashboards.settings') : t('dashboards.create')}
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {save.error && <FormError message={save.error.message} />}
        <TextField
          label={t('dashboards.name')}
          value={name}
          required
          maxLength={100}
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label={t('dashboards.description')}
          value={description}
          maxLength={1000}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Select
          label={t('dashboards.layout')}
          value={layout}
          options={DASHBOARD_LAYOUTS.map((value) => ({
            value,
            label: t(`dashboards.layouts.${value}`),
          }))}
          onChange={(event) => setLayout(event.target.value as DashboardLayout)}
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
                onChange={(event) => setProjectId(event.target.value)}
                options={[
                  { value: '', label: '–' },
                  ...(projects.data ?? []).map((project) => ({
                    value: project.id,
                    label: `${project.name} (${project.key})`,
                  })),
                ]}
              />
            )}
            <p className="m-0 text-xs text-[var(--ink-muted)]">{t('dashboards.shareHint')}</p>
          </>
        ) : (
          <p className="m-0 text-xs text-[var(--ink-muted)]">{t('search.dialog.noSharing')}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || save.isPending}>
            {editing ? t('common.save') : t('dashboards.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
