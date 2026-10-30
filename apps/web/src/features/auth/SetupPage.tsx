import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { SetupRequest } from '@tasklore/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, client, unwrap } from '../../lib/api';
import { meQuery, setupStatusQuery } from '../../lib/queries';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';
import { AuthLayout } from './AuthLayout';

type FieldErrors = Partial<Record<string, string>>;

export function SetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    token: '',
    instanceName: '',
    displayName: '',
    email: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const setup = useMutation({
    mutationFn: (request: SetupRequest) => unwrap(client.POST('/api/v1/setup', { body: request })),
    onSuccess: async (me) => {
      queryClient.setQueryData(meQuery.queryKey, me);
      queryClient.setQueryData(setupStatusQuery.queryKey, { required: false });
      await navigate({ to: '/' });
    },
  });

  function update(field: keyof typeof form) {
    return (event: { target: { value: string } }) =>
      setForm({ ...form, [field]: event.target.value });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    // Same schema as the server, so most mistakes show before the request.
    const parsed = SetupRequest.safeParse({
      token: form.token,
      instanceName: form.instanceName,
      admin: { email: form.email, displayName: form.displayName, password: form.password },
    });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) errors[issue.path.join('.')] ??= issue.message;
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setup.mutate(parsed.data);
  }

  const codeRejected = setup.error instanceof ApiError && setup.error.status === 403;

  return (
    <AuthLayout title={t('setup.title')} subtitle={t('setup.intro')}>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {codeRejected && <FormError message={t('setup.invalidCode')} />}
        {setup.isError && !codeRejected && <FormError message={setup.error.message} />}
        <TextField
          label={t('setup.code')}
          help={t('setup.codeHelp')}
          error={fieldErrors.token}
          autoComplete="off"
          spellCheck={false}
          className="font-[family-name:var(--font-mono)]"
          value={form.token}
          onChange={update('token')}
        />
        <TextField
          label={t('setup.instanceName')}
          help={t('setup.instanceNameHelp')}
          error={fieldErrors.instanceName}
          value={form.instanceName}
          onChange={update('instanceName')}
        />
        <TextField
          label={t('setup.adminName')}
          autoComplete="name"
          error={fieldErrors['admin.displayName']}
          value={form.displayName}
          onChange={update('displayName')}
        />
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="username"
          error={fieldErrors['admin.email']}
          value={form.email}
          onChange={update('email')}
        />
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          help={t('setup.passwordHelp')}
          error={fieldErrors['admin.password']}
          value={form.password}
          onChange={update('password')}
        />
        <Button type="submit" variant="primary" disabled={setup.isPending}>
          {setup.isPending ? t('setup.submitting') : t('setup.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
