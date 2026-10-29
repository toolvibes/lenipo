import { ArrowClockwise, Key, PaperPlaneTilt, Plus } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { Webhook, WebhookDelivery } from '@tasklore/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { webhookDeliveriesQuery, webhookQuery, webhooksQuery } from '../../lib/admin';
import { ApiError, client, unwrap } from '../../lib/api';
import { formatDateTime, formatRelative } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { SecretDialog, WebhookDialog } from './WebhookDialog';

const LOZENGE = 'inline-flex rounded-[var(--radius-sm)] px-1.5 text-xs font-semibold uppercase';

/** State of a webhook in words and color, never by color alone. */
function WebhookState({ webhook }: { webhook: Webhook }) {
  const { t } = useTranslation();
  if (!webhook.enabled) {
    return (
      <span className={`${LOZENGE} bg-[var(--surface-2)] text-[var(--ink-muted)]`}>
        {t('webhooks.state.off')}
      </span>
    );
  }
  if (webhook.failingSince) {
    return (
      <span
        className={`${LOZENGE} bg-[var(--danger-soft)] text-[var(--danger)]`}
        title={formatDateTime(webhook.failingSince)}
      >
        {t('webhooks.state.failing')}
      </span>
    );
  }
  return (
    <span className={`${LOZENGE} bg-[var(--accent-soft)] text-[var(--accent)]`}>
      {t('webhooks.state.on')}
    </span>
  );
}

function DeliveryState({ delivery }: { delivery: WebhookDelivery }) {
  const { t } = useTranslation();
  const tone =
    delivery.status === 'succeeded'
      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
      : delivery.status === 'failed'
        ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
        : 'bg-[var(--warning-soft)] text-[var(--ink)]';
  return <span className={`${LOZENGE} ${tone}`}>{t(`webhooks.delivery.${delivery.status}`)}</span>;
}

