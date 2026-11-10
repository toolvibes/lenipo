import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CreateProjectRequest, PROJECT_TEMPLATES, type ProjectTemplate } from '@toolvibes/shared';
import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, client, unwrap } from '../../lib/api';
import { useModules } from '../../lib/instance';
import { meQuery } from '../../lib/queries';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { createSpace, suggestKey } from '../wiki/CreateSpaceDialog';

export function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [template, setTemplate] = useState<ProjectTemplate>('scrum');
  const [errors, setErrors] = useState<Record<string, string>>({});
  // A wiki space for the project in the same step, if the person may create spaces.
  const me = useQuery(meQuery);
  const modules = useModules();
  const canWiki = modules.wiki && (me.data?.globalPermissions.includes('create-spaces') ?? false);
  const [withWiki, setWithWiki] = useState(true);
  const wikiHelpId = useId();
  /** The project exists but its space failed (e.g. the key is taken): say so, then go on. */
  const [created, setCreated] = useState<{ key: string; wikiError: string } | null>(null);

  async function openProject(key: string) {
    onOpenChange(false);
    await navigate({ to: '/projects/$key', params: { key } });
  }

  const create = useMutation({
    mutationFn: (request: CreateProjectRequest) =>
      unwrap(client.POST('/api/v1/projects', { body: request })),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (canWiki && withWiki) {
        try {
          await createSpace({
            key: project.key,
            name: project.name,
            description: '',
            type: 'project',
            projectKey: project.key,
          });
          await queryClient.invalidateQueries({ queryKey: ['spaces'] });
          await queryClient.invalidateQueries({ queryKey: ['project', project.key, 'spaces'] });
        } catch (error) {
          setCreated({
            key: project.key,
            wikiError: error instanceof ApiError ? error.message : String(error),
          });
          return;
        }
      }
      await openProject(project.key);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = CreateProjectRequest.safeParse({ key, name, template });
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

  if (created) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} title={t('projects.create')}>
        <div className="flex flex-col gap-4">
          <FormError message={t('projects.wikiFailed', { message: created.wikiError })} />
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => openProject(created.key)}>
              {t('projects.openProject')}
            </Button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('projects.create')}>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {create.error && (
          <FormError
            message={create.error instanceof ApiError ? create.error.message : String(create.error)}
          />
        )}
        <TextField
          label={t('projects.name')}
          value={name}
          error={errors.name}
          autoFocus
          onChange={(event) => {
            setName(event.target.value);
            if (!keyTouched) setKey(suggestKey(event.target.value));
          }}
        />
        <TextField
          label={t('projects.key')}
          help={t('projects.keyHelp')}
          error={errors.key}
          value={key}
          className="font-[family-name:var(--font-mono)] uppercase placeholder:normal-case"
          onChange={(event) => {
            setKeyTouched(true);
            setKey(event.target.value.toUpperCase());
          }}
        />
        <Select
          label={t('projects.template')}
          value={template}
          onChange={(event) => setTemplate(event.target.value as ProjectTemplate)}
          options={PROJECT_TEMPLATES.map((value) => ({
            value,
            label: t(`projects.templates.${value}`),
          }))}
        />
        {canWiki && (
          <label className="flex items-start gap-2.5 text-[13.5px]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={withWiki}
              onChange={(event) => setWithWiki(event.target.checked)}
              aria-describedby={wikiHelpId}
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold text-[var(--ink)]">{t('projects.withWiki')}</span>
              <span id={wikiHelpId} className="text-xs text-[var(--ink-muted)]">
                {t('projects.withWikiHelp')}
              </span>
            </span>
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? t('projects.creating') : t('projects.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
