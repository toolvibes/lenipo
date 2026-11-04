import { GearSix } from '@phosphor-icons/react';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { Notification } from '@toolvibes/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDate, formatDateTime, formatRelative } from '../../lib/format';
import { unreadCountQuery } from '../../lib/notifications';
import { buttonClass } from '../../ui/Button';
import { Avatar } from '../tracking/UserPicker';
import { Settings, useDescribe } from './NotificationBell';

export type NotificationTab = 'unread' | 'mention' | 'assigned' | 'all';
const TABS: NotificationTab[] = ['unread', 'mention', 'assigned', 'all'];

/** Under ['notifications', …], so marking read refreshes it like every other list. */
const listQuery = (tab: NotificationTab) =>
  queryOptions({
    queryKey: ['notifications', 'page', tab],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/me/notifications', {
          params: {
            query:
              tab === 'mention' || tab === 'assigned'
                ? { category: tab, limit: 50 }
                : { unread: tab === 'unread' ? 'true' : 'false', limit: 50 },
          },
        }),
      ),
  });

/** "Heute", "Gestern" or the date: the groups of the list. */
function useDayLabel() {
  const { t } = useTranslation();
  return (iso: string) => {
    const day = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (day.toDateString() === today.toDateString()) return t('notifications.today');
    if (day.toDateString() === yesterday.toDateString()) return t('notifications.yesterday');
    return formatDate(iso.slice(0, 10));
  };
}

function Detail({ notification }: { notification: Notification }) {
  const { t } = useTranslation();
  const describe = useDescribe();
  const { title, detail } = describe(notification);
  const target = notification.page
    ? {
        to: '/spaces/$key/pages/$id',
        params: { key: notification.page.spaceKey, id: notification.page.id },
      }
    : notification.issue
      ? { to: '/issues/$key', params: { key: notification.issue.key } }
      : notification.sprint
        ? { to: '/boards/$id/backlog', params: { id: notification.sprint.boardId } }
        : notification.agent
          ? { to: '/agents/$id', params: { id: notification.agent.id } }
          : null;
  return (
    <div className="flex flex-col gap-4">
      <span className="font-[family-name:var(--font-mono)] text-[11.5px] font-medium text-[var(--ink-muted)]">
        {notification.issue
          ? `${notification.issue.key} · ${notification.issue.summary}`
          : notification.page
            ? `${notification.page.spaceKey} · ${notification.page.title}`
            : (notification.sprint?.name ?? notification.agent?.displayName)}
      </span>
      <div className="flex gap-3">
        {notification.actor ? (
          <Avatar user={notification.actor} size={32} />
        ) : (
          <span className="size-8 shrink-0" aria-hidden />
        )}
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[13.5px]">
            <span className="font-semibold">{title}</span>{' '}
            <span
              className="text-[var(--ink-muted)]"
              title={formatDateTime(notification.createdAt)}
            >
              {formatRelative(notification.createdAt)}
            </span>
          </span>
          {detail && (
            <div className="max-w-[560px] rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3.5 py-3 text-sm leading-relaxed whitespace-pre-wrap">
              {detail}
            </div>
          )}
        </div>
      </div>
      {target && (
        <div className="pl-11">
          <Link {...target} className={buttonClass('primary')}>
            {t('notifications.open')}
          </Link>
        </div>
      )}
    </div>
  );
}

