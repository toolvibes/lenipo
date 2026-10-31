import { Copy } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_FORMATS,
  type Webhook,
  type WebhookEventType,
  type WebhookFormat,
} from '@tasklore/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { projectsQuery, trackingMetaQuery } from '../../lib/tracking';
import { spacesQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';

interface WebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this webhook; without it a new one is created. */
  editing?: Webhook;
  onCreated: (webhook: Webhook, secret: string) => void;
}

/** Name, target, events, projects and target statuses of a webhook (E-45, E-86). */
export function WebhookDialog({ open, onOpenChange, editing, onCreated }: WebhookDialogProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const projects = useQuery({ ...projectsQuery, enabled: open });
  const meta = useQuery({ ...trackingMetaQuery, enabled: open });
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEventType[]>([]);
  const [projectKeys, setProjectKeys] = useState<string[]>([]);
  const [statusIds, setStatusIds] = useState<string[]>([]);
  const [tql, setTql] = useState('');
  const [spaceKeys, setSpaceKeys] = useState<string[]>([]);
  const spaces = useQuery({ ...spacesQuery, enabled: open });
  const [format, setFormat] = useState<WebhookFormat>('standard');
  const [locale, setLocale] = useState<'de' | 'en'>('de');

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setUrl(editing?.url ?? '');
    setEvents(editing?.events ?? ['issue.created', 'issue.transitioned', 'comment.created']);
    setProjectKeys(editing?.projectKeys ?? []);
    setStatusIds(editing?.statusIds ?? []);
    setTql(editing?.tql ?? '');
    setSpaceKeys(editing?.spaceKeys ?? []);
    setFormat(editing?.format ?? 'standard');
    setLocale(editing?.locale ?? (i18n.language.startsWith('en') ? 'en' : 'de'));
  }, [open, editing, i18n.language]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        url,
        events,
        projectKeys,
        statusIds,
        tql: tql.trim() || null,
        spaceKeys,
        format,
        locale,
      };
      if (editing) {
        await unwrap(
          client.PATCH('/api/v1/admin/webhooks/{id}', {
            params: { path: { id: editing.id } },
            body,
          }),
        );
        return null;
      }
      return unwrap(client.POST('/api/v1/admin/webhooks', { body }));
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      onOpenChange(false);
      if (created) onCreated(created, created.secret);
    },
  });

  const toggle = <T,>(list: T[], value: T, on: boolean) =>
    on ? [...list, value] : list.filter((entry) => entry !== value);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() && url.trim() && events.length > 0) save.mutate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('webhooks.edit') : t('webhooks.create')}
      width={600}
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {save.error && <FormError message={save.error.message} />}
        <TextField
          label={t('webhooks.name')}
          value={name}
          required
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label={t('webhooks.url')}
          help={t('webhooks.urlHelp')}
          type="url"
          value={url}
          required
          placeholder="https://chat.example.org/hooks/…"
          onChange={(event) => setUrl(event.target.value)}
        />
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <Select
            label={t('webhooks.format')}
            value={format}
            onChange={(event) => setFormat(event.target.value as WebhookFormat)}
            options={WEBHOOK_FORMATS.map((value) => ({
              value,
              label: t(`webhooks.formats.${value}`),
            }))}
          />
          <Select
            label={t('webhooks.locale')}
            value={locale}
            disabled={format === 'standard'}
            onChange={(event) => setLocale(event.target.value as 'de' | 'en')}
            options={[
              { value: 'de', label: 'Deutsch' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
        {format !== 'standard' && (
          <p className="m-0 text-xs text-[var(--ink-muted)]">{t('webhooks.chatHelp')}</p>
        )}
        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="tl-label mb-1 text-[var(--ink-muted)]">{t('webhooks.events')}</legend>
          {WEBHOOK_EVENT_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={events.includes(type)}
                onChange={(event) => setEvents(toggle(events, type, event.target.checked))}
              />
              {t(`webhooks.eventTypes.${type}`)}
              <code className="tl-key text-xs text-[var(--ink-muted)]">{type}</code>
            </label>
          ))}
        </fieldset>
        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="tl-label mb-1 text-[var(--ink-muted)]">
            {t('webhooks.projects')}
          </legend>
          <p className="m-0 text-xs text-[var(--ink-muted)]">{t('webhooks.projectsHelp')}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {projects.data?.map((project) => (
              <label key={project.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={projectKeys.includes(project.key)}
                  onChange={(event) =>
                    setProjectKeys(toggle(projectKeys, project.key, event.target.checked))
                  }
                />
                {project.name} <span className="tl-key text-xs">{project.key}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <TextField
          label={t('webhooks.tql')}
          help={t('webhooks.tqlHelp')}
          value={tql}
          placeholder="type = Bug AND priority = Hoch"
          className="font-[family-name:var(--font-mono)]"
          onChange={(event) => setTql(event.target.value)}
        />
        {events.some((type) => type.startsWith('page.')) && (
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="tl-label mb-1 text-[var(--ink-muted)]">
              {t('webhooks.spaces')}
            </legend>
            <p className="m-0 text-xs text-[var(--ink-muted)]">{t('webhooks.spacesHelp')}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {spaces.data?.map((space) => (
                <label key={space.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={spaceKeys.includes(space.key)}
                    onChange={(event) =>
                      setSpaceKeys(toggle(spaceKeys, space.key, event.target.checked))
                    }
                  />
                  {space.name} <span className="tl-key text-xs">{space.key}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {events.includes('issue.transitioned') && (
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="tl-label mb-1 text-[var(--ink-muted)]">
              {t('webhooks.statuses')}
            </legend>
            <p className="m-0 text-xs text-[var(--ink-muted)]">{t('webhooks.statusesHelp')}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {meta.data?.statuses.map((status) => (
                <label key={status.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={statusIds.includes(status.id)}
                    onChange={(event) =>
                      setStatusIds(toggle(statusIds, status.id, event.target.checked))
                    }
                  />
                  {status.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={save.isPending || !name.trim() || !url.trim() || events.length === 0}
          >
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Shows a new secret once, with a copy button and how receivers verify it. */
export function SecretDialog({ secret, onClose }: { secret: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Dialog
      open={secret !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false);
          onClose();
        }
      }}
      title={t('webhooks.secretTitle')}
      description={t('webhooks.secretHelp')}
      width={600}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <code className="tl-key min-w-0 flex-1 break-all rounded-[var(--radius-md)] bg-[var(--surface-2)] px-3 py-2">
            {secret}
          </code>
          <Button
            onClick={() => {
              void navigator.clipboard.writeText(secret ?? '').then(() => setCopied(true));
            }}
          >
            <Copy size={16} aria-hidden />
            {copied ? t('webhooks.copied') : t('webhooks.copy')}
          </Button>
        </div>
        <p className="m-0 text-[var(--ink-muted)]">{t('webhooks.verifyHelp')}</p>
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            {t('webhooks.secretDone')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
