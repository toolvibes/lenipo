import { GearSix } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  NOTIFICATION_CATEGORIES,
  type Notification,
  type NotificationCategory,
  type NotificationSettings,
} from '@tasklore/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDateTime, formatRelative } from '../../lib/format';
import {
  notificationSettingsQuery,
  notificationsQuery,
  unreadCountQuery,
} from '../../lib/notifications';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { useFieldLabel } from '../tracking/fieldLabel';
import { Avatar } from '../tracking/UserPicker';

/** One sentence per notification, e.g. "Mira Kaya hat Sie erwähnt". */
function useDescribe() {
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

function Settings({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settings = useQuery(notificationSettingsQuery);
  const save = useMutation({
    mutationFn: (next: Pick<NotificationSettings, 'emailEnabled' | 'emailCategories'>) =>
      unwrap(client.PUT('/api/v1/me/notification-settings', { body: next })),
    onSuccess: (saved) => queryClient.setQueryData(notificationSettingsQuery.queryKey, saved),
  });
  const data = settings.data;
  if (!data) return <p className="text-[var(--ink-muted)]">{t('common.loading')}</p>;

  const toggle = (category: NotificationCategory, on: boolean) =>
    save.mutate({
      emailEnabled: data.emailEnabled,
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
          onChange={(event) =>
            save.mutate({
              emailEnabled: event.target.checked,
              emailCategories: data.emailCategories,
            })
          }
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
      <div className="flex justify-end">
        <Button onClick={onDone}>{t('notifications.back')}</Button>
      </div>
    </div>
  );
}

/** The bell in the sidebar with the unread count and the notification list (P-NTF-01). */
export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const describe = useDescribe();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'unread' | 'all' | 'settings'>('unread');
  const unread = useQuery(unreadCountQuery);
  const list = useQuery({
    ...notificationsQuery(view === 'unread'),
    enabled: open && view !== 'settings',
  });
  const count = unread.data?.count ?? 0;

  const markRead = useMutation({
    mutationFn: (body: { ids?: number[]; all?: boolean }) =>
      unwrap(client.POST('/api/v1/me/notifications/read', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  function openNotification(notification: Notification) {
    if (!notification.read) markRead.mutate({ ids: [notification.id] });
    setOpen(false);
    if (notification.page) {
      void navigate({
        to: '/spaces/$key/pages/$id',
        params: { key: notification.page.spaceKey, id: notification.page.id },
      });
    } else if (notification.issue) {
      void navigate({ to: '/issues/$key', params: { key: notification.issue.key } });
    }
  }

  const tab = (value: 'unread' | 'all', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === value}
      onClick={() => setView(value)}
      className={`h-8 border-b-2 px-2.5 ${view === value ? 'border-[var(--accent)] font-semibold text-[var(--accent)]' : 'border-transparent text-[var(--ink-muted)]'}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setView('unread');
          setOpen(true);
        }}
        aria-label={
          count > 0 ? t('notifications.openWithCount', { count }) : t('notifications.title')
        }
        className="flex h-[30px] items-center gap-2 rounded-[5px] px-2.5 text-left text-[13.5px] font-medium text-[var(--ink-muted)] hover:bg-[var(--selected)] hover:text-[var(--ink)]"
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
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={view === 'settings' ? t('notifications.settings') : t('notifications.title')}
        width={520}
      >
        {view === 'settings' ? (
          <Settings onDone={() => setView('unread')} />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]">
              <div role="tablist" className="flex gap-1">
                {tab('unread', t('notifications.unread'))}
                {tab('all', t('notifications.all'))}
              </div>
              <div className="flex gap-1 pb-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={count === 0 || markRead.isPending}
                  onClick={() => markRead.mutate({ all: true })}
                >
                  {t('notifications.markAllRead')}
                </Button>
                <button
                  type="button"
                  aria-label={t('notifications.settings')}
                  title={t('notifications.settings')}
                  onClick={() => setView('settings')}
                  className="grid size-8 place-items-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                >
                  <GearSix size={18} aria-hidden />
                </button>
              </div>
            </div>
            {list.data?.notifications.length === 0 && (
              <p className="py-6 text-center text-[var(--ink-muted)]">
                {view === 'unread' ? t('notifications.noneUnread') : t('notifications.none')}
              </p>
            )}
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {list.data?.notifications.map((notification) => {
                const { title, detail } = describe(notification);
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(notification)}
                      className="flex w-full gap-3 rounded-[var(--radius-md)] px-2 py-2 text-left hover:bg-[var(--surface-2)]"
                    >
                      {notification.actor ? (
                        <Avatar user={notification.actor} size={28} />
                      ) : (
                        <span className="size-7 shrink-0" aria-hidden />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className={notification.read ? '' : 'font-semibold'}>{title}</span>
                        <span className="truncate text-[var(--ink-muted)]">
                          <span className="tl-key">
                            {notification.issue?.key ?? notification.page?.spaceKey}
                          </span>{' '}
                          {notification.issue?.summary ?? notification.page?.title}
                        </span>
                        {detail && (
                          <span className="line-clamp-2 text-xs text-[var(--ink-muted)]">
                            {detail}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className="text-xs text-[var(--ink-muted)]"
                          title={formatDateTime(notification.createdAt)}
                        >
                          {formatRelative(notification.createdAt)}
                        </span>
                        {!notification.read && (
                          <span className="size-2 rounded-full bg-[var(--accent)]">
                            <span className="sr-only">{t('notifications.unreadMarker')}</span>
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Dialog>
    </>
  );
}
