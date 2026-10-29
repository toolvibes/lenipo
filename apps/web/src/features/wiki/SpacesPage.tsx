import { BookOpenText, Plus } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { CreateSpaceRequest, type Me } from '@tasklore/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, client, unwrap } from '../../lib/api';
import { spacesQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';

/** Suggests a key from the name: initials of several words, else the first letters. */
function suggestKey(name: string): string {
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

function CreateSpaceDialog({
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
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: (request: CreateSpaceRequest) =>
      unwrap(client.POST('/api/v1/spaces', { body: request })),
    onSuccess: async (space) => {
      await queryClient.invalidateQueries({ queryKey: ['spaces'] });
      onOpenChange(false);
      await navigate({ to: '/spaces/$key', params: { key: space.key } });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = CreateSpaceRequest.safeParse({ key, name, description });
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

/** The space directory (W-SPC-08). */
export function SpacesPage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const spaces = useQuery(spacesQuery);
  const [creating, setCreating] = useState(false);
  const canCreate = me.globalPermissions.includes('create-spaces');

  return (
    <main className="flex flex-col gap-5 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="tl-heading-xl">{t('wiki.spaces')}</h1>
        {canCreate && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden />
            {t('wiki.createSpace')}
          </Button>
        )}
      </header>
      {spaces.data?.length === 0 && (
        <p className="max-w-xl text-[var(--ink-muted)]">{t('wiki.noSpaces')}</p>
      )}
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 p-0">
        {spaces.data?.map((space) => (
          <li key={space.id}>
            <Link
              to="/spaces/$key"
              params={{ key: space.key }}
              className="flex h-full flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-4 text-[var(--ink)] no-underline hover:border-[var(--border-strong)]"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
                  <BookOpenText size={18} aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <strong className="truncate font-semibold">{space.name}</strong>
                  <span className="tl-key text-[var(--ink-muted)]">{space.key}</span>
                </div>
              </div>
              {space.description && (
                <span className="line-clamp-2 text-sm text-[var(--ink-muted)]">
                  {space.description}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <CreateSpaceDialog open={creating} onOpenChange={setCreating} />
    </main>
  );
}
