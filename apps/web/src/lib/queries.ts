import { queryOptions } from '@tanstack/react-query';
import type { Me, SetupStatusResponse } from '@tasklore/shared';
import { ApiError, api } from './api';

/** The signed-in user, or null when nobody is signed in. */
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async (): Promise<Me | null> => {
    try {
      return await api<Me>('GET', '/me');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
  staleTime: 60_000,
});

export const setupStatusQuery = queryOptions({
  queryKey: ['setup-status'],
  queryFn: () => api<SetupStatusResponse>('GET', '/setup/status'),
});
