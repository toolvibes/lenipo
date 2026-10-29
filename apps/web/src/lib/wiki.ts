import { queryOptions } from '@tanstack/react-query';
import type { PageTreeEntry } from '@tasklore/shared';
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

export const pageQuery = (id: string) =>
  queryOptions({
    queryKey: ['page', id],
    queryFn: () =>
      unwrap(client.GET('/api/v1/pages/{id}', { params: { path: { id }, query: {} } })),
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
