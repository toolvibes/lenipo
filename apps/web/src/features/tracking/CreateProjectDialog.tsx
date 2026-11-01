import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CreateProjectRequest, PROJECT_TEMPLATES, type ProjectTemplate } from '@toolvibes/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, client, unwrap } from '../../lib/api';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';

/** Suggests a key from the name: initials of several words, else the first letters. */
function suggestKey(name: string): string {
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

  const create = useMutation({
    mutationFn: (request: CreateProjectRequest) =>
      unwrap(client.POST('/api/v1/projects', { body: request })),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      onOpenChange(false);
      await navigate({ to: '/projects/$key', params: { key: project.key } });
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
