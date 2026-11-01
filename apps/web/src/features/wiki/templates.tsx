import { PencilSimple, Trash } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { PageTemplateSummary, RichText } from '@toolvibes/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { globalTemplatesQuery, spaceTemplatesQuery, templateQuery } from '../../lib/wiki';
import { Button, buttonClass } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';
import { RichTextEditor } from '../tracking/RichTextEditor';

/** The suggested title: today's date for `{date}` / `{{date}}`, inputs as typed (TL-27). */
export function fillTitle(title: string, inputs: Record<string, string> = {}): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return title
    .replace(/\{\{\s*date\s*\}\}|\{date\}/g, today)
    .replace(/\{\{\s*input:([^}]+)\}\}/g, (_, name: string) => inputs[name.trim()] || name.trim());
}

/** Where a template is edited: in its space, or in the administration for global ones. */
function editLink(spaceKey: string | undefined, id: string, from?: string) {
  return spaceKey
    ? ({
        to: '/spaces/$key/templates/$id',
        params: { key: spaceKey, id },
        search: { from },
      } as const)
    : ({ to: '/admin/templates/$id', params: { id }, search: { from } } as const);
}

/**
 * The templates of a space (or the global ones) with the blueprints to copy from (W-TPL-01,
 * E-72). Editing needs the space administration or, for global ones, the system administration.
 */
