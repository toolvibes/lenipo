import { queryOptions } from '@tanstack/react-query';
import type { Me } from '@toolvibes/shared';
import { ApiError, client, unwrap } from './api';

/** The signed-in user, or null when nobody is signed in. */
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async (): Promise<Me | null> => {
    try {
      return await unwrap(client.GET('/api/v1/me'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
  staleTime: 60_000,
});

/** The AI agents (TL-92, E-144); empty for people who may not browse users. */
export const agentsQuery = queryOptions({
  queryKey: ['agents'],
  queryFn: async () => {
    try {
      return await unwrap(client.GET('/api/v1/agents'));
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return [];
      throw error;
    }
  },
  staleTime: 5 * 60_000,
});

export const authProvidersQuery = queryOptions({
  queryKey: ['auth-providers'],
  queryFn: () => unwrap(client.GET('/api/v1/auth/providers')),
  staleTime: Number.POSITIVE_INFINITY,
});

export const setupStatusQuery = queryOptions({
  queryKey: ['setup-status'],
  queryFn: () => unwrap(client.GET('/api/v1/setup/status')),
});
