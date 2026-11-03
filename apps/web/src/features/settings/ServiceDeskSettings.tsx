import { Trash, X } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { ServiceDesk, ServiceDeskSettings as Settings } from '@toolvibes/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, client, unwrap } from '../../lib/api';
import { projectQuery, trackingMetaQuery } from '../../lib/tracking';
import { userSearchQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { useDebounced } from '../search/TqlInput';

const DEFAULTS: Settings = {
  customerAccess: 'list',
  intro: '',
  firstResponseHours: {},
  resolutionHours: {},
  pauseStatusIds: [],
  timeZone: 'Europe/Berlin',
  dayStartHour: 9,
};

/** Runs the project as a service desk (TL-47, E-137): portal, request types, customers, SLAs. */
export function ServiceDeskSettings({ projectKey }: { projectKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['project', projectKey, 'service-desk'];
  const path = { params: { path: { key: projectKey } } };
  const desk = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await unwrap(client.GET('/api/v1/projects/{key}/service-desk', path));
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
  const settle = (value: ServiceDesk | null) => queryClient.setQueryData(queryKey, value);
  const save = useMutation({
    mutationFn: (settings: Settings) =>
      unwrap(client.PUT('/api/v1/projects/{key}/service-desk', { ...path, body: settings })),
    onSuccess: settle,
  });
  const disable = useMutation({
    mutationFn: () => unwrap(client.DELETE('/api/v1/projects/{key}/service-desk', path)),
    onSuccess: () => settle(null),
  });
  const error = desk.error ?? save.error ?? disable.error;

  if (desk.data === undefined) return error ? <FormError message={error.message} /> : null;
  if (desk.data === null) {
    return (
      <section className="flex max-w-2xl flex-col gap-3">
        <h2 className="tl-heading-md m-0">{t('serviceDesk.title')}</h2>
        <p className="m-0 text-sm text-[var(--ink-muted)]">{t('serviceDesk.intro')}</p>
        {error && <FormError message={error.message} />}
        <div>
          <Button variant="primary" onClick={() => save.mutate(DEFAULTS)} disabled={save.isPending}>
            {t('serviceDesk.enable')}
          </Button>
        </div>
      </section>
    );
  }
  const data = desk.data;
  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="tl-heading-md m-0">{t('serviceDesk.title')}</h2>
        <Link to="/portal/$key" params={{ key: projectKey }} className="text-sm">
          {t('serviceDesk.openPortal')}
        </Link>
      </div>
      {error && <FormError message={error.message} />}
      <GeneralSettings
        settings={data.settings}
        busy={save.isPending}
        onSave={(settings) => save.mutate(settings)}
      />
      <RequestTypes projectKey={projectKey} desk={data} onChange={settle} />
      {data.settings.customerAccess === 'list' && (
        <Customers projectKey={projectKey} desk={data} onChange={settle} />
      )}
      <SlaSettings
        projectKey={projectKey}
        settings={data.settings}
        busy={save.isPending}
        onSave={(settings) => save.mutate(settings)}
      />
      <div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            if (window.confirm(t('serviceDesk.disableConfirm'))) disable.mutate();
          }}
        >
          {t('serviceDesk.disable')}
        </Button>
      </div>
    </section>
  );
}

function GeneralSettings({
  settings,
  busy,
  onSave,
}: {
  settings: Settings;
  busy: boolean;
  onSave: (settings: Settings) => void;
}) {
  const { t } = useTranslation();
  const [intro, setIntro] = useState(settings.intro);
  return (
    <div className="flex flex-col gap-3">
      <Select
        label={t('serviceDesk.access')}
        value={settings.customerAccess}
        options={[
          { value: 'list', label: t('serviceDesk.accessList') },
          { value: 'everyone', label: t('serviceDesk.accessEveryone') },
        ]}
        onChange={(event) =>
          onSave({ ...settings, customerAccess: event.target.value as Settings['customerAccess'] })
        }
      />
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ ...settings, intro });
        }}
      >
        <div className="flex-1">
          <TextField
            label={t('serviceDesk.portalIntro')}
            value={intro}
            maxLength={2000}
            onChange={(event) => setIntro(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy || intro === settings.intro}>
          {t('common.save')}
        </Button>
      </form>
    </div>
  );
}

