import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CreateSpaceRequest, type Space } from '@toolvibes/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, client, unwrap } from '../../lib/api';
import { projectsQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';

/** Suggests a key from the name: initials of several words, else the first letters. */
export function suggestKey(name: string): string {
  // Hyphens, slashes and the like separate words just as spaces do ("Web-Relaunch" → WR).
  const words = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const key =
    words.length > 1 ? words.map((word) => word[0]).join('') : (words[0] ?? '').slice(0, 4);
  return key
    .toUpperCase()
    .replace(/^[0-9]+/, '')
    .slice(0, 10);
}

/** Creates a space in the wiki, with the project and the space linked right away (TL-83). */
export function createSpace(request: CreateSpaceRequest): Promise<Space> {
  return unwrap(client.POST('/api/v1/spaces', { body: request }));
}

/**
 * Dialog for a new wiki space. Opened from a project, it is filled in for that project (its name,
 * its key, linked with it); render it only while open, so it starts fresh each time.
 */
export function CreateSpaceDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: { key: string; name: string };
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState(project?.name ?? '');
  const [key, setKey] = useState(project?.key ?? '');
  const [keyTouched, setKeyTouched] = useState(Boolean(project));
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'team' | 'project' | 'documentation'>(
    project ? 'project' : 'team',
  );
  // General (no project) or a project's space (TL-83); linking needs administer on it.
  const [projectKey, setProjectKey] = useState(project?.key ?? '');
  const projects = useQuery({ ...projectsQuery, enabled: open });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: createSpace,
    onSuccess: async (space) => {
      await queryClient.invalidateQueries({ queryKey: ['spaces'] });
      if (space.project) {
        await queryClient.invalidateQueries({
          queryKey: ['project', space.project.key, 'spaces'],
        });
      }
      onOpenChange(false);
      await navigate({ to: '/spaces/$key', params: { key: space.key } });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = CreateSpaceRequest.safeParse({
      key,
      name,
      description,
      type,
      ...(projectKey ? { projectKey } : {}),
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('wiki.createSpace')}>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {create.error && (
          <FormError
            message={create.error instanceof ApiError ? create.error.message : String(create.error)}
          />
        )}
        <TextField
          label={t('wiki.spaceName')}
          value={name}
          error={errors.name}
          autoFocus
          onChange={(event) => {
            setName(event.target.value);
            if (!keyTouched) setKey(suggestKey(event.target.value));
          }}
        />
        <TextField
          label={t('wiki.spaceKey')}
          help={t('wiki.spaceKeyHelp')}
          error={errors.key}
          value={key}
          className="font-[family-name:var(--font-mono)] uppercase placeholder:normal-case"
          onChange={(event) => {
            setKeyTouched(true);
            setKey(event.target.value.toUpperCase());
          }}
        />
        <Select
          label={t('wikiHome.belongsTo')}
          help={t('wikiHome.belongsHelp')}
          value={projectKey}
          options={[
            { value: '', label: t('wikiHome.general') },
            // The project a dialog was opened for is offered even before the list has loaded.
            ...(project && !projects.data?.some((entry) => entry.key === project.key)
              ? [project]
              : []
            ).map((entry) => ({ value: entry.key, label: `${entry.name} (${entry.key})` })),
            ...(projects.data ?? []).map((entry) => ({
              value: entry.key,
              label: `${entry.name} (${entry.key})`,
            })),
          ]}
          onChange={(event) => setProjectKey(event.target.value)}
        />
        <Select
          label={t('spaceTypes.label')}
          value={type}
          options={(['team', 'project', 'documentation'] as const).map((value) => ({
            value,
            label: t(`spaceTypes.${value}`),
          }))}
          onChange={(event) => setType(event.target.value as typeof type)}
        />
        <TextField
          label={t('wiki.spaceDescription')}
          value={description}
          error={errors.description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {t('wiki.createSpace')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