/** All notifications as a page (1a S10): grouped by day on the left, the chosen one on the right. */
export function NotificationsPage({ tab }: { tab: NotificationTab }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const describe = useDescribe();
  const dayLabel = useDayLabel();
  const unread = useQuery(unreadCountQuery);
  const list = useQuery(listQuery(tab));
  const [selected, setSelected] = useState<Notification | null>(null);
  const [settings, setSettings] = useState(false);
  const count = unread.data?.count ?? 0;

  const markRead = useMutation({
    mutationFn: (body: { ids?: number[]; all?: boolean }) =>
      unwrap(client.POST('/api/v1/me/notifications/read', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const pick = (notification: Notification) => {
    setSettings(false);
    // Kept locally, so it stays open after "unread" drops it from the list.
    setSelected({ ...notification, read: true });
    if (!notification.read) markRead.mutate({ ids: [notification.id] });
  };

  const notifications = list.data?.notifications ?? [];
  const groups: Array<{ label: string; items: Notification[] }> = [];
  for (const notification of notifications) {
    const label = dayLabel(notification.createdAt);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(notification);
    else groups.push({ label, items: [notification] });
  }

  return (
    <main className="flex min-h-full flex-wrap">
      <section
        aria-label={t('notifications.title')}
        className="flex min-w-0 flex-[1_1_380px] flex-col border-r border-[var(--border)] lg:max-w-[460px]"
      >
        <div className="flex items-center gap-2 px-5 pt-[22px] pb-3">
          <h1 className="m-0 flex-1 text-xl font-semibold tracking-[-0.01em]">
            {t('notifications.title')}
          </h1>
          <button
            type="button"
            disabled={count === 0 || markRead.isPending}
            onClick={() => markRead.mutate({ all: true })}
            className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-medium text-[var(--accent)] hover:underline disabled:cursor-default disabled:text-[var(--ink-muted)] disabled:no-underline"
          >
            {t('notifications.markAllRead')}
          </button>
          <button
            type="button"
            aria-label={t('notifications.settings')}
            title={t('notifications.settings')}
            aria-pressed={settings}
            onClick={() => setSettings((open) => !open)}
            className="grid size-7 place-items-center rounded-[var(--radius-md)] border-0 bg-transparent text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] aria-pressed:bg-[var(--selected)] aria-pressed:text-[var(--ink)]"
          >
            <GearSix size={16} aria-hidden />
          </button>
        </div>
        <div role="tablist" className="flex gap-[18px] border-b border-[var(--border)] px-5">
          {TABS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() =>
                void navigate({
                  to: '/notifications',
                  search: value === 'unread' ? {} : { tab: value },
                })
              }
              className="-mb-px cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-0 pb-2 text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)] aria-selected:border-[var(--accent)] aria-selected:font-bold aria-selected:text-[var(--ink)]"
            >
              {t(`notifications.tabs.${value}`)}
              {value === 'unread' && count > 0 && ` ${count}`}
            </button>
          ))}
        </div>

        {list.data && notifications.length === 0 && (
          <p className="m-0 px-5 py-8 text-center text-[var(--ink-muted)]">
            {tab === 'unread' ? t('notifications.noneUnread') : t('notifications.none')}
          </p>
        )}
        {groups.map((group) => (
          <div key={group.label}>
            <h2 className="tl-label m-0 px-5 pt-3.5 pb-1.5 text-[var(--ink-muted)]">
              {group.label}
            </h2>
            <ul className="m-0 list-none p-0">
              {group.items.map((notification) => {
                const { title } = describe(notification);
                const active = selected?.id === notification.id;
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => pick(notification)}
                      className={`flex w-full cursor-pointer gap-[11px] border-0 border-l-2 px-5 py-[11px] text-left hover:bg-[var(--surface-2)] ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--selected)]'
                          : 'border-transparent bg-transparent'
                      }`}
                    >
                      {notification.actor ? (
                        <Avatar user={notification.actor} size={28} />
                      ) : (
                        <span className="size-7 shrink-0" aria-hidden />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        <span
                          className={`text-[13.5px] leading-[1.4] ${notification.read ? '' : 'font-semibold'}`}
                        >
                          {title}
                        </span>
                        <span className="truncate text-xs text-[var(--ink-muted)]">
                          <span className="font-[family-name:var(--font-mono)]">
                            {notification.issue?.key ?? notification.page?.spaceKey}
                          </span>{' '}
                          {notification.issue?.summary ??
                            notification.page?.title ??
                            notification.sprint?.name ??
                            notification.agent?.displayName}{' '}
                          ·{' '}
                          <span title={formatDateTime(notification.createdAt)}>
                            {formatRelative(notification.createdAt)}
                          </span>
                        </span>
                      </span>
                      {!notification.read && (
                        <span className="mt-1.5 size-[7px] shrink-0 rounded-full bg-[var(--accent)]">
                          <span className="sr-only">{t('notifications.unreadMarker')}</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <section
        aria-label={settings ? t('notifications.settings') : undefined}
        className="flex min-w-0 flex-[999_1_420px] flex-col gap-4 bg-[color-mix(in_srgb,var(--surface-2)_40%,var(--surface-1))] px-9 py-7"
      >
        {settings ? (
          <>
            <h2 className="tl-heading-md m-0">{t('notifications.settings')}</h2>
            <div className="max-w-[560px]">
              <Settings onDone={() => setSettings(false)} />
            </div>
          </>
        ) : selected ? (
          <Detail notification={selected} />
        ) : (
          <p className="m-0 text-[var(--ink-muted)]">{t('notifications.pick')}</p>
        )}
      </section>
    </main>
  );
}