function RequestTypes({
  projectKey,
  desk,
  onChange,
}: {
  projectKey: string;
  desk: ServiceDesk;
  onChange: (desk: ServiceDesk) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const project = useQuery(projectQuery(projectKey));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [issueType, setIssueType] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const path = { params: { path: { key: projectKey } } };
  const add = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/projects/{key}/service-desk/request-types', {
          ...path,
          body: { name: name.trim(), description, issueType, fields },
        }),
      ),
    onSuccess: (updated) => {
      onChange(updated);
      setName('');
      setDescription('');
      setFields([]);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(
        client.DELETE('/api/v1/projects/{key}/service-desk/request-types/{id}', {
          params: { path: { key: projectKey, id } },
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['project', projectKey, 'service-desk'] }),
  });
  const types = project.data?.issueTypes ?? [];
  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() && (issueType || types[0])) add.mutate();
  }
  const toggle = (field: string) =>
    setFields(
      fields.includes(field) ? fields.filter((entry) => entry !== field) : [...fields, field],
    );
  return (
    <div className="flex flex-col gap-2">
      <h3 className="tl-label m-0 text-[var(--ink-muted)]">{t('serviceDesk.requestTypes')}</h3>
      {(add.error || remove.error) && (
        <FormError message={(add.error ?? remove.error)?.message ?? ''} />
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {desk.requestTypes.length === 0 && (
          <li className="text-sm text-[var(--ink-muted)]">{t('serviceDesk.noTypes')}</li>
        )}
        {desk.requestTypes.map((type) => (
          <li
            key={type.id}
            className="flex items-center gap-2 border-b border-[var(--border)] py-1.5 text-sm"
          >
            <span className="min-w-0 flex-1">
              <strong>{type.name}</strong>
              <span className="ml-2 text-xs text-[var(--ink-muted)]">
                {type.issueType.name}
                {type.fields.length > 0 &&
                  ` · ${type.fields.map((field) => t(`serviceDesk.fields.${field as 'priority'}`, field)).join(', ')}`}
              </span>
            </span>
            <button
              type="button"
              aria-label={t('serviceDesk.removeType', { name: type.name })}
              onClick={() => remove.mutate(type.id)}
              className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:text-[var(--danger)]"
            >
              <Trash size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={submit}
        className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <TextField
            label={t('serviceDesk.typeName')}
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
          />
          <Select
            label={t('serviceDesk.issueType')}
            value={issueType || types[0]?.key || ''}
            options={types.map((type) => ({ value: type.key, label: type.name }))}
            onChange={(event) => setIssueType(event.target.value)}
          />
        </div>
        <TextField
          label={t('serviceDesk.typeDescription')}
          value={description}
          maxLength={1000}
          onChange={(event) => setDescription(event.target.value)}
        />
        <fieldset className="m-0 flex flex-wrap gap-3 border-0 p-0 text-sm">
          <legend className="tl-field-label mb-1">{t('serviceDesk.formFields')}</legend>
          {(['priority', 'dueDate'] as const).map((field) => (
            <label key={field} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={fields.includes(field)}
                onChange={() => toggle(field)}
              />
              {t(`serviceDesk.fields.${field}`)}
            </label>
          ))}
        </fieldset>
        <div>
          <Button type="submit" size="sm" disabled={add.isPending || !name.trim()}>
            {t('serviceDesk.addType')}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Customers({
  projectKey,
  desk,
  onChange,
}: {
  projectKey: string;
  desk: ServiceDesk;
  onChange: (desk: ServiceDesk) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query.trim(), 200);
  const found = useQuery({ ...userSearchQuery(debounced), enabled: debounced.length > 1 });
  const add = useMutation({
    mutationFn: (userId: string) =>
      unwrap(
        client.POST('/api/v1/projects/{key}/service-desk/customers', {
          params: { path: { key: projectKey } },
          body: { userId },
        }),
      ),
    onSuccess: (updated) => {
      onChange(updated);
      setQuery('');
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(
        client.DELETE('/api/v1/projects/{key}/service-desk/customers/{id}', {
          params: { path: { key: projectKey, id } },
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['project', projectKey, 'service-desk'] }),
  });
  return (
    <div className="flex flex-col gap-2">
      <h3 className="tl-label m-0 text-[var(--ink-muted)]">{t('serviceDesk.customers')}</h3>
      {(add.error || remove.error) && (
        <FormError message={(add.error ?? remove.error)?.message ?? ''} />
      )}
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {desk.customers.length === 0 && (
          <li className="text-sm text-[var(--ink-muted)]">{t('serviceDesk.noCustomers')}</li>
        )}
        {desk.customers.map((customer) => {
          const name = customer.user?.displayName ?? customer.group?.name ?? '';
          return (
            <li
              key={customer.id}
              className="flex items-center gap-1 rounded-full border border-[var(--border)] py-0.5 pr-1 pl-2.5 text-sm"
            >
              {name}
              <button
                type="button"
                aria-label={t('serviceDesk.removeCustomer', { name })}
                onClick={() => remove.mutate(customer.id)}
                className="grid size-5 place-items-center rounded-full text-[var(--ink-muted)] hover:text-[var(--danger)]"
              >
                <X size={12} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      <TextField
        label={t('serviceDesk.addCustomer')}
        help={t('serviceDesk.addCustomerHelp')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {found.data && found.data.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {found.data.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => add.mutate(user.id)}
                className="w-full rounded-[var(--radius-sm)] px-2 py-1 text-left text-sm hover:bg-[var(--surface-2)]"
              >
                {user.displayName} <span className="text-[var(--ink-muted)]">{user.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** SLA targets in working hours per priority, and the statuses that pause the clocks. */
function SlaSettings({
  projectKey,
  settings,
  busy,
  onSave,
}: {
  projectKey: string;
  settings: Settings;
  busy: boolean;
  onSave: (settings: Settings) => void;
}) {
  const { t } = useTranslation();
  const meta = useQuery(trackingMetaQuery);
  const project = useQuery(projectQuery(projectKey));
  const [first, setFirst] = useState(settings.firstResponseHours);
  const [resolution, setResolution] = useState(settings.resolutionHours);
  const [pause, setPause] = useState(settings.pauseStatusIds);
  const [dayStart, setDayStart] = useState(String(settings.dayStartHour));
  const number = (value: string) => (value === '' ? undefined : Number(value));
  const set = (
    current: Record<string, number>,
    key: string,
    value: string,
  ): Record<string, number> => {
    const next = { ...current };
    const parsed = number(value);
    if (parsed === undefined || Number.isNaN(parsed) || parsed <= 0) delete next[key];
    else next[key] = parsed;
    return next;
  };
  const cell =
    'h-8 w-20 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-right';
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          ...settings,
          firstResponseHours: first,
          resolutionHours: resolution,
          pauseStatusIds: pause,
          dayStartHour: Math.min(23, Math.max(0, Number(dayStart) || 0)),
        });
      }}
    >
      <h3 className="tl-label m-0 text-[var(--ink-muted)]">{t('serviceDesk.sla')}</h3>
      <p className="m-0 text-xs text-[var(--ink-muted)]">{t('serviceDesk.slaHelp')}</p>
      <table className="border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-[var(--ink-muted)]">
            <th className="py-1 font-medium">{t('issues.priority')}</th>
            <th className="py-1 text-right font-medium">{t('serviceDesk.firstResponse')}</th>
            <th className="py-1 text-right font-medium">{t('serviceDesk.resolution')}</th>
          </tr>
        </thead>
        <tbody>
          {(meta.data?.priorities ?? []).map((priority) => (
            <tr key={priority.key} className="border-t border-[var(--border)]">
              <th scope="row" className="py-1 text-left font-medium">
                {priority.name}
              </th>
              <td className="py-1 text-right">
                <input
                  type="number"
                  min={0}
                  step="any"
                  aria-label={`${t('serviceDesk.firstResponse')} ${priority.name}`}
                  className={cell}
                  value={first[priority.key] ?? ''}
                  onChange={(event) => setFirst(set(first, priority.key, event.target.value))}
                />
              </td>
              <td className="py-1 text-right">
                <input
                  type="number"
                  min={0}
                  step="any"
                  aria-label={`${t('serviceDesk.resolution')} ${priority.name}`}
                  className={cell}
                  value={resolution[priority.key] ?? ''}
                  onChange={(event) =>
                    setResolution(set(resolution, priority.key, event.target.value))
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <fieldset className="m-0 flex flex-wrap gap-3 border-0 p-0 text-sm">
        <legend className="tl-field-label mb-1">{t('serviceDesk.pauseStatuses')}</legend>
        {(project.data?.statuses ?? []).map((status) => (
          <label key={status.id} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={pause.includes(status.id)}
              onChange={() =>
                setPause(
                  pause.includes(status.id)
                    ? pause.filter((entry) => entry !== status.id)
                    : [...pause, status.id],
                )
              }
            />
            {status.name}
          </label>
        ))}
      </fieldset>
      <div className="max-w-48">
        <TextField
          type="number"
          min={0}
          max={23}
          label={t('serviceDesk.dayStart')}
          value={dayStart}
          onChange={(event) => setDayStart(event.target.value)}
        />
      </div>
      <div>
        <Button type="submit" disabled={busy}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
