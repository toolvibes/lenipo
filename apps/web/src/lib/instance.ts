import { queryOptions, useQuery } from '@tanstack/react-query';
import { type FeatureFlags, MODULES } from '@tasklore/shared';
import { client, unwrap } from './api';

/** Modules, maintenance and the banner (TL-40, E-121); looked at again every minute. */
export const noticeQuery = queryOptions({
  queryKey: ['instance', 'notice'],
  queryFn: () => unwrap(client.GET('/api/v1/instance/notice')),
  refetchInterval: 60_000,
  staleTime: 30_000,
});

const ALL_ON = Object.fromEntries(MODULES.map((name) => [name, true])) as FeatureFlags;

/** Which modules are on; all of them until the instance has answered. */
export function useModules(): FeatureFlags {
  return useQuery(noticeQuery).data?.modules ?? ALL_ON;
}
