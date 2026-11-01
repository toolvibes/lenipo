import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { AUTOMATION_TEMPLATES, type AutomationRule } from '@toolvibes/shared';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';

export const rulesQuery = (projectKey?: string) => ({
  queryKey: ['automation', 'rules', projectKey ?? null],
  queryFn: () =>
    unwrap(
      client.GET('/api/v1/automation/rules', {
        params: { query: projectKey ? { project: projectKey } : {} },
      }),
    ),
});

/** Rules of a project, or the global ones (TL-22, E-103), with templates to start from. */
export function RulesList({ projectKey }: { projectKey?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rules = useQuery(rulesQuery(projectKey));
  const toggle = useMutation({
    mutationFn: (rule: AutomationRule) =>
      unwrap(
        client.PUT('/api/v1/automation/rules/{id}', {
          params: { path: { id: rule.id } },
          body: {
            name: rule.name,
            description: rule.description,
            projectKey: rule.project?.key ?? null,
            trigger: rule.trigger,
            components: rule.components as never,
            allowSelfTrigger: rule.allowSelfTrigger,
            enabled: !rule.enabled,
          },
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['automation', 'rules'] }),
  });
  const open = (search: { template?: string }) =>
    void navigate({ to: '/automation/new', search: { project: projectKey, ...search } });
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="tl-heading-md m-0">{t('automation.title')}</h2>
        <p className="m-0 text-sm text-[var(--ink-muted)]">
          {projectKey ? t('automation.projectIntro') : t('automation.globalIntro')}
        </p>
      </div>
      {(rules.error ?? toggle.error) && (
        <FormError message={(rules.error ?? toggle.error)?.message ?? ''} />
      )}
      <div className="flex flex-wrap items-end gap-3">
        <Button variant="primary" onClick={() => open({})}>
          {t('automation.new')}
        </Button>
        <Select
          label={t('automation.fromTemplate')}
          value=""
          options={[
            { value: '', label: t('automation.chooseTemplate') },
            ...AUTOMATION_TEMPLATES.map((template) => ({
              value: template.key,
              label: t(`automation.templates.${template.key}.name` as never),
            })),
          ]}
          onChange={(event) => event.target.value && open({ template: event.target.value })}
        />
      </div>
      {rules.data && rules.data.length === 0 && (
        <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('automation.none')}</p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {(rules.data ?? []).map((rule) => (
          <li
            key={rule.id}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] py-2.5 text-[13.5px]"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <Link
                to="/automation/rules/$id"
                params={{ id: rule.id }}
                className="font-semibold text-[var(--ink)] no-underline hover:underline"
              >
                {rule.name}
              </Link>
              <span className="text-xs text-[var(--ink-muted)]">
                {t(`automation.triggers.${rule.trigger.type}`)}
                {rule.lastRun &&
                  ` · ${t(`automation.status.${rule.lastRun.status}`)} ${formatRelative(rule.lastRun.at)}`}
                {rule.disabledReason && ` · ${rule.disabledReason}`}
              </span>
            </span>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={rule.enabled}
                disabled={toggle.isPending}
                onChange={() => toggle.mutate(rule as AutomationRule)}
              />
              {t('automation.enabled')}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
