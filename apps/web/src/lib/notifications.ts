import { queryOptions } from '@tanstack/react-query';
import { client, unwrap } from './api';

/** Polled (E-44): every 30 seconds and whenever the window regains focus. */
export const unreadCountQuery = queryOptions({
  queryKey: ['notifications', 'unread-count'],
  queryFn: () => unwrap(client.GET('/api/v1/me/notifications/unread-count')),
  refetchInterval: 30_000,
  refetchOnWindowFocus: true,
});

export const notificationsQuery = (unread: boolean) =>
  queryOptions({
    queryKey: ['notifications', 'list', unread],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/me/notifications', {
          params: { query: { unread: unread ? 'true' : 'false', limit: 50 } },
        }),
      ),
  });

export const notificationSettingsQuery = queryOptions({
  queryKey: ['notifications', 'settings'],
  queryFn: () => unwrap(client.GET('/api/v1/me/notification-settings')),
});
