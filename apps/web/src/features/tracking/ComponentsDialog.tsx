import { Trash } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { componentsQuery, projectUsersQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';

interface ComponentsDialogProps {
  projectKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Project administrators add and remove components (T-PRJ-06, E-40). */
export function ComponentsDialog({ projectKey, open, onOpenChange }: ComponentsDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const components = useQuery({ ...componentsQuery(projectKey), enabled: open });
  const people = useQuery({ ...projectUsersQuery(projectKey), enabled: open });
  const [name, setName] = useState('');
  const [leadId, setLeadId] = useState('');
  const [defaultAssigneeId, setDefaultAssigneeId] = useState('');

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['project', projectKey, 'components'] });
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/projects/{key}/components', {
          params: { path: { key: projectKey } },
          body: {
            name: name.trim(),
            leadId: leadId || null,
            defaultAssigneeId: defaultAssigneeId || null,
          },
        }),
      ),
    onSuccess: async () => {
      setName('');
      setLeadId('');
      setDefaultAssigneeId('');
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(
        client.DELETE('/api/v1/projects/{key}/components/{id}', {
          params: { path: { key: projectKey, id } },
        }),
      ),
    onSuccess: refresh,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) create.mutate();
  }

  const personOptions = [
    { value: '', label: t('issues.none') },
    ...(people.data ?? []).map((person) => ({ value: person.id, label: person.displayName })),
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('projects.components.title')}
      description={t('projects.components.help')}
      width={640}
    >
      <div className="flex flex-col gap-4">
        {(create.error ?? remove.error) && (
          <FormError message={(create.error ?? remove.error)?.message ?? ''} />
        )}
        {components.data?.length === 0 && (
          <p className="text-[var(--ink-muted)]">{t('projects.components.empty')}</p>
        )}
        {components.data && components.data.length > 0 && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="tl-label text-left uppercase text-[var(--ink-muted)]">
                <th className="border-b border-[var(--border)] py-1.5 pr-2">
                  {t('projects.components.name')}
                </th>
                <th className="border-b border-[var(--border)] py-1.5 pr-2">
                  {t('projects.components.lead')}
                </th>
                <th className="border-b border-[var(--border)] py-1.5 pr-2">
                  {t('projects.components.defaultAssignee')}
                </th>
                <th className="border-b border-[var(--border)] py-1.5 pr-2 text-right">
                  {t('projects.components.issues')}
                </th>
                <th className="w-9 border-b border-[var(--border)]">
                  <span className="sr-only">{t('projects.components.delete')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {components.data.map((component) => (
                <tr key={component.id}>
                  <td className="border-b border-[var(--border)] py-1.5 pr-2 font-semibold">
                    {component.name}
                  </td>
                  <td className="border-b border-[var(--border)] py-1.5 pr-2">
                    {component.lead?.displayName ?? t('issues.none')}
                  </td>
                  <td className="border-b border-[var(--border)] py-1.5 pr-2">
                    {component.defaultAssignee?.displayName ?? t('issues.none')}
                  </td>
                  <td className="border-b border-[var(--border)] py-1.5 pr-2 text-right">
                    {component.issueCount}
                  </td>
                  <td className="border-b border-[var(--border)] py-1.5 text-right">
                    <button
                      type="button"
                      aria-label={t('projects.components.deleteNamed', { name: component.name })}
                      title={t('projects.components.deleteNamed', { name: component.name })}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(component.id)}
                      className="grid size-8 place-items-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
                    >
                      <Trash size={16} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form
          onSubmit={submit}
          className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] p-3"
        >
          <h3 className="tl-label uppercase text-[var(--ink-muted)]">
            {t('projects.components.add')}
          </h3>
          <TextField
            label={t('projects.components.name')}
            value={name}
            maxLength={100}
            required
            onChange={(event) => setName(event.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label={t('projects.components.lead')}
              value={leadId}
              onChange={(event) => setLeadId(event.target.value)}
              options={personOptions}
            />
            <Select
              label={t('projects.components.defaultAssignee')}
              value={defaultAssigneeId}
              onChange={(event) => setDefaultAssigneeId(event.target.value)}
              options={personOptions}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={create.isPending || !name.trim()}>
              {t('projects.components.add')}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
