import { queryOptions } from '@tanstack/react-query';
import { client, unwrap } from './api';

export const webhooksQuery = queryOptions({
  queryKey: ['webhooks'],
  queryFn: () => unwrap(client.GET('/api/v1/admin/webhooks')),
});

export const webhookQuery = (id: string) =>
  queryOptions({
    queryKey: ['webhooks', id],
    queryFn: () => unwrap(client.GET('/api/v1/admin/webhooks/{id}', { params: { path: { id } } })),
  });

export const webhookDeliveriesQuery = (id: string) =>
  queryOptions({
    queryKey: ['webhooks', id, 'deliveries'],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/admin/webhooks/{id}/deliveries', {
          params: { path: { id }, query: { limit: 100 } },
        }),
      ),
  });

export const timeTrackingSettingsQuery = queryOptions({
  queryKey: ['admin', 'time-tracking'],
  queryFn: () => unwrap(client.GET('/api/v1/admin/time-tracking')),
});
