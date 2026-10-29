import { queryOptions } from '@tanstack/react-query';
import type { FilterScope } from '@tasklore/shared';
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

export const valueSuggestionsQuery = (field: string, prefix: string) =>
  queryOptions({
    queryKey: ['search-suggestions', field, prefix],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/search/suggestions', {
          params: { query: { field, prefix, limit: 15 } },
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
