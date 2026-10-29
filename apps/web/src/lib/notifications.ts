import { queryOptions } from '@tanstack/react-query';
import type { NotificationCategory } from '@tasklore/shared';
import { client, unwrap } from './api';

/** Live through realtime signals (E-58); polling every 5 minutes and on focus is the fallback. */
export const unreadCountQuery = queryOptions({
  queryKey: ['notifications', 'unread-count'],
  queryFn: () => unwrap(client.GET('/api/v1/me/notifications/unread-count')),
  refetchInterval: 5 * 60_000,
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

export const notificationsByCategoryQuery = (category: NotificationCategory, limit: number) =>
  queryOptions({
    queryKey: ['notifications', 'category', category, limit],
    queryFn: () =>
      unwrap(client.GET('/api/v1/me/notifications', { params: { query: { category, limit } } })),
  });