/** All webhooks of the instance (P-ADM-17), for global administrators. */
export function WebhooksPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const webhooks = useQuery(webhooksQuery);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<{ id: string; value: string } | null>(null);

  return (
    <main className="flex flex-col gap-4 px-6 py-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--ink-muted)]">{t('webhooks.admin')}</span>
          <h1 className="tl-heading-xl">{t('webhooks.title')}</h1>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16} aria-hidden />
          {t('webhooks.create')}
        </Button>
      </header>
      <p className="m-0 max-w-[720px] text-[var(--ink-muted)]">{t('webhooks.intro')}</p>
      {webhooks.error && <FormError message={webhooks.error.message} />}
      {webhooks.data?.length === 0 && (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] px-4 py-6 text-center text-[var(--ink-muted)]">
          {t('webhooks.empty')}
        </p>
      )}
      {webhooks.data && webhooks.data.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)]">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="tl-label text-left uppercase text-[var(--ink-muted)]">
                <th className="border-b border-[var(--border)] px-3 py-2">{t('webhooks.name')}</th>
                <th className="border-b border-[var(--border)] px-3 py-2">{t('webhooks.url')}</th>
                <th className="border-b border-[var(--border)] px-3 py-2">
                  {t('webhooks.events')}
                </th>
                <th className="border-b border-[var(--border)] px-3 py-2">
                  {t('webhooks.status')}
                </th>
                <th className="border-b border-[var(--border)] px-3 py-2">
                  {t('webhooks.lastDelivery')}
                </th>
              </tr>
            </thead>
            <tbody>
              {webhooks.data.map((webhook) => (
                <tr
                  key={webhook.id}
                  className="h-[var(--row-comfortable)] hover:bg-[var(--surface-2)]"
                >
                  <td className="border-b border-[var(--border)] px-3">
                    <Link
                      to="/admin/webhooks/$id"
                      params={{ id: webhook.id }}
                      className="font-semibold text-[var(--ink)] no-underline hover:underline"
                    >
                      {webhook.name}
                    </Link>
                  </td>
                  <td className="max-w-0 border-b border-[var(--border)] px-3">
                    <span className="tl-key block truncate text-xs">{webhook.url}</span>
                  </td>
                  <td className="border-b border-[var(--border)] px-3 text-[var(--ink-muted)]">
                    {webhook.events.length}
                    {webhook.projectKeys.length > 0 && ` · ${webhook.projectKeys.join(', ')}`}
                  </td>
                  <td className="border-b border-[var(--border)] px-3">
                    <WebhookState webhook={webhook} />
                  </td>
                  <td className="border-b border-[var(--border)] px-3 text-[var(--ink-muted)]">
                    {webhook.lastDelivery
                      ? `${t(`webhooks.delivery.${webhook.lastDelivery.status}`)} · ${formatRelative(webhook.lastDelivery.at)}`
                      : t('webhooks.never')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <WebhookDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(webhook, value) => setSecret({ id: webhook.id, value })}
      />
      <SecretDialog
        secret={secret?.value ?? null}
        onClose={() => {
          const id = secret?.id;
          setSecret(null);
          if (id) void navigate({ to: '/admin/webhooks/$id', params: { id } });
        }}
      />
    </main>
  );
}

/** One webhook: settings, actions and the delivery log with resend. */
export function WebhookPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const webhook = useQuery(webhookQuery(id));
  const deliveries = useQuery(webhookDeliveriesQuery(id));
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const path = { params: { path: { id } } };
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['webhooks'] });

  const test = useMutation({
    mutationFn: () => unwrap(client.POST('/api/v1/admin/webhooks/{id}/test', path)),
    onSuccess: refresh,
  });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      unwrap(client.PATCH('/api/v1/admin/webhooks/{id}', { ...path, body: { enabled } })),
    onSuccess: refresh,
  });
  const rotate = useMutation({
    mutationFn: () => unwrap(client.POST('/api/v1/admin/webhooks/{id}/rotate-secret', path)),
    onSuccess: (result) => setSecret(result.secret),
  });
  const resend = useMutation({
    mutationFn: (deliveryId: string) =>
      unwrap(
        client.POST('/api/v1/admin/webhooks/{id}/deliveries/{deliveryId}/resend', {
          params: { path: { id, deliveryId } },
        }),
      ),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => unwrap(client.DELETE('/api/v1/admin/webhooks/{id}', path)),
    onSuccess: async () => {
      await refresh();
      await navigate({ to: '/admin/webhooks' });
    },
  });

  if (webhook.error) {
    return (
      <p className="px-6 py-8 text-[var(--ink-muted)]">
        {webhook.error instanceof ApiError && webhook.error.status === 404
          ? t('webhooks.notFound')
          : webhook.error.message}
      </p>
    );
  }
  const data = webhook.data;
  if (!data) return <p className="px-6 py-8 text-[var(--ink-muted)]">{t('common.loading')}</p>;
  const error = test.error ?? toggle.error ?? rotate.error ?? resend.error ?? remove.error;

  return (
    <main className="flex flex-col gap-4 px-6 py-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-[min(100%,18rem)] flex-1 flex-col gap-1">
          <Link
            to="/admin/webhooks"
            className="text-xs text-[var(--ink-muted)] no-underline hover:underline"
          >
            {t('webhooks.title')}
          </Link>
          <h1 className="tl-heading-xl flex flex-wrap items-center gap-2 break-words">
            {data.name} <WebhookState webhook={data} />
          </h1>
          <span className="tl-key break-all text-xs text-[var(--ink-muted)]">{data.url}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => test.mutate()} disabled={test.isPending}>
            <PaperPlaneTilt size={16} aria-hidden />
            {t('webhooks.test')}
          </Button>
          <Button onClick={() => toggle.mutate(!data.enabled)} disabled={toggle.isPending}>
            {data.enabled ? t('webhooks.disable') : t('webhooks.enable')}
          </Button>
          <Button variant="ghost" onClick={() => setEditing(true)}>
            {t('webhooks.edit')}
          </Button>
          <Button variant="ghost" onClick={() => rotate.mutate()} disabled={rotate.isPending}>
            <Key size={16} aria-hidden />
            {t('webhooks.rotate')}
          </Button>
          <Button variant="ghost" onClick={() => setDeleting(true)}>
            {t('webhooks.delete')}
          </Button>
        </div>
      </header>

      {error && <FormError message={error.message} />}
      {data.disabledReason && (
        <p className="m-0 rounded-[var(--radius-md)] bg-[var(--warning-soft)] px-3 py-2">
          {t('webhooks.disabledBySystem', { reason: data.disabledReason })}
        </p>
      )}
      {test.data && (
        <p role="status" className="m-0 text-[var(--ink-muted)]">
          {test.data.status === 'succeeded'
            ? t('webhooks.testOk', { status: String(test.data.responseStatus ?? '') })
            : t('webhooks.testFailed', { detail: test.data.responseBody ?? '' })}
        </p>
      )}

      <dl className="m-0 grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-3 gap-y-1.5">
        <dt className="tl-label uppercase text-[var(--ink-muted)]">{t('webhooks.events')}</dt>
        <dd className="m-0">
          {data.events.map((type) => t(`webhooks.eventTypes.${type}`)).join(', ')}
        </dd>
        <dt className="tl-label uppercase text-[var(--ink-muted)]">{t('webhooks.projects')}</dt>
        <dd className="m-0">
          {data.projectKeys.length > 0 ? data.projectKeys.join(', ') : t('webhooks.allProjects')}
        </dd>
      </dl>

      <section aria-label={t('webhooks.deliveries')} className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="tl-heading-md">{t('webhooks.deliveries')}</h2>
          <Button size="sm" variant="ghost" onClick={() => void deliveries.refetch()}>
            <ArrowClockwise size={16} aria-hidden />
            {t('webhooks.reload')}
          </Button>
        </div>
        <p className="m-0 text-xs text-[var(--ink-muted)]">{t('webhooks.deliveriesHelp')}</p>
        {deliveries.data?.length === 0 && (
          <p className="text-[var(--ink-muted)]">{t('webhooks.noDeliveries')}</p>
        )}
        {deliveries.data && deliveries.data.length > 0 && (
          <ul className="m-0 list-none overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-0">
            {deliveries.data.map((delivery) => (
              <li key={delivery.id} className="border-b border-[var(--border)] last:border-b-0">
                <div className="flex min-h-[var(--row-comfortable)] flex-wrap items-center gap-3 px-3 py-1.5">
                  <DeliveryState delivery={delivery} />
                  <code className="tl-key text-xs">{delivery.type}</code>
                  <span
                    className="text-xs text-[var(--ink-muted)]"
                    title={formatDateTime(delivery.createdAt)}
                  >
                    {formatRelative(delivery.createdAt)}
                  </span>
                  <span className="text-xs text-[var(--ink-muted)]">
                    {[
                      delivery.responseStatus !== null ? `HTTP ${delivery.responseStatus}` : null,
                      delivery.durationMs !== null ? `${delivery.durationMs} ms` : null,
                      t('webhooks.attempts', { count: delivery.attempts }),
                      delivery.nextAttemptAt
                        ? t('webhooks.nextAttempt', {
                            time: formatRelative(delivery.nextAttemptAt),
                          })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="ml-auto flex gap-1">
                    {delivery.responseBody && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-expanded={open === delivery.id}
                        onClick={() => setOpen(open === delivery.id ? null : delivery.id)}
                      >
                        {t('webhooks.response')}
                      </Button>
                    )}
                    {delivery.status !== 'succeeded' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={resend.isPending}
                        onClick={() => resend.mutate(delivery.id)}
                      >
                        {t('webhooks.resend')}
                      </Button>
                    )}
                  </span>
                </div>
                {open === delivery.id && (
                  <pre className="tl-code m-0 overflow-x-auto bg-[var(--surface-2)] px-3 py-2 text-xs whitespace-pre-wrap">
                    {delivery.responseBody}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <WebhookDialog open={editing} onOpenChange={setEditing} editing={data} onCreated={() => {}} />
      <SecretDialog secret={secret} onClose={() => setSecret(null)} />
      <Dialog open={deleting} onOpenChange={setDeleting} title={t('webhooks.deleteTitle')}>
        <div className="flex flex-col gap-4">
          <p className="m-0">{t('webhooks.deleteConfirm', { name: data.name })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
              {t('webhooks.delete')}
            </Button>
          </div>
        </div>
      </Dialog>
    </main>
  );
}
