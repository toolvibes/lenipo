import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  EMAIL_MODES,
  NOTIFICATION_CATEGORIES,
  type Notification,
  type NotificationCategory,
  type NotificationSettings,
} from '@tasklore/shared';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { notificationSettingsQuery, unreadCountQuery } from '../../lib/notifications';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { useFieldLabel } from '../tracking/fieldLabel';

/** One sentence per notification, e.g. "Mira Kaya hat Sie erwähnt". */
export function useDescribe() {
  const { t } = useTranslation();
  const label = useFieldLabel();
  return (notification: Notification): { title: string; detail: string | null } => {
    const actor = notification.actor?.displayName ?? t('notifications.someone');
    const { details, category } = notification;
    // Inline comments on a wiki page name the passage first (E-63).
    const excerpt = details.quote
      ? `„${details.quote}“ · ${details.excerpt ?? ''}`
      : (details.excerpt ?? null);
    if (category === 'mention') {
      return { title: t('notifications.mentioned', { actor }), detail: excerpt };
    }
    if (details.kind === 'commented') {
      return {
        title: notification.page
          ? t('notifications.commentedPage', { actor })
          : t('notifications.commented', { actor }),
        detail: excerpt,
      };
    }
    if (details.kind === 'published') {
      return {
        title:
          details.version === 1
            ? t('notifications.publishedFirst', { actor })
            : t('notifications.published', { actor, version: details.version ?? 1 }),
        detail: details.excerpt ?? null,
      };
    }
    if (details.kind === 'created') {
      return {
        title:
          category === 'assigned'
            ? t('notifications.createdAssigned', { actor })
            : t('notifications.created', { actor }),
        detail: null,
      };
    }
    const changes = details.items
      .map((item) =>
        item.field === 'description'
          ? t('issues.descriptionChanged')
          : `${label.name(item.field)}: ${t('issues.changedFrom', {
              from: label.value(item.field, item.from),
              to: label.value(item.field, item.to),
            })}`,
      )
      .join(' · ');
    return {
      title:
        category === 'assigned'
          ? t('notifications.assigned', { actor })
          : t('notifications.updated', { actor }),
      detail: changes || null,
    };
  };
}

/** E-mail settings; `onDone` adds a back button (notifications page), the profile embeds it without. */
/** 0–23, for the digest hour. */
const HOURS = [...Array(24).keys()];

export function Settings({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settings = useQuery(notificationSettingsQuery);
  const save = useMutation({
    mutationFn: (next: Omit<NotificationSettings, 'emailAvailable'>) =>
      unwrap(client.PUT('/api/v1/me/notification-settings', { body: next })),
    onSuccess: (saved) => queryClient.setQueryData(notificationSettingsQuery.queryKey, saved),
  });
  const data = settings.data;
  if (!data) return <p className="text-[var(--ink-muted)]">{t('common.loading')}</p>;

  const update = (patch: Partial<Omit<NotificationSettings, 'emailAvailable'>>) =>
    save.mutate({
      emailEnabled: data.emailEnabled,
      emailCategories: data.emailCategories,
      emailMode: data.emailMode,
      digestHour: data.digestHour,
      notifyOwnChanges: data.notifyOwnChanges,
      ...patch,
    });
  const toggle = (category: NotificationCategory, on: boolean) =>
    update({
      emailCategories: on
        ? [...data.emailCategories, category]
        : data.emailCategories.filter((entry) => entry !== category),
    });

  return (
    <div className="flex flex-col gap-4">
      {save.error && <FormError message={save.error.message} />}
      <p className="text-[var(--ink-muted)]">{t('notifications.settingsIntro')}</p>
      {!data.emailAvailable && (
        <p className="rounded-[var(--radius-md)] bg-[var(--warning-soft)] px-3 py-2">
          {t('notifications.noMailServer')}
        </p>
      )}
      <label className="flex items-center gap-2 font-semibold">
        <input
          type="checkbox"
          checked={data.emailEnabled}
          disabled={!data.emailAvailable}
          onChange={(event) => update({ emailEnabled: event.target.checked })}
        />
        {t('notifications.emailEnabled')}
      </label>
      <fieldset
        disabled={!data.emailAvailable || !data.emailEnabled}
        className="m-0 flex flex-col gap-1.5 border-0 p-0 pl-6 disabled:opacity-55"
      >
        <legend className="tl-label mb-1 text-[var(--ink-muted)]">
          {t('notifications.emailFor')}
        </legend>
        {NOTIFICATION_CATEGORIES.map((category) => (
          <label key={category} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.emailCategories.includes(category)}
              onChange={(event) => toggle(category, event.target.checked)}
            />
            {t(`notifications.categories.${category}`)}
          </label>
        ))}
      </fieldset>
      <fieldset
        disabled={!data.emailAvailable || !data.emailEnabled}
        className="m-0 flex flex-col gap-1.5 border-0 p-0 pl-6 disabled:opacity-55"
      >
        <legend className="tl-label mb-1 text-[var(--ink-muted)]">
          {t('notifications.emailWhen')}
        </legend>
        {EMAIL_MODES.map((mode) => (
          <label key={mode} className="flex items-center gap-2">
            <input
              type="radio"
              name="email-mode"
              checked={data.emailMode === mode}
              onChange={() => update({ emailMode: mode })}
            />
            {t(`notifications.modes.${mode}`)}
          </label>
        ))}
        {data.emailMode !== 'immediate' && (
          <label className="flex items-center gap-2 pl-6">
            {t('notifications.digestAt')}
            <select
              value={data.digestHour}
              onChange={(event) => update({ digestHour: Number(event.target.value) })}
              className="h-7 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-1"
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {`${String(hour).padStart(2, '0')}:00`}
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={data.notifyOwnChanges}
          onChange={(event) => update({ notifyOwnChanges: event.target.checked })}
        />
        {t('notifications.ownChanges')}
      </label>
      {onDone && (
        <div>
          <Button onClick={onDone}>{t('notifications.back')}</Button>
        </div>
      )}
    </div>
  );
}

/** "Benachrichtigungen" in the sidebar with the unread count; opens the page (P-NTF-01, S10). */
export function NotificationBell({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const unread = useQuery(unreadCountQuery);
  const count = unread.data?.count ?? 0;
  return (
    <Link
      to="/notifications"
      search={{}}
      aria-current={active ? 'page' : undefined}
      aria-label={
        count > 0 ? t('notifications.openWithCount', { count }) : t('notifications.title')
      }
      className={`flex h-[30px] items-center gap-2 rounded-[5px] px-2.5 text-[13.5px] font-medium text-[var(--ink-muted)] no-underline hover:bg-[var(--selected)] hover:text-[var(--ink)] ${active ? 'bg-[var(--selected)] font-semibold text-[var(--ink)]' : ''}`}
    >
      <span className="flex-1">{t('notifications.title')}</span>
      {count > 0 && (
        <span
          aria-hidden
          className="rounded-[4px] bg-[var(--accent)] px-1.5 font-[family-name:var(--font-mono)] text-[11px] font-semibold text-[var(--on-accent)]"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
