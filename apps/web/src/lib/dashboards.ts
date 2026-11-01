import { queryOptions } from '@tanstack/react-query';
import type { DashboardScope, StatisticsRequest } from '@toolvibes/shared';
import { client, unwrap } from './api';

export const dashboardsQuery = (scope: DashboardScope = 'visible') =>
  queryOptions({
    queryKey: ['dashboards', scope],
    queryFn: () => unwrap(client.GET('/api/v1/dashboards', { params: { query: { scope } } })),
  });

export const dashboardQuery = (id: string) =>
  queryOptions({
    queryKey: ['dashboard', id],
    queryFn: () => unwrap(client.GET('/api/v1/dashboards/{id}', { params: { path: { id } } })),
  });

export const statisticsQuery = (request: StatisticsRequest) =>
  queryOptions({
    queryKey: ['statistics', request],
    queryFn: () => unwrap(client.POST('/api/v1/reports/statistics', { body: request })),
    retry: false,
  });

export const createdResolvedQuery = (query: string, days: number) =>
  queryOptions({
    queryKey: ['created-vs-resolved', query, days],
    queryFn: () =>
      unwrap(client.POST('/api/v1/reports/created-vs-resolved', { body: { query, days } })),
    retry: false,
  });
