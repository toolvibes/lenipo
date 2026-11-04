import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { Me, OnboardingMethod, OnboardingRequest } from '@toolvibes/shared';
import { type FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { applyLocale } from '../../i18n';
import { ApiError, client, unwrap } from '../../lib/api';
import { meQuery } from '../../lib/queries';
import { timeZones } from '../../lib/timeZones';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { LogoMark } from '../../ui/Logo';
import { TextField } from '../../ui/TextField';

const FIELD =
  'h-[var(--control-md)] rounded-[var(--radius-md)] border border-[var(--border-control)] bg-[var(--surface-1)] px-2 text-[var(--ink)]';

/** A key suggestion from a name: initials of several words, else the start of one word. */
export function suggestKey(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/Ä/g, 'AE')
    .replace(/Ö/g, 'OE')
    .replace(/Ü/g, 'UE')
    .replace(/ß/g, 'SS')
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const raw =
    words.length > 1 ? words.map((word) => word[0]).join('') : (words[0] ?? '').slice(0, 4);
  const key = raw.replace(/^[0-9]+/, '').slice(0, 10);
  return key.length >= 2 ? key : '';
}

/** The welcome steps after the first sign-in (1a S1, E-71): profile, method, first project. */
export function WelcomePage({ me }: { me: Me }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canProjects = me.globalPermissions.includes('create-projects');
  const canSpaces = me.globalPermissions.includes('create-spaces');
  const methods = (['scrum', 'kanban', 'lore'] as const).filter((method) =>
    method === 'lore' ? canSpaces : canProjects,
  );
  const total = methods.length > 0 ? 3 : 1;
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(me.displayName);
  const [locale, setLocale] = useState<'de' | 'en'>(i18n.language === 'en' ? 'en' : 'de');
  const [timeZone, setTimeZone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || me.timeZone,
  );
  const [method, setMethod] = useState<OnboardingMethod>(methods[0] ?? 'scrum');
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const zones = useMemo(() => timeZones(timeZone), [timeZone]);
  const shownKey = keyTouched ? key : suggestKey(name);

  const finish = useMutation({
    mutationFn: (body: OnboardingRequest) => unwrap(client.POST('/api/v1/me/onboarding', { body })),
    onSuccess: async (result) => {
      await queryClient.refetchQueries({ queryKey: meQuery.queryKey });
      if (result.boardId) {
        await navigate({ to: '/boards/$id', params: { id: result.boardId } });
      } else if (result.spaceKey) {
        await navigate({ to: '/spaces/$key', params: { key: result.spaceKey } });
      } else {
        await navigate({ to: '/' });
      }
    },
  });
  const profile = { displayName: displayName.trim() || me.displayName, locale, timeZone } as const;
  const error =
    finish.error instanceof ApiError && finish.error.status === 409
      ? t('welcome.taken', { key: shownKey })
      : finish.error?.message;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (step < total) setStep(step + 1);
    else if (total === 1) finish.mutate({ profile });
    else finish.mutate({ profile, start: { method, name: name.trim(), key: shownKey } });
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <main className="flex flex-col px-6 py-10 sm:px-14">
        <span className="flex items-center gap-2.5">
          <LogoMark size={24} />
          <span className="text-base font-bold">{t('common.product')}</span>
        </span>
        <div className="flex max-w-[380px] flex-1 flex-col justify-center gap-4 py-10">
          <h1 className="m-0 text-[24px] leading-[30px] font-extrabold tracking-[-0.025em]">
            {t('welcome.title', { name: profile.displayName.split(' ')[0] ?? profile.displayName })}
          </h1>
          <p className="m-0 text-sm leading-normal text-[var(--ink-muted)]">
            {methods.length > 0 ? t('welcome.intro') : t('welcome.joinOnly')}
          </p>
          <button
            type="button"
            disabled={finish.isPending}
            onClick={() => finish.mutate({})}
            className="cursor-pointer self-start border-0 bg-transparent p-0 text-[13px] font-medium text-[var(--accent)] hover:underline"
          >
            {t('welcome.skip')}
          </button>
        </div>
      </main>

      <section className="flex flex-col justify-center border-[var(--border)] bg-[var(--surface-2)] p-6 sm:p-14 md:border-l">
        <form onSubmit={submit} className="flex max-w-[520px] flex-col gap-5">
          <span className="tl-label text-[var(--ink-muted)]">
            {t('welcome.step', { step, total })}
          </span>

          {step === 1 && (
            <>
              <h2 className="m-0 text-[22px] leading-7 font-semibold tracking-[-0.015em]">
                {t('welcome.profileTitle')}
              </h2>
              <TextField
                label={t('welcome.displayName')}
                value={displayName}
                maxLength={100}
                required
                onChange={(event) => setDisplayName(event.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="tl-field-label">{t('welcome.language')}</span>
                  <select
                    value={locale}
                    onChange={(event) => {
                      setLocale(event.target.value === 'en' ? 'en' : 'de');
                      applyLocale(event.target.value);
                    }}
                    className={FIELD}
                  >
                    <option value="de">{t('welcome.languages.de')}</option>
                    <option value="en">{t('welcome.languages.en')}</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="tl-field-label">{t('welcome.timeZone')}</span>
                  <select
                    value={timeZone}
                    onChange={(event) => setTimeZone(event.target.value)}
                    className={FIELD}
                  >
                    {zones.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}

          {step === 2 && (
            <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
              <legend className="mb-3 p-0 text-[22px] leading-7 font-semibold tracking-[-0.015em]">
                {t('welcome.methodTitle')}
              </legend>
              {methods.map((value) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-3.5 rounded-lg bg-[var(--surface-1)] px-[18px] py-4 ${
                    method === value
                      ? 'border-2 border-[var(--accent)]'
                      : 'border border-[var(--border-control)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="method"
                    value={value}
                    checked={method === value}
                    onChange={() => setMethod(value)}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-[14.5px] font-semibold">
                      {t(`welcome.methods.${value}`)}
                    </span>
                    <span className="text-[13px] leading-[1.45] text-[var(--ink-muted)]">
                      {t(`welcome.methods.${value}Text`)}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {step === 3 && (
            <>
              <h2 className="m-0 text-[22px] leading-7 font-semibold tracking-[-0.015em]">
                {t(`welcome.nameTitle.${method === 'lore' ? 'space' : 'project'}`)}
              </h2>
              <p className="m-0 text-sm leading-normal text-[var(--ink-muted)]">
                {t(`welcome.nameIntro.${method === 'lore' ? 'space' : 'project'}`)}
              </p>
              <TextField
                label={t('welcome.name')}
                value={name}
                maxLength={80}
                required
                autoFocus
                onChange={(event) => setName(event.target.value)}
              />
              <TextField
                label={t('welcome.key')}
                value={shownKey}
                required
                pattern="[A-Z][A-Z0-9]{1,9}"
                maxLength={10}
                help={t('welcome.keyHelp', { key: shownKey || 'ATL' })}
                className="font-[family-name:var(--font-mono)]"
                onChange={(event) => {
                  setKeyTouched(true);
                  setKey(event.target.value.toUpperCase());
                }}
              />
              <p className="m-0 text-[13px] text-[var(--ink-muted)]">
                {t(`welcome.creates.${method}`)}
              </p>
            </>
          )}

          {error && <FormError message={error} />}
          <div className="flex justify-end gap-2.5">
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                {t('welcome.back')}
              </Button>
            )}
            <Button
              type="submit"
              disabled={finish.isPending}
              className="!bg-[var(--ink)] !text-[var(--surface-1)] hover:opacity-90"
              variant="primary"
            >
              {step < total
                ? t('welcome.next')
                : total === 1
                  ? t('welcome.finish')
                  : t('welcome.start')}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
