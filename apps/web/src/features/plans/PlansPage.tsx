import { Plus } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { Plan } from '@toolvibes/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { projectsQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';

export const plansQuery = {
  queryKey: ['plans'],
  queryFn: () => unwrap(client.GET('/api/v1/plans')),
};

/** Name, projects and TQL of a plan; for creating and for changing one (TL-46). */
export function PlanDialog({
  plan,
  open,
  onOpenChange,
}: {
  plan?: Plan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const projects = useQuery({ ...projectsQuery, enabled: open });
  const [name, setName] = useState(plan?.name ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [tql, setTql] = useState(plan?.tql ?? '');
  const [chosen, setChosen] = useState<string[]>(plan?.projects.map((entry) => entry.key) ?? []);
  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), description, tql, projectKeys: chosen };
      return plan
        ? unwrap(client.PATCH('/api/v1/plans/{id}', { params: { path: { id: plan.id } }, body }))
        : unwrap(client.POST('/api/v1/plans', { body }));
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
      await queryClient.invalidateQueries({ queryKey: ['plan', saved.id] });
      onOpenChange(false);
      if (!plan) await navigate({ to: '/plans/$id', params: { id: saved.id } });
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() && chosen.length > 0) save.mutate();
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={plan ? t('plans.edit') : t('plans.create')}
      width={520}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {save.error && <FormError message={save.error.message} />}
        <TextField
          label={t('plans.name')}
          value={name}
          required
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label={t('plans.description')}
          value={description}
          maxLength={2000}
          onChange={(event) => setDescription(event.target.value)}
        />
        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="tl-field-label mb-1">{t('plans.projects')}</legend>
          {(projects.data ?? []).map((project) => (
            <label key={project.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={chosen.includes(project.key)}
                onChange={(event) =>
                  setChosen(
                    event.target.checked
                      ? [...chosen, project.key]
                      : chosen.filter((key) => key !== project.key),
                  )
                }
              />
              {project.name} <span className="tl-key text-[var(--ink-muted)]">{project.key}</span>
            </label>
          ))}
        </fieldset>
        <TextField
          label={t('plans.tql')}
          help={t('plans.tqlHelp')}
          value={tql}
          className="font-[family-name:var(--font-mono)]"
          onChange={(event) => setTql(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={save.isPending || !name.trim() || chosen.length === 0}
          >
            {plan ? t('common.save') : t('plans.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** All plans (T-RDM-03, TL-46, E-136). */
export function PlansPage() {
  const { t } = useTranslation();
  const plans = useQuery(plansQuery);
  const [creating, setCreating] = useState(false);
  return (
    <main className="flex flex-col gap-5 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="tl-heading-xl">{t('plans.title')}</h1>
          <p className="m-0 max-w-2xl text-[var(--ink-muted)]">{t('plans.intro')}</p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16} aria-hidden />
          {t('plans.create')}
        </Button>
      </header>
      {plans.data?.length === 0 && <p className="text-[var(--ink-muted)]">{t('plans.none')}</p>}
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 p-0">
        {plans.data?.map((plan) => (
          <li key={plan.id}>
            <Link
              to="/plans/$id"
              params={{ id: plan.id }}
              className="flex h-full flex-col gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-4 text-[var(--ink)] no-underline hover:border-[var(--border-strong)]"
            >
              <strong className="font-semibold">{plan.name}</strong>
              {plan.description && (
                <span className="line-clamp-2 text-sm text-[var(--ink-muted)]">
                  {plan.description}
                </span>
              )}
              <span className="mt-auto text-xs text-[var(--ink-muted)]">
                {plan.projects.map((project) => project.key).join(' · ')}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {creating && <PlanDialog open onOpenChange={setCreating} />}
    </main>
  );
}
