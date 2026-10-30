import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  DEFAULT_ISSUE_COLUMNS,
  type FavouriteKind,
  IssueColumn,
  type ListColumn,
  type RecentKind,
} from '@tasklore/shared';
import { useEffect, useMemo } from 'react';
import { client, unwrap } from './api';
import { trackingMetaQuery } from './tracking';

export const favouritesQuery = queryOptions({
  queryKey: ['favourites'],
  queryFn: () => unwrap(client.GET('/api/v1/me/favourites')),
});

export const recentQuery = (limit: number) =>
  queryOptions({
    queryKey: ['recent', limit],
    queryFn: () => unwrap(client.GET('/api/v1/me/recent', { params: { query: { limit } } })),
  });

export const activityQuery = (filter: { project?: string; user?: string }, limit = 30) =>
  infiniteQueryOptions({
    queryKey: ['activity', filter, limit],
    queryFn: ({ pageParam }) =>
      unwrap(
        client.GET('/api/v1/activity', {
          params: { query: { ...filter, limit, ...(pageParam ? { before: pageParam } : {}) } },
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next,
  });

/** Tells the server that the person opened this issue, project, space, page or board (E-46, E-60). */
export function useRecordView(kind: RecentKind, ref: string | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!ref) return;
    void client
      .POST('/api/v1/me/recent', { body: { kind, ref } })
      .then(() => queryClient.invalidateQueries({ queryKey: ['recent'] }));
  }, [kind, ref, queryClient]);
}

/** Stars or unstars a project or space (by key), or a saved filter, page or board (by id). */
export function useFavourite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, ref, on }: { kind: FavouriteKind; ref: string; on: boolean }) => {
      const options = { params: { path: { kind, ref } } };
      return unwrap(
        on
          ? client.PUT('/api/v1/me/favourites/{kind}/{ref}', options)
          : client.DELETE('/api/v1/me/favourites/{kind}/{ref}', options),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['favourites'] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['project'] });
      await queryClient.invalidateQueries({ queryKey: ['filters'] });
      await queryClient.invalidateQueries({ queryKey: ['filter'] });
      await queryClient.invalidateQueries({ queryKey: ['spaces'] });
      await queryClient.invalidateQueries({ queryKey: ['space'] });
      await queryClient.invalidateQueries({ queryKey: ['page'] });
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
      await queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}

export const issueColumnsQuery = queryOptions({
  queryKey: ['issue-columns'],
  queryFn: () => unwrap(client.GET('/api/v1/me/issue-columns')),
  staleTime: Number.POSITIVE_INFINITY,
});

/** Saves the chosen columns; the table follows at once (E-48). */
export function useSetIssueColumns() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (columns: ListColumn[]) =>
      unwrap(client.PUT('/api/v1/me/issue-columns', { body: { columns } })),
    onMutate: (columns) => queryClient.setQueryData(issueColumnsQuery.queryKey, { columns }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: issueColumnsQuery.queryKey }),
  });
}

/**
 * Every column a list can show, in display order: the system columns, then the custom fields
 * that are not archived as `cf[n]` (E-48, E-50).
 */
export function useColumnCatalogue(): ListColumn[] {
  const fields = useQuery(trackingMetaQuery).data?.customFields;
  return useMemo(
    () => [
      ...IssueColumn.options,
      ...(fields ?? [])
        .filter((field) => !field.archived)
        .map((field) => `cf[${field.number}]` as ListColumn),
    ],
    [fields],
  );
}

/** The caller's columns; ones that no longer exist (archived fields) are left out. */
export function useListColumns(): ListColumn[] {
  const stored = useQuery(issueColumnsQuery).data?.columns;
  const known = useColumnCatalogue();
  return useMemo(() => {
    const columns = (stored ?? DEFAULT_ISSUE_COLUMNS) as ListColumn[];
    return columns.filter((column) => known.includes(column));
  }, [stored, known]);
}