export function TemplateList({ spaceKey, canManage }: { spaceKey?: string; canManage: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const list = useQuery(spaceKey ? spaceTemplatesQuery(spaceKey) : globalTemplatesQuery);
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(client.DELETE('/api/v1/page-templates/{id}', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });
  const own = (list.data ?? []).filter((entry) => entry.kind === (spaceKey ? 'space' : 'global'));
  const blueprints = (list.data ?? []).filter((entry) => entry.kind === 'blueprint');

  return (
    <div className="flex flex-col gap-3">
      {remove.error && <FormError message={remove.error.message} />}
      {own.length === 0 && <p className="m-0 text-[var(--ink-muted)]">{t('templates.none')}</p>}
      {own.length > 0 && (
        <ul className="m-0 list-none overflow-hidden rounded-lg border border-[var(--border)] p-0">
          {own.map((entry) => (
            <li
              key={entry.ref}
              className="flex items-center gap-3 border-b border-[var(--border)] px-3.5 py-2.5 last:border-b-0"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{entry.name}</span>
                {entry.description && (
                  <span className="truncate text-[13px] text-[var(--ink-muted)]">
                    {entry.description}
                  </span>
                )}
              </span>
              {canManage && entry.id && (
                <>
                  <Link {...editLink(spaceKey, entry.id)} className={buttonClass('ghost', 'sm')}>
                    <PencilSimple size={16} aria-hidden />
                    {t('templates.edit')}
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('templates.deleteNamed', { name: entry.name })}
                    onClick={() => entry.id && remove.mutate(entry.id)}
                  >
                    <Trash size={16} aria-hidden />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <Link {...editLink(spaceKey, 'new')} className={buttonClass('secondary', 'sm')}>
            {t('templates.create')}
          </Link>
          {blueprints.map((entry) => (
            <Link
              key={entry.ref}
              {...editLink(spaceKey, 'new', entry.ref)}
              title={t('templates.copy')}
              className={buttonClass('ghost', 'sm')}
            >
              + {entry.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Editing one template with the page editor's blocks and slash menu, saved explicitly. */
export function TemplateEditorPage({
  spaceKey,
  id,
  from,
}: {
  spaceKey?: string;
  id: string;
  /** For a new template: copy this blueprint or template. */
  from?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const creating = id === 'new';
  const source = useQuery({
    ...templateQuery(creating ? (from ?? '') : id),
    enabled: !creating || !!from,
  });
  const loaded = creating && !from ? null : source.data;
  const [fields, setFields] = useState<{ name: string; description: string; title: string } | null>(
    null,
  );
  const [saved, setSaved] = useState(false);
  const values = fields ?? {
    name: loaded && !creating ? loaded.name : (loaded?.name ?? ''),
    description: loaded?.description ?? '',
    title: loaded?.title ?? '',
  };
  const set = (patch: Partial<typeof values>) => {
    setSaved(false);
    setFields({ ...values, ...patch });
  };

  const save = useMutation({
    mutationFn: (content: RichText) => {
      const body = { ...values, name: values.name.trim(), content };
      if (!creating) {
        return unwrap(
          client.PUT('/api/v1/page-templates/{id}', { params: { path: { id } }, body }),
        );
      }
      return spaceKey
        ? unwrap(
            client.POST('/api/v1/spaces/{key}/templates', {
              params: { path: { key: spaceKey } },
              body,
            }),
          )
        : unwrap(client.POST('/api/v1/page-templates', { body }));
    },
    onSuccess: async (template) => {
      await queryClient.invalidateQueries({ queryKey: ['templates'] });
      setSaved(true);
      if (creating && template.id) {
        await navigate({ ...editLink(spaceKey, template.id), replace: true });
      }
    },
  });

  if (!creating && !source.data) return null;
  if (creating && from && !source.data) return null;
  const editable = creating || (source.data?.canEdit ?? false);

  return (
    <main className="flex max-w-[860px] flex-col gap-5 px-10 py-7">
      <h1 className="m-0 text-[22px] leading-7 font-semibold tracking-[-0.015em]">
        {creating ? t('templates.newTitle') : t('templates.editTitle')}
      </h1>
      {!editable && <p className="m-0 text-[var(--ink-muted)]">{t('templates.readOnly')}</p>}
      {save.error && <FormError message={save.error.message} />}
      <fieldset disabled={!editable} className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-2">
        <TextField
          label={t('templates.name')}
          value={values.name}
          maxLength={80}
          required
          onChange={(event) => set({ name: event.target.value })}
        />
        <TextField
          label={t('templates.pageTitle')}
          help={t('templates.pageTitleHelp')}
          value={values.title}
          maxLength={255}
          onChange={(event) => set({ title: event.target.value })}
        />
        <div className="sm:col-span-2">
          <TextField
            label={t('templates.description')}
            value={values.description}
            maxLength={300}
            onChange={(event) => set({ description: event.target.value })}
          />
        </div>
      </fieldset>
      <section aria-label={t('templates.content')} className="flex flex-col gap-2">
        <h2 className="tl-field-label m-0">{t('templates.content')}</h2>
        {editable ? (
          <RichTextEditor
            key={source.data?.ref ?? 'empty'}
            initial={loaded?.content ?? null}
            placeholder={t('editor.placeholder')}
            submitLabel={t('templates.save')}
            busy={save.isPending || !values.name.trim()}
            lore
            onSubmit={(content) => save.mutate(content)}
          />
        ) : null}
      </section>
      {saved && (
        <p role="status" className="m-0 text-[13px] text-[var(--success)]">
          {t('templates.saved')}
        </p>
      )}
    </main>
  );
}

/** The template choice in "Seite anlegen": blank page, blueprints, space and global templates. */
export function TemplateGallery({
  templates,
  value,
  onChange,
}: {
  templates: PageTemplateSummary[];
  value: string;
  onChange: (template: PageTemplateSummary | null) => void;
}) {
  const { t } = useTranslation();
  const groups = (['blueprint', 'space', 'global'] as const)
    .map((kind) => ({ kind, entries: templates.filter((entry) => entry.kind === kind) }))
    .filter((group) => group.entries.length > 0);
  const card = (checked: boolean) =>
    `flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] bg-[var(--surface-1)] px-3 py-2.5 ${
      checked ? 'border-2 border-[var(--accent)]' : 'border border-[var(--border-control)]'
    }`;
  return (
    <fieldset className="m-0 flex max-h-[46vh] flex-col gap-3 overflow-y-auto border-0 p-0">
      <legend className="tl-field-label mb-1.5 p-0">{t('templates.choose')}</legend>
      <label className={card(value === '')}>
        <input
          type="radio"
          name="template"
          checked={value === ''}
          onChange={() => onChange(null)}
          className="mt-1"
        />
        <span className="flex flex-col">
          <span className="font-medium">{t('templates.emptyPage')}</span>
          <span className="text-[13px] text-[var(--ink-muted)]">
            {t('templates.emptyDescription')}
          </span>
        </span>
      </label>
      {groups.map((group) => (
        <div key={group.kind} className="flex flex-col gap-1.5">
          <span className="tl-label text-[var(--ink-muted)]">
            {t(`templates.kinds.${group.kind}`)}
          </span>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {group.entries.map((entry) => (
              <label key={entry.ref} className={card(value === entry.ref)}>
                <input
                  type="radio"
                  name="template"
                  checked={value === entry.ref}
                  onChange={() => onChange(entry)}
                  className="mt-1"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{entry.name}</span>
                  <span className="text-[13px] leading-snug text-[var(--ink-muted)]">
                    {entry.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </fieldset>
  );
}
