import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { FavouriteKind, IssueColumn, RecentKind } from '@tasklore/shared';
import { useEffect } from 'react';
import { client, unwrap } from './api';

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

/** Tells the server that the person opened this issue or project (E-46). */
export function useRecordView(kind: RecentKind, ref: string | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!ref) return;
    void client
      .POST('/api/v1/me/recent', { body: { kind, ref } })
      .then(() => queryClient.invalidateQueries({ queryKey: ['recent'] }));
  }, [kind, ref, queryClient]);
}

/** Stars or unstars a project (by key) or saved filter (by id). */
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
    mutationFn: (columns: IssueColumn[]) =>
      unwrap(client.PUT('/api/v1/me/issue-columns', { body: { columns } })),
    onMutate: (columns) => queryClient.setQueryData(issueColumnsQuery.queryKey, { columns }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: issueColumnsQuery.queryKey }),
  });
}
