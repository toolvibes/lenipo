import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { RequestType, RichText } from '@toolvibes/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDateTime, formatRelative } from '../../lib/format';
import { trackingMetaQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { StatusLozenge } from '../tracking/icons';
import { RichTextView } from '../tracking/RichTextEditor';

export const portalDesksQuery = {
  queryKey: ['portal', 'desks'],
  queryFn: () => unwrap(client.GET('/api/v1/portal/desks')),
};

const CARD =
  'flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-4 text-[var(--ink)] no-underline hover:border-[var(--border-strong)]';
const AREA =
  'rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-2 text-[var(--ink)]';

/** The caller's own requests, newest first. */
function MyRequests() {
  const { t } = useTranslation();
  const requests = useQuery({
    queryKey: ['portal', 'requests'],
    queryFn: () => unwrap(client.GET('/api/v1/portal/requests')),
  });
  return (
    <section className="flex flex-col gap-2">
      <h2 className="tl-heading-md m-0">{t('portal.myRequests')}</h2>
      {requests.data?.length === 0 && (
        <p className="m-0 text-[var(--ink-muted)]">{t('portal.noRequests')}</p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {requests.data?.map((request) => (
          <li key={request.key} className="border-b border-[var(--border)]">
            <Link
              to="/portal/requests/$key"
              params={{ key: request.key }}
              className="flex flex-wrap items-center gap-3 py-2 text-[var(--ink)] no-underline hover:bg-[var(--surface-2)]"
            >
              <span className="tl-key text-[var(--ink-muted)]">{request.key}</span>
              <span className="min-w-0 flex-1 truncate">{request.summary}</span>
              <span className="text-xs text-[var(--ink-muted)]">{request.project.name}</span>
              <StatusLozenge status={request.status} />
              <span className="text-xs text-[var(--ink-muted)]">
                {formatRelative(request.updatedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The service portal (TL-47, E-137): desks the caller may use and their own requests. */
export function PortalPage() {
  const { t } = useTranslation();
  const desks = useQuery(portalDesksQuery);
  return (
    <main className="flex max-w-4xl flex-col gap-6 px-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="tl-heading-xl">{t('portal.title')}</h1>
        <p className="m-0 text-[var(--ink-muted)]">{t('portal.intro')}</p>
      </header>
      {desks.data?.length === 0 && (
        <p className="m-0 text-[var(--ink-muted)]">{t('portal.noDesks')}</p>
      )}
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 p-0">
        {desks.data?.map((desk) => (
          <li key={desk.key}>
            <Link to="/portal/$key" params={{ key: desk.key }} className={CARD}>
              <strong>{desk.name}</strong>
              {desk.intro && <span className="text-sm text-[var(--ink-muted)]">{desk.intro}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <MyRequests />
    </main>
  );
}

function RequestForm({ deskKey, type }: { deskKey: string; type: RequestType }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meta = useQuery(trackingMetaQuery);
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('');
  const [dueDate, setDueDate] = useState('');
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/portal/desks/{key}/requests', {
          params: { path: { key: deskKey } },
          body: {
            requestTypeId: type.id,
            summary: summary.trim(),
            ...(description.trim() ? { description: { markdown: description } } : {}),
            ...(priority ? { priority } : {}),
            ...(dueDate ? { dueDate } : {}),
          },
        }),
      ),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['portal'] });
      await navigate({ to: '/portal/requests/$key', params: { key: created.key } });
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (summary.trim()) create.mutate();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {create.error && <FormError message={create.error.message} />}
      <TextField
        label={t('portal.summary')}
        required
        maxLength={255}
        value={summary}
        onChange={(event) => setSummary(event.target.value)}
      />
      <label className="flex flex-col gap-1">
        <span className="tl-field-label">{t('portal.description')}</span>
        <textarea
          rows={6}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={AREA}
        />
      </label>
      {type.fields.includes('priority') && (
        <Select
          label={t('issues.priority')}
          value={priority}
          options={[
            { value: '', label: t('portal.default') },
            ...(meta.data?.priorities ?? []).map((entry) => ({
              value: entry.key,
              label: entry.name,
            })),
          ]}
          onChange={(event) => setPriority(event.target.value)}
        />
      )}
      {type.fields.includes('dueDate') && (
        <TextField
          type="date"
          label={t('issues.dueDate')}
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
      )}
      <div>
        <Button type="submit" variant="primary" disabled={create.isPending || !summary.trim()}>
          {t('portal.send')}
        </Button>
      </div>
    </form>
  );
}

/** A desk: choose what to ask for, then fill in its form. */
export function PortalDeskPage({ deskKey }: { deskKey: string }) {
  const { t } = useTranslation();
  const desk = useQuery({
    queryKey: ['portal', 'desk', deskKey],
    queryFn: () =>
      unwrap(client.GET('/api/v1/portal/desks/{key}', { params: { path: { key: deskKey } } })),
  });
  const [typeId, setTypeId] = useState<string | null>(null);
  if (desk.error) return <p className="px-6 py-8 text-[var(--danger)]">{desk.error.message}</p>;
  if (!desk.data) return null;
  const type = desk.data.requestTypes.find((entry) => entry.id === typeId) ?? null;
  return (
    <main className="flex max-w-3xl flex-col gap-5 px-6 py-6">
      <Link to="/portal" className="text-sm">
        ← {t('portal.title')}
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="tl-heading-xl">{desk.data.name}</h1>
        {desk.data.intro && <p className="m-0 text-[var(--ink-muted)]">{desk.data.intro}</p>}
      </header>
      {!type && (
        <section className="flex flex-col gap-2">
          <h2 className="tl-heading-md m-0">{t('portal.whatDoYouNeed')}</h2>
          {desk.data.requestTypes.length === 0 && (
            <p className="m-0 text-[var(--ink-muted)]">{t('portal.noTypes')}</p>
          )}
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {desk.data.requestTypes.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setTypeId(entry.id)}
                  className={`${CARD} w-full cursor-pointer text-left`}
                >
                  <strong>{entry.name}</strong>
                  {entry.description && (
                    <span className="text-sm text-[var(--ink-muted)]">{entry.description}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {type && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="tl-heading-md m-0">{type.name}</h2>
            <Button size="sm" variant="ghost" onClick={() => setTypeId(null)}>
              {t('portal.otherType')}
            </Button>
          </div>
          <RequestForm deskKey={deskKey} type={type} />
        </section>
      )}
    </main>
  );
}

/** One request with the public conversation; the customer answers here. */
export function PortalRequestPage({ issueKey }: { issueKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['portal', 'request', issueKey];
  const request = useQuery({
    queryKey,
    queryFn: () =>
      unwrap(client.GET('/api/v1/portal/requests/{issueKey}', { params: { path: { issueKey } } })),
  });
  const [answer, setAnswer] = useState('');
  const reply = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/portal/requests/{issueKey}/comments', {
          params: { path: { issueKey } },
          body: { body: { markdown: answer } },
        }),
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      setAnswer('');
    },
  });
  if (request.error)
    return <p className="px-6 py-8 text-[var(--danger)]">{request.error.message}</p>;
  const data = request.data;
  if (!data) return null;
  return (
    <main className="flex max-w-3xl flex-col gap-5 px-6 py-6">
      <Link to="/portal" className="text-sm">
        ← {t('portal.title')}
      </Link>
      <header className="flex flex-col gap-2">
        <span className="flex flex-wrap items-center gap-2 text-sm text-[var(--ink-muted)]">
          <span className="tl-key">{data.key}</span>
          {data.project.name} · {data.requestType}
        </span>
        <h1 className="tl-heading-xl">{data.summary}</h1>
        <span className="flex items-center gap-2 text-sm">
          <StatusLozenge status={data.status} />
          <span className="text-[var(--ink-muted)]">
            {t('portal.filed', { when: formatDateTime(data.createdAt) })}
          </span>
        </span>
      </header>
      {data.description && <RichTextView doc={data.description as RichText} />}
      <section className="flex flex-col gap-3">
        <h2 className="tl-heading-md m-0">{t('portal.conversation')}</h2>
        {data.comments.length === 0 && (
          <p className="m-0 text-[var(--ink-muted)]">{t('portal.noAnswers')}</p>
        )}
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.comments.map((comment) => (
            <li
              key={comment.id}
              className={`flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--border)] p-3 ${
                comment.fromAgent ? 'bg-[var(--accent-soft)]' : 'bg-[var(--surface-1)]'
              }`}
            >
              <span className="text-xs text-[var(--ink-muted)]">
                <strong className="text-[var(--ink)]">
                  {comment.fromAgent
                    ? t('portal.agent', { name: comment.author?.displayName ?? '' })
                    : t('portal.you')}
                </strong>{' '}
                · {formatRelative(comment.createdAt)}
              </span>
              <RichTextView doc={comment.body as RichText} />
            </li>
          ))}
        </ul>
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (answer.trim()) reply.mutate();
          }}
        >
          {reply.error && <FormError message={reply.error.message} />}
          <label className="flex flex-col gap-1">
            <span className="tl-field-label">{t('portal.answer')}</span>
            <textarea
              rows={4}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              className={AREA}
            />
          </label>
          <div>
            <Button type="submit" variant="primary" disabled={reply.isPending || !answer.trim()}>
              {t('portal.sendAnswer')}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
