import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PrintTemplate, PrintTemplateInput } from '@toolvibes/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';

const LOGO_LIMIT = 200_000;

const EMPTY: PrintTemplateInput = {
  name: '',
  titlePage: true,
  logo: null,
  subtitle: '{{space}}',
  header: '{{space}} · {{title}}',
  footer: '{{date}} · {{page}} / {{pages}}',
  css: '',
  isDefault: false,
};

function Editor({ initial, onDone }: { initial: PrintTemplate | null; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PrintTemplateInput>(() =>
    initial
      ? {
          name: initial.name,
          titlePage: initial.titlePage,
          logo: initial.logo,
          subtitle: initial.subtitle,
          header: initial.header,
          footer: initial.footer,
          css: initial.css,
          isDefault: initial.isDefault,
        }
      : EMPTY,
  );
  const [logoError, setLogoError] = useState('');
  const save = useMutation({
    mutationFn: () =>
      initial
        ? unwrap(
            client.PUT('/api/v1/admin/print-templates/{id}', {
              params: { path: { id: initial.id } },
              body: draft,
            }),
          )
        : unwrap(client.POST('/api/v1/admin/print-templates', { body: draft })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['print-templates'] });
      onDone();
    },
  });
  const set = (patch: Partial<PrintTemplateInput>) => setDraft({ ...draft, ...patch });
  const readLogo = (file: File | undefined) => {
    setLogoError('');
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > LOGO_LIMIT) {
      setLogoError(t('printTemplates.logoInvalid'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set({ logo: String(reader.result) });
    reader.readAsDataURL(file);
  };
  return (
    <form
      className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error && <FormError message={save.error.message} />}
      <TextField
        label={t('printTemplates.name')}
        value={draft.name}
        onChange={(event) => set({ name: event.target.value })}
      />
      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={draft.titlePage}
          onChange={(event) => set({ titlePage: event.target.checked })}
        />
        {t('printTemplates.titlePage')}
      </label>
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span className="tl-field-label">{t('printTemplates.logo')}</span>
        {draft.logo && (
          <img src={draft.logo} alt="" className="max-h-10 max-w-[160px] object-contain" />
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => readLogo(event.target.files?.[0])}
        />
        {draft.logo && (
          <Button type="button" size="sm" onClick={() => set({ logo: null })}>
            {t('printTemplates.removeLogo')}
          </Button>
        )}
        {logoError && <span className="text-[var(--danger)]">{logoError}</span>}
      </div>
      <TextField
        label={t('printTemplates.subtitle')}
        value={draft.subtitle}
        onChange={(event) => set({ subtitle: event.target.value })}
      />
      <TextField
        label={t('printTemplates.header')}
        help={t('printTemplates.placeholders')}
        value={draft.header}
        onChange={(event) => set({ header: event.target.value })}
      />
      <TextField
        label={t('printTemplates.footer')}
        value={draft.footer}
        onChange={(event) => set({ footer: event.target.value })}
      />
      <label className="flex flex-col gap-1">
        <span className="tl-field-label">{t('printTemplates.css')}</span>
        <textarea
          rows={6}
          value={draft.css}
          maxLength={20_000}
          onChange={(event) => set({ css: event.target.value })}
          className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-2 font-[family-name:var(--font-mono)] text-[13px] text-[var(--ink)]"
        />
        <span className="text-xs text-[var(--ink-muted)]">{t('printTemplates.cssHelp')}</span>
      </label>
      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={draft.isDefault}
          onChange={(event) => set({ isDefault: event.target.checked })}
        />
        {t('printTemplates.isDefault')}
      </label>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={!draft.name.trim() || save.isPending}>
          {t('common.save')}
        </Button>
        <Button type="button" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

/** Print templates for PDFs of wiki pages (TL-53, E-142). */
export function PrintTemplatesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ['print-templates'],
    queryFn: () => unwrap(client.GET('/api/v1/print-templates')),
  });
  const [editing, setEditing] = useState<PrintTemplate | 'new' | null>(null);
  const open = useMutation({
    mutationFn: (id: string) =>
      unwrap(client.GET('/api/v1/print-templates/{id}', { params: { path: { id } } })),
    onSuccess: (template) => setEditing(template),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(client.DELETE('/api/v1/admin/print-templates/{id}', { params: { path: { id } } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['print-templates'] }),
  });
  const error = list.error ?? open.error ?? remove.error;
  return (
    <main className="flex max-w-[760px] flex-col gap-4 px-10 py-7">
      <h1 className="m-0 text-[24px] leading-[30px] font-extrabold tracking-[-0.025em]">
        {t('printTemplates.title')}
      </h1>
      <p className="m-0 text-[var(--ink-muted)]">{t('printTemplates.intro')}</p>
      {error && <FormError message={error.message} />}
      {editing ? (
        <Editor
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : (
        <div>
          <Button variant="primary" onClick={() => setEditing('new')}>
            {t('printTemplates.create')}
          </Button>
        </div>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {list.data?.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center gap-3 border-b border-[var(--border)] py-2 text-[13px]"
          >
            <span className="flex-1 font-medium">
              {entry.name}
              {entry.isDefault && (
                <span className="font-normal text-[var(--ink-muted)]">
                  {' '}
                  · {t('printTemplates.default')}
                </span>
              )}
            </span>
            <Button size="sm" onClick={() => open.mutate(entry.id)}>
              {t('printTemplates.edit')}
            </Button>
            <Button size="sm" variant="danger" onClick={() => remove.mutate(entry.id)}>
              {t('printTemplates.delete')}
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}
