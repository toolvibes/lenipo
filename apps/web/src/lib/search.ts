import { queryOptions } from '@tanstack/react-query';
import type { FilterScope } from '@toolvibes/shared';
import { client, unwrap } from './api';

export const SEARCH_PAGE_SIZE = 50;

export const searchQuery = (query: string, offset: number) =>
  queryOptions({
    queryKey: ['search', query, offset],
    queryFn: () =>
      unwrap(
        client.POST('/api/v1/search', {
          body: { query, offset, limit: SEARCH_PAGE_SIZE },
        }),
      ),
    placeholderData: (previous) => previous,
    // An invalid query stays invalid; retrying only delays the error.
    retry: false,
  });

export const valueSuggestionsQuery = (field: string, prefix: string, limit = 15) =>
  queryOptions({
    queryKey: ['search-suggestions', field, prefix, limit],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/search/suggestions', {
          params: { query: { field, prefix, limit } },
        }),
      ),
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });

export const filtersQuery = (scope: FilterScope = 'visible') =>
  queryOptions({
    queryKey: ['filters', scope],
    queryFn: () => unwrap(client.GET('/api/v1/filters', { params: { query: { scope } } })),
  });

export const filterQuery = (id: string) =>
  queryOptions({
    queryKey: ['filter', id],
    queryFn: () => unwrap(client.GET('/api/v1/filters/{id}', { params: { path: { id } } })),
  });

export type EverythingType = 'issue' | 'page' | 'project' | 'space';

/** Global search over issues, wiki pages, projects and spaces (E-69); by meaning (TL-49). */
export const everythingQuery = (
  q: string,
  type?: EverythingType,
  project?: string,
  semantic = false,
) =>
  queryOptions({
    queryKey: ['search-everything', q, type, project, semantic],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/search/everything', {
          params: {
            query: {
              q,
              type,
              project,
              limit: type ? 50 : 10,
              semantic: semantic ? 'true' : 'false',
            },
          },
        }),
      ),
    enabled: q.trim() !== '',
    placeholderData: (previous) => previous,
  });

/** Whether the search by meaning is set up (TL-49). */
export const semanticStatusQuery = queryOptions({
  queryKey: ['search', 'semantic-status'],
  queryFn: () => unwrap(client.GET('/api/v1/search/semantic-status')),
  staleTime: 5 * 60_000,
});
