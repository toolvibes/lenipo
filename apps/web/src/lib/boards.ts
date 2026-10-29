import { queryOptions } from '@tanstack/react-query';
import { client, unwrap } from './api';

export const boardsQuery = (project?: string) =>
  queryOptions({
    queryKey: ['boards', project ?? null],
    queryFn: () =>
      unwrap(client.GET('/api/v1/boards', { params: { query: project ? { project } : {} } })),
  });

/** The board with its cards; `filters` are quick filter ids, "mine" or "recent" (E-53). */
export const boardDataQuery = (id: string, filters: string[]) =>
  queryOptions({
    queryKey: ['board', id, 'issues', filters],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/boards/{id}/issues', {
          params: {
            path: { id },
            query: filters.length > 0 ? { filters: filters.join(',') } : {},
          },
        }),
      ),
    placeholderData: (previous) => previous,
  });
