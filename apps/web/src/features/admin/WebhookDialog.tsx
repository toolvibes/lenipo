import { Copy } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WEBHOOK_EVENT_TYPES, type Webhook, type WebhookEventType } from '@tasklore/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { projectsQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';

interface WebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this webhook; without it a new one is created. */
  editing?: Webhook;
  onCreated: (webhook: Webhook, secret: string) => void;
}

/** Name, target, events and projects of a webhook (E-45). */
export function WebhookDialog({ open, onOpenChange, editing, onCreated }: WebhookDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const projects = useQuery({ ...projectsQuery, enabled: open });
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEventType[]>([]);
  const [projectKeys, setProjectKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setUrl(editing?.url ?? '');
    setEvents(editing?.events ?? ['issue.created', 'issue.transitioned', 'comment.created']);
    setProjectKeys(editing?.projectKeys ?? []);
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const body = { name, url, events, projectKeys };
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
