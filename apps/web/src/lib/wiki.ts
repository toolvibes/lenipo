import { queryOptions } from '@tanstack/react-query';
import type { PageTreeEntry } from '@toolvibes/shared';
import { client, unwrap } from './api';

export const spacesQuery = queryOptions({
  queryKey: ['spaces'],
  queryFn: () => unwrap(client.GET('/api/v1/spaces')),
});

export const spaceQuery = (key: string) =>
  queryOptions({
    queryKey: ['space', key],
    queryFn: () => unwrap(client.GET('/api/v1/spaces/{key}', { params: { path: { key } } })),
  });

/** The page tree in depth-first order (E-59); nested by `parentId` in the sidebar. */
export const pageTreeQuery = (key: string) =>
  queryOptions({
    queryKey: ['space', key, 'pages'],
    queryFn: () => unwrap(client.GET('/api/v1/spaces/{key}/pages', { params: { path: { key } } })),
  });

/** Role assignments; only administrators of the space may read them. */
export const spaceMembersQuery = (key: string) =>
  queryOptions({
    queryKey: ['space', key, 'members'],
    queryFn: () =>
      unwrap(client.GET('/api/v1/spaces/{key}/members', { params: { path: { key } } })),
  });

/** Spaces linked with a project (E-60). */
export const projectSpacesQuery = (projectKey: string) =>
  queryOptions({
    queryKey: ['project', projectKey, 'spaces'],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/projects/{key}/spaces', { params: { path: { key: projectKey } } }),
      ),
  });

export const groupsQuery = queryOptions({
  queryKey: ['groups'],
  queryFn: () => unwrap(client.GET('/api/v1/groups')),
  staleTime: 60_000,
});

export const userSearchQuery = (query: string) =>
  queryOptions({
    queryKey: ['users', query],
    queryFn: () => unwrap(client.GET('/api/v1/users', { params: { query: { query, limit: 8 } } })),
  });

export const pageQuery = (id: string) =>
  queryOptions({
    queryKey: ['page', id],
    queryFn: () =>
      unwrap(client.GET('/api/v1/pages/{id}', { params: { path: { id }, query: {} } })),
  });

export const pageAttachmentsQuery = (id: string) =>
  queryOptions({
    queryKey: ['page', id, 'attachments'],
    queryFn: () =>
      unwrap(client.GET('/api/v1/pages/{id}/attachments', { params: { path: { id } } })),
  });

/** Page comments and inline threads, oldest first (E-63). */
export const pageCommentsQuery = (id: string) =>
  queryOptions({
    queryKey: ['page', id, 'comments'],
    queryFn: () => unwrap(client.GET('/api/v1/pages/{id}/comments', { params: { path: { id } } })),
  });

export const spaceLabelsQuery = (key: string) =>
  queryOptions({
    queryKey: ['space', key, 'labels'],
    queryFn: () => unwrap(client.GET('/api/v1/spaces/{key}/labels', { params: { path: { key } } })),
  });

export const labelPagesQuery = (label: string, space?: string) =>
  queryOptions({
    queryKey: ['labels', label, space ?? null],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/labels/{label}/pages', {
          params: { path: { label }, query: space ? { space } : {} },
        }),
      ),
  });

export const pageVersionsQuery = (id: string) =>
  queryOptions({
    queryKey: ['page', id, 'versions'],
    queryFn: () => unwrap(client.GET('/api/v1/pages/{id}/versions', { params: { path: { id } } })),
  });

export interface TreeNode {
  page: PageTreeEntry;
  children: TreeNode[];
}

/** Nests the flat, ordered tree entries. */
export function nest(entries: PageTreeEntry[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const page of entries) nodes.set(page.id, { page, children: [] });
  for (const page of entries) {
    const node = nodes.get(page.id) as TreeNode;
    const parent = page.parentId ? nodes.get(page.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}

/** Blueprints and templates offered when creating a page in a space (E-72). */
export const spaceTemplatesQuery = (key: string) =>
  queryOptions({
    queryKey: ['templates', 'space', key],
    queryFn: () =>
      unwrap(client.GET('/api/v1/spaces/{key}/templates', { params: { path: { key } } })),
  });

export const globalTemplatesQuery = queryOptions({
  queryKey: ['templates', 'global'],
  queryFn: () => unwrap(client.GET('/api/v1/page-templates')),
});

export const templateQuery = (ref: string) =>
  queryOptions({
    queryKey: ['templates', 'one', ref],
    queryFn: () =>
      unwrap(client.GET('/api/v1/page-templates/{ref}', { params: { path: { ref } } })),
  });

/** Wiki pages that name or embed an issue (W-INT-03, E-73). */
export const issuePagesQuery = (key: string) =>
  queryOptions({
    queryKey: ['issue', key, 'pages'],
    queryFn: () => unwrap(client.GET('/api/v1/issues/{key}/pages', { params: { path: { key } } })),
  });
