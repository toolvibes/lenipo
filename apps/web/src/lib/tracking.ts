import { queryOptions, useQuery } from '@tanstack/react-query';
import { FieldCatalogue } from '@tasklore/tql';
import { useMemo } from 'react';
import { client, unwrap } from './api';

export type IssueFilter = {
  status?: 'todo' | 'in_progress' | 'done' | 'unresolved';
  assignee?: string;
  q?: string;
  limit?: number;
};

export const trackingMetaQuery = queryOptions({
  queryKey: ['tracking-meta'],
  queryFn: () => unwrap(client.GET('/api/v1/tracking/meta')),
  staleTime: 5 * 60_000,
});

export const projectsQuery = queryOptions({
  queryKey: ['projects'],
  queryFn: () => unwrap(client.GET('/api/v1/projects')),
});

/** Role assignments of a project, for its administration (TL-65). */
export const projectMembersQuery = (key: string) =>
  queryOptions({
    queryKey: ['project', key, 'members'],
    queryFn: () =>
      unwrap(client.GET('/api/v1/projects/{key}/members', { params: { path: { key } } })),
  });

export const projectQuery = (key: string) =>
  queryOptions({
    queryKey: ['project', key],
    queryFn: () => unwrap(client.GET('/api/v1/projects/{key}', { params: { path: { key } } })),
  });

export const projectIssuesQuery = (key: string, filter: IssueFilter) =>
  queryOptions({
    queryKey: ['project-issues', key, filter],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/projects/{key}/issues', {
          params: { path: { key }, query: { limit: 50, ...filter } },
        }),
      ),
    placeholderData: (previous) => previous,
  });

export const issueQuery = (key: string) =>
  queryOptions({
    queryKey: ['issue', key],
    queryFn: () => unwrap(client.GET('/api/v1/issues/{key}', { params: { path: { key } } })),
  });

export const transitionsQuery = (key: string) =>
  queryOptions({
    queryKey: ['issue', key, 'transitions'],
    queryFn: () =>
      unwrap(client.GET('/api/v1/issues/{key}/transitions', { params: { path: { key } } })),
  });

export const commentsQuery = (key: string) =>
  queryOptions({
    queryKey: ['issue', key, 'comments'],
    queryFn: () =>
      unwrap(client.GET('/api/v1/issues/{key}/comments', { params: { path: { key } } })),
  });

export const historyQuery = (key: string) =>
  queryOptions({
    queryKey: ['issue', key, 'history'],
    queryFn: () =>
      unwrap(client.GET('/api/v1/issues/{key}/history', { params: { path: { key } } })),
  });

export const componentsQuery = (projectKey: string) =>
  queryOptions({
    queryKey: ['project', projectKey, 'components'],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/projects/{key}/components', { params: { path: { key: projectKey } } }),
      ),
  });

export const projectUsersQuery = (projectKey: string, query = '') =>
  queryOptions({
    queryKey: ['project-users', projectKey, query],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/projects/{key}/users', {
          params: { path: { key: projectKey }, query: { query, limit: 50 } },
        }),
      ),
  });

export const attachmentsQuery = (issueKey: string) =>
  queryOptions({
    queryKey: ['issue', issueKey, 'attachments'],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/issues/{key}/attachments', { params: { path: { key: issueKey } } }),
      ),
  });

export const worklogsQuery = (key: string) =>
  queryOptions({
    queryKey: ['issue', key, 'worklogs'],
    queryFn: () =>
      unwrap(client.GET('/api/v1/issues/{key}/worklogs', { params: { path: { key } } })),
  });

/** The fields TQL knows here: system fields plus custom fields that are not archived (E-50). */
export function useFieldCatalogue(): FieldCatalogue {
  const fields = useQuery(trackingMetaQuery).data?.customFields;
  return useMemo(
    () => new FieldCatalogue((fields ?? []).filter((field) => !field.archived)),
    [fields],
  );
}

export const versionsQuery = (projectKey: string) =>
  queryOptions({
    queryKey: ['project', projectKey, 'versions'],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/projects/{key}/versions', { params: { path: { key: projectKey } } }),
      ),
  });

/** Epics, children and milestones of a project for the timeline (E-68). */
export const timelineQuery = (key: string) =>
  queryOptions({
    queryKey: ['timeline', key],
    queryFn: () =>
      unwrap(client.GET('/api/v1/projects/{key}/timeline', { params: { path: { key } } })),
  });

/** The project's workflow for the editor (E-70). */
export const projectWorkflowQuery = (key: string) =>
  queryOptions({
    queryKey: ['project-workflow', key],
    queryFn: () =>
      unwrap(client.GET('/api/v1/projects/{key}/workflow', { params: { path: { key } } })),
  });
