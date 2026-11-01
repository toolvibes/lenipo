import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  AUTOMATION_TEMPLATES,
  type AutomationComponent,
  type AutomationRule,
  type AutomationTrigger,
  type AutomationTriggerType,
  GIT_EVENTS,
} from '@toolvibes/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { TopBar } from '../../ui/TopBar';
import { ComponentsEditor } from './ComponentsEditor';

const TRIGGERS: AutomationTriggerType[] = [
  'issue-created',
  'issue-updated',
  'issue-transitioned',
  'field-changed',
  'comment-added',
  'sprint-started',
  'sprint-completed',
  'version-released',
  'schedule',
  'incoming-webhook',
  'git',
];

function triggerOf(type: AutomationTriggerType): AutomationTrigger {
  switch (type) {
    case 'issue-transitioned':
      return { type, from: '', to: '' };
    case 'field-changed':
      return { type, fields: ['priority'] };
    case 'schedule':
      return { type, cron: '0 8 * * 1-5', query: '' };
    case 'git':
      return { type, event: 'pull_request_merged' };
    default:
      return { type } as AutomationTrigger;
  }
}

function TriggerFields({
  trigger,
  onChange,
}: {
  trigger: AutomationTrigger;
  onChange: (trigger: AutomationTrigger) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Select
        label={t('automation.trigger')}
        value={trigger.type}
        options={TRIGGERS.map((type) => ({ value: type, label: t(`automation.triggers.${type}`) }))}
        onChange={(event) => onChange(triggerOf(event.target.value as AutomationTriggerType))}
      />
      {trigger.type === 'issue-transitioned' && (
        <>
          <TextField
            label={t('automation.fields.fromStatus')}
            value={trigger.from}
            placeholder={t('automation.any')}
            onChange={(event) => onChange({ ...trigger, from: event.target.value })}
          />
          <TextField
            label={t('automation.fields.toStatus')}
            value={trigger.to}
            placeholder={t('automation.any')}
            onChange={(event) => onChange({ ...trigger, to: event.target.value })}
          />
        </>
      )}
      {trigger.type === 'field-changed' && (
        <TextField
          label={t('automation.fields.fields')}
          help={t('automation.fields.fieldsHelp')}
          value={trigger.fields.join(', ')}
          onChange={(event) =>
            onChange({
              ...trigger,
              fields: event.target.value
                .split(/[,\s]+/)
                .map((field) => field.trim())
                .filter(Boolean),
            })
          }
        />
      )}
      {trigger.type === 'git' && (
        <Select
          label={t('git.event')}
          value={trigger.event}
          options={GIT_EVENTS.map((event) => ({ value: event, label: t(`git.events.${event}`) }))}
          onChange={(event) =>
            onChange({ type: 'git', event: event.target.value as (typeof GIT_EVENTS)[number] })
          }
        />
      )}
      {trigger.type === 'schedule' && (
        <>
          <TextField
            label={t('automation.fields.cron')}
            help={t('automation.fields.cronHelp')}
            value={trigger.cron}
            className="font-[family-name:var(--font-mono)]"
            onChange={(event) => onChange({ ...trigger, cron: event.target.value })}
          />
          <div className="sm:col-span-2">
            <TextField
              label={t('automation.fields.scheduleQuery')}
              help={t('automation.fields.scheduleQueryHelp')}
              value={trigger.query}
              className="font-[family-name:var(--font-mono)]"
              onChange={(event) => onChange({ ...trigger, query: event.target.value })}
            />
          </div>
        </>
      )}
      <p className="m-0 text-xs text-[var(--ink-muted)] sm:col-span-2">
        {t(`automation.triggerHelp.${trigger.type}`)}
      </p>
    </div>
  );
}

