import { Plus, Trash } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type CustomField, CustomFieldType } from '@tasklore/shared';
import { type FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { trackingMetaQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';

const LOZENGE = 'inline-flex rounded-[var(--radius-sm)] px-1.5 text-xs font-semibold uppercase';
const CHOICES = new Set<CustomFieldType>(['select', 'multiselect']);

interface OptionDraft {
  id?: string;
  value: string;
  archived: boolean;
}

/** Name, type, description and choices of a custom field (E-50). */
function CustomFieldDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: CustomField;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const descriptionId = useId();
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [newOption, setNewOption] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setType(editing?.type ?? 'text');
    setDescription(editing?.description ?? '');
    setOptions(editing?.options.map(({ id, value, archived }) => ({ id, value, archived })) ?? []);
    setNewOption('');
  }, [open, editing]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: trackingMetaQuery.queryKey });
  const save = useMutation({
    mutationFn: () => {
      const choices = CHOICES.has(type) ? options : [];
      if (editing) {
        return unwrap(
          client.PATCH('/api/v1/admin/custom-fields/{id}', {
            params: { path: { id: editing.id } },
            body: {
              name,
              description,
              ...(CHOICES.has(editing.type) ? { options: choices } : {}),
            },
          }),
        );
      }
      return unwrap(
        client.POST('/api/v1/admin/custom-fields', {
          body: { name, type, description, options: choices.map((option) => option.value) },
        }),
      );
    },
    onSuccess: async () => {
      await refresh();
      onOpenChange(false);
    },
  });
  const archive = useMutation({
    mutationFn: (archived: boolean) =>
      unwrap(
        client.PATCH('/api/v1/admin/custom-fields/{id}', {
          params: { path: { id: editing?.id ?? '' } },
          body: { archived },
        }),
      ),
    onSuccess: async () => {
      await refresh();
      onOpenChange(false);
    },
  });

  function addOption() {
    const value = newOption.trim();
    if (!value || options.some((option) => option.value.toLowerCase() === value.toLowerCase()))
      return;
    setOptions([...options, { value, archived: false }]);
    setNewOption('');
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) save.mutate();
  }

  const error = save.error ?? archive.error;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('fields.edit') : t('fields.create')}
      width={560}
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {error && <FormError message={error.message} />}
        <TextField
          label={t('fields.name')}
          value={name}
          required
          autoFocus
          maxLength={60}
          help={t('fields.nameHelp')}
          onChange={(event) => setName(event.target.value)}
        />
        <label className="flex flex-col gap-1.5">
          <span className="tl-label text-[var(--ink-muted)]">{t('fields.type')}</span>
          <select
            value={type}
            disabled={!!editing}
            onChange={(event) => setType(event.target.value as CustomFieldType)}
            className="h-[var(--control-md)] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 disabled:opacity-70"
          >
            {CustomFieldType.options.map((option) => (
              <option key={option} value={option}>
                {t(`fields.types.${option}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="tl-label text-[var(--ink-muted)]">{t('fields.description')}</span>
          <textarea
            value={description}
            maxLength={500}
            rows={2}
            aria-describedby={descriptionId}
            onChange={(event) => setDescription(event.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 py-1.5"
          />
          <span id={descriptionId} className="text-xs text-[var(--ink-muted)]">
            {t('fields.descriptionHelp')}
          </span>
        </label>
        {CHOICES.has(type) && (
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="tl-label mb-1.5 text-[var(--ink-muted)]">
              {t('fields.options')}
            </legend>
            {options.map((option, index) => (
              <div key={option.id ?? `new:${option.value}`} className="flex items-center gap-2">
                <input
                  aria-label={t('fields.optionValue', { number: index + 1 })}
                  value={option.value}
                  maxLength={100}
                  onChange={(event) =>
                    setOptions(
                      options.map((entry, at) =>
                        at === index ? { ...entry, value: event.target.value } : entry,
                      ),
                    )
                  }
                  className={`h-[var(--control-sm)] flex-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 ${option.archived ? 'text-[var(--ink-muted)] line-through' : ''}`}
                />
                {option.id ? (
                  <label className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
                    <input
                      type="checkbox"
                      checked={option.archived}
                      onChange={(event) =>
                        setOptions(
                          options.map((entry, at) =>
                            at === index ? { ...entry, archived: event.target.checked } : entry,
                          ),
                        )
                      }
                    />
                    {t('fields.archivedOption')}
                  </label>
                ) : (
                  <button
                    type="button"
                    aria-label={t('fields.removeOption', { value: option.value })}
                    onClick={() => setOptions(options.filter((_, at) => at !== index))}
                    className="grid size-7 place-items-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                  >
                    <Trash size={14} aria-hidden />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                aria-label={t('fields.newOption')}
                placeholder={t('fields.newOption')}
                value={newOption}
                maxLength={100}
                onChange={(event) => setNewOption(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  addOption();
                }}
                className="h-[var(--control-sm)] flex-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2"
              />
              <Button size="sm" onClick={addOption} disabled={!newOption.trim()}>
                <Plus size={14} aria-hidden />
                {t('fields.addOption')}
              </Button>
            </div>
            {editing && (
              <p className="m-0 text-xs text-[var(--ink-muted)]">{t('fields.optionsHelp')}</p>
            )}
          </fieldset>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {editing ? (
            <Button
              variant="ghost"
              disabled={archive.isPending}
              onClick={() => archive.mutate(!editing.archived)}
            >
              {editing.archived ? t('fields.restore') : t('fields.archive')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={save.isPending || !name.trim()}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

/** All custom fields of the instance (T-FLD-01, E-50), for global administrators. */
export function CustomFieldsPage() {
  const { t } = useTranslation();
  const fields = useQuery(trackingMetaQuery).data?.customFields;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CustomField | undefined>();

  return (
    <main className="flex flex-col gap-4 px-6 py-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--ink-muted)]">{t('webhooks.admin')}</span>
          <h1 className="tl-heading-xl">{t('fields.title')}</h1>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16} aria-hidden />
          {t('fields.create')}
        </Button>
      </header>
      <p className="m-0 max-w-[720px] text-[var(--ink-muted)]">{t('fields.intro')}</p>
      {fields?.length === 0 && (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] px-4 py-6 text-center text-[var(--ink-muted)]">
          {t('fields.empty')}
        </p>
      )}
      {fields && fields.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)]">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="tl-label text-left text-[var(--ink-muted)]">
                <th className="border-b border-[var(--border)] px-3 py-2">{t('fields.name')}</th>
                <th className="border-b border-[var(--border)] px-3 py-2">{t('fields.type')}</th>
                <th className="border-b border-[var(--border)] px-3 py-2">{t('fields.tql')}</th>
                <th className="border-b border-[var(--border)] px-3 py-2">{t('fields.options')}</th>
                <th className="border-b border-[var(--border)] px-3 py-2">{t('fields.status')}</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr
                  key={field.id}
                  className="h-[var(--row-comfortable)] hover:bg-[var(--surface-2)]"
                >
                  <td className="border-b border-[var(--border)] px-3">
                    <button
                      type="button"
                      onClick={() => setEditing(field)}
                      className="text-left font-semibold hover:underline"
                    >
                      {field.name}
                    </button>
                    {field.description && (
                      <span className="block truncate text-xs text-[var(--ink-muted)]">
                        {field.description}
                      </span>
                    )}
                  </td>
                  <td className="border-b border-[var(--border)] px-3">
                    {t(`fields.types.${field.type}`)}
                  </td>
                  <td className="border-b border-[var(--border)] px-3">
                    <code className="tl-key">cf[{field.number}]</code>
                  </td>
                  <td className="border-b border-[var(--border)] px-3 text-[var(--ink-muted)]">
                    {CHOICES.has(field.type)
                      ? field.options
                          .filter((option) => !option.archived)
                          .map((option) => option.value)
                          .join(', ')
                      : '–'}
                  </td>
                  <td className="border-b border-[var(--border)] px-3">
                    <span
                      className={`${LOZENGE} ${field.archived ? 'bg-[var(--surface-2)] text-[var(--ink-muted)]' : 'bg-[var(--accent-soft)] text-[var(--accent)]'}`}
                    >
                      {field.archived ? t('fields.archived') : t('fields.active')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CustomFieldDialog open={creating} onOpenChange={setCreating} />
      <CustomFieldDialog
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        editing={editing}
      />
    </main>
  );
}
