import { CheckCircle, Info, XCircle } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import {
  type AccessCheckRequest,
  type AccessCheckStep,
  PROJECT_PERMISSIONS,
  SPACE_PERMISSIONS,
} from '@toolvibes/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';

type Target = 'project' | 'issue' | 'space' | 'page';

/** "Why may X not do this?" for global administrators (TL-15, P-PRM-05, E-96). */
export function AccessCheckPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState('');
  const [target, setTarget] = useState<Target>('issue');
  const [key, setKey] = useState('');
  const [permission, setPermission] = useState<string>('browse');
  const tracking = target === 'project' || target === 'issue';
  const check = useMutation({
    mutationFn: () => {
      const body: AccessCheckRequest = {
        user: user.trim(),
        ...(target === 'project' ? { projectKey: key.trim() } : {}),
        ...(target === 'issue' ? { issueKey: key.trim() } : {}),
        ...(target === 'space' ? { spaceKey: key.trim() } : {}),
        ...(target === 'page' ? { pageId: key.trim().split('/').pop() ?? '' } : {}),
        ...(tracking
          ? { permission: permission as AccessCheckRequest['permission'] }
          : { spacePermission: permission as AccessCheckRequest['spacePermission'] }),
      };
      return unwrap(client.POST('/api/v1/admin/access-check', { body }));
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    check.mutate();
  }
  const permissions = tracking
    ? PROJECT_PERMISSIONS.map((value) => ({ value, label: t(`schemes.permissions.${value}`) }))
    : SPACE_PERMISSIONS.map((value) => ({ value, label: t(`access.space.${value}`) }));

  const via = (step: AccessCheckStep) =>
    step.params.via ? t('access.via', { group: step.params.via }) : '';
  const grantee = (value: string) => {
    const [kind, name = ''] = value.split(':');
    if (kind === 'role') return t(`projectSettings.roles.${name as 'users'}`);
    if (kind === 'group') return t('access.group', { name });
    if (kind === 'special') return t(name === 'reporter' ? 'issues.reporter' : 'issues.assignee');
    return name;
  };
  const describe = (step: AccessCheckStep): string => {
    const p = step.params;
    switch (step.code) {
      case 'role':
        return t('access.steps.role', {
          role: t(`projectSettings.roles.${p.role as 'users'}`),
          via: via(step),
        });
      case 'space-role':
        return t('access.steps.spaceRole', {
          role: t(`wiki.roles.${p.role as 'viewers'}`),
          via: via(step),
        });
      case 'grant':
        return t('access.steps.grant', {
          scheme: p.scheme ?? '',
          permission: t(`schemes.permissions.${p.permission as 'browse'}`),
          grantee: grantee(p.grantee ?? ''),
        });
      case 'no-grant':
        return t('access.steps.noGrant', {
          scheme: p.scheme ?? '',
          permission: t(`schemes.permissions.${p.permission as 'browse'}`),
          grantees:
            (p.grantees ?? '').split(', ').filter(Boolean).map(grantee).join(', ') ||
            t('access.nobody'),
        });
      case 'space-permission':
        return t('access.steps.spacePermission', {
          permission: t(`access.space.${p.permission as 'view'}`),
          space: p.space ?? '',
        });
      case 'security':
      case 'page-view':
      case 'page-edit':
        return t(`access.steps.${step.code}.${step.passed ? 'in' : 'out'}`, {
          level: p.level ?? '',
          page: p.page ?? '',
        });
      default:
        return t(`access.steps.${step.code as 'inactive'}`, {
          project: p.project ?? '',
          space: p.space ?? '',
        });
    }
  };

  return (
    <main className="flex max-w-[880px] flex-col gap-5 px-8 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="tl-heading-xl m-0">{t('access.title')}</h1>
        <p className="m-0 text-sm text-[var(--ink-muted)]">{t('access.intro')}</p>
      </header>
      <form
        onSubmit={submit}
        className="flex flex-wrap items-end gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3"
      >
        <TextField
          label={t('access.user')}
          value={user}
          required
          placeholder="name@example.org"
          onChange={(event) => setUser(event.target.value)}
        />
        <Select
          label={t('access.target')}
          value={target}
          options={(['issue', 'project', 'page', 'space'] as const).map((value) => ({
            value,
            label: t(`access.targets.${value}`),
          }))}
          onChange={(event) => {
            const next = event.target.value as Target;
            setTarget(next);
            setPermission(next === 'project' || next === 'issue' ? 'browse' : 'view');
          }}
        />
        <TextField
          label={t(`access.keys.${target}`)}
          value={key}
          required
          onChange={(event) => setKey(event.target.value)}
        />
        <Select
          label={t('access.permission')}
          value={permission}
          options={permissions}
          onChange={(event) => setPermission(event.target.value)}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!user.trim() || !key.trim() || check.isPending}
        >
          {t('access.check')}
        </Button>
      </form>
      {check.error && <FormError message={check.error.message} />}
      {check.data && (
        <section className="flex flex-col gap-3">
          <p
            className={`m-0 flex items-center gap-2 text-[15px] font-semibold ${check.data.granted ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}
          >
            {check.data.granted ? (
              <CheckCircle size={20} weight="fill" aria-hidden />
            ) : (
              <XCircle size={20} weight="fill" aria-hidden />
            )}
            {t(check.data.granted ? 'access.granted' : 'access.denied', {
              name: check.data.user.displayName,
            })}
          </p>
          <ol className="m-0 flex flex-col gap-1.5 pl-0">
            {check.data.steps.map((step, index) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: steps have no identity of their own
                key={index}
                className="flex items-start gap-2 text-[13.5px]"
              >
                <span
                  className={`mt-0.5 ${step.passed === true ? 'text-[var(--success)]' : step.passed === false ? 'text-[var(--danger)]' : 'text-[var(--ink-muted)]'}`}
                >
                  {step.passed === true ? (
                    <CheckCircle size={16} aria-label={t('access.passed')} />
                  ) : step.passed === false ? (
                    <XCircle size={16} aria-label={t('access.failed')} />
                  ) : (
                    <Info size={16} aria-hidden />
                  )}
                </span>
                {describe(step)}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