function Runs({ id }: { id: string }) {
  const { t } = useTranslation();
  const runs = useQuery({
    queryKey: ['automation', 'runs', id],
    queryFn: () =>
      unwrap(client.GET('/api/v1/automation/rules/{id}/runs', { params: { path: { id } } })),
    refetchInterval: 10_000,
  });
  return (
    <section className="flex flex-col gap-2">
      <h2 className="tl-heading-md m-0">{t('automation.log')}</h2>
      {runs.data?.length === 0 && (
        <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('automation.noRuns')}</p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {(runs.data ?? []).map((run) => (
          <li key={run.id} className="border-b border-[var(--border)] py-2 text-[13px]">
            <details>
              <summary className="cursor-pointer">
                <span
                  className={
                    run.status === 'success'
                      ? 'font-semibold text-[var(--success)]'
                      : run.status === 'no-match'
                        ? 'font-semibold text-[var(--ink-muted)]'
                        : 'font-semibold text-[var(--danger)]'
                  }
                >
                  {t(`automation.status.${run.status}`)}
                </span>{' '}
                · {formatDateTime(run.startedAt)} · {run.trigger}
                {run.issueKey && ` · ${run.issueKey}`} · {run.durationMs} ms
              </summary>
              <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 pl-4 text-xs">
                {run.log.map((line, index) => (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: log lines are positional
                    key={index}
                    className={
                      line.level === 'error' ? 'text-[var(--danger)]' : 'text-[var(--ink-muted)]'
                    }
                  >
                    {line.message}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface Draft {
  name: string;
  description: string;
  enabled: boolean;
  allowSelfTrigger: boolean;
  trigger: AutomationTrigger;
  components: AutomationComponent[];
}

function Editor({
  rule,
  projectKey,
  initial,
}: {
  rule?: AutomationRule;
  projectKey: string | null;
  initial: Draft;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(initial);
  const back = () =>
    projectKey
      ? navigate({ to: '/projects/$key/settings', params: { key: projectKey } })
      : navigate({ to: '/admin/automation' });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...draft, projectKey, components: draft.components as never };
      return rule
        ? unwrap(
            client.PUT('/api/v1/automation/rules/{id}', {
              params: { path: { id: rule.id } },
              body,
            }),
          )
        : unwrap(client.POST('/api/v1/automation/rules', { body }));
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['automation'] });
      if (!rule) await navigate({ to: '/automation/rules/$id', params: { id: saved.id } });
    },
  });
  const remove = useMutation({
    mutationFn: () =>
      unwrap(
        client.DELETE('/api/v1/automation/rules/{id}', {
          params: { path: { id: rule?.id ?? '' } },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['automation'] });
      await back();
    },
  });
  return (
    <div className="flex flex-col gap-6">
      {(save.error ?? remove.error) && (
        <FormError message={(save.error ?? remove.error)?.message ?? ''} />
      )}
      {rule?.disabledReason && <FormError message={rule.disabledReason} />}
      <section className="flex flex-col gap-3">
        <TextField
          label={t('automation.name')}
          value={draft.name}
          required
          maxLength={120}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
        <TextField
          label={t('automation.description')}
          value={draft.description}
          maxLength={1000}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        />
        <div className="flex flex-wrap gap-5 text-[13px]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
            />
            {t('automation.enabled')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.allowSelfTrigger}
              onChange={(event) => setDraft({ ...draft, allowSelfTrigger: event.target.checked })}
            />
            {t('automation.allowSelfTrigger')}
          </label>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="tl-heading-md m-0">{t('automation.when')}</h2>
        <TriggerFields
          trigger={draft.trigger}
          onChange={(trigger) => setDraft({ ...draft, trigger })}
        />
        {rule?.webhookUrl && <HookAddress rule={rule} />}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="tl-heading-md m-0">{t('automation.thenStep')}</h2>
        <p className="m-0 text-xs text-[var(--ink-muted)]">{t('automation.componentsHelp')}</p>
        <ComponentsEditor
          components={draft.components}
          onChange={(components) => setDraft({ ...draft, components })}
        />
      </section>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={!draft.name.trim() || save.isPending}
          onClick={() => save.mutate()}
        >
          {t('common.save')}
        </Button>
        {save.isSuccess && (
          <span role="status" className="self-center text-[13px] text-[var(--ink-muted)]">
            {t('automation.saved')}
          </span>
        )}
        {rule && (
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(t('automation.deleteConfirm', { name: rule.name })))
                remove.mutate();
            }}
          >
            {t('automation.delete')}
          </Button>
        )}
      </div>
      {rule && <Runs id={rule.id} />}
    </div>
  );
}

/** Creating or changing one rule (TL-22, E-103). */
export function RuleEditorPage({
  id,
  projectKey,
  template,
}: {
  id?: string;
  projectKey?: string;
  template?: string;
}) {
  const { t } = useTranslation();
  const rule = useQuery({
    queryKey: ['automation', 'rule', id],
    queryFn: async () =>
      (await unwrap(
        client.GET('/api/v1/automation/rules/{id}', { params: { path: { id: id ?? '' } } }),
      )) as AutomationRule,
    enabled: !!id,
  });
  const scope = rule.data?.project?.key ?? projectKey ?? null;
  const from = AUTOMATION_TEMPLATES.find((entry) => entry.key === template);
  const initial: Draft | null = rule.data
    ? {
        name: rule.data.name,
        description: rule.data.description,
        enabled: rule.data.enabled,
        allowSelfTrigger: rule.data.allowSelfTrigger,
        trigger: rule.data.trigger,
        components: rule.data.components,
      }
    : id
      ? null
      : {
          name: from ? t(`automation.templates.${from.key}.name` as never) : '',
          description: from ? t(`automation.templates.${from.key}.description` as never) : '',
          enabled: true,
          allowSelfTrigger: false,
          trigger: from?.trigger ?? { type: 'issue-created' },
          components: from?.components ?? [],
        };
  return (
    <>
      <TopBar
        crumbs={[
          scope ? (
            <Link
              key="scope"
              to="/projects/$key/settings"
              params={{ key: scope }}
              className="text-inherit no-underline hover:underline"
            >
              {scope}
            </Link>
          ) : (
            <Link
              key="scope"
              to="/admin/automation"
              className="text-inherit no-underline hover:underline"
            >
              {t('automation.global')}
            </Link>
          ),
          t('automation.title'),
          rule.data?.name ?? t('automation.new'),
        ]}
      />
      <main className="flex max-w-[900px] flex-col gap-4 px-6 py-6 lg:px-10">
        {rule.error && <FormError message={rule.error.message} />}
        {initial && (
          <Editor
            key={rule.data?.updatedAt ?? 'new'}
            rule={rule.data}
            projectKey={scope}
            initial={initial}
          />
        )}
      </main>
    </>
  );
}

/** The address of an incoming webhook, its secret as a header, and a new secret (TL-41). */
function HookAddress({ rule }: { rule: AutomationRule }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const rotate = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/automation/rules/{id}/webhook-token', {
          params: { path: { id: rule.id } },
        }),
      ),
    onSuccess: (updated) =>
      queryClient.setQueryData(['automation', 'rule', rule.id], updated as AutomationRule),
  });
  const address = new URL(rule.webhookUrl ?? '', window.location.origin);
  const secret = address.searchParams.get('token') ?? '';
  address.searchParams.delete('token');
  return (
    <div className="flex flex-col gap-2">
      {rotate.error && <FormError message={rotate.error.message} />}
      <TextField label={t('automation.webhookUrl')} value={address.toString()} readOnly />
      <TextField
        label={t('automation.webhookSecret')}
        help={t('automation.webhookSecretHelp')}
        value={secret}
        readOnly
      />
      <div>
        <Button
          size="sm"
          onClick={() => {
            if (window.confirm(t('automation.webhookRotateConfirm'))) rotate.mutate();
          }}
          disabled={rotate.isPending}
        >
          {t('automation.webhookRotate')}
        </Button>
      </div>
    </div>
  );
}
