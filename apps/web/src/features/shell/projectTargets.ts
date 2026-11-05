import { type QueryClient, useQuery } from '@tanstack/react-query';
import { boardsQuery } from '../../lib/boards';
import { useModules } from '../../lib/instance';
import { PROJECT_PATHS, type ProjectItem } from '../../lib/navigation';
import { projectSpacesQuery } from '../../lib/wiki';

/** The board, the Scrum board (for the backlog) and the wiki space of a project, if any. */
export function useProjectTargets(key: string | null) {
  const modules = useModules();
  const boards = useQuery({ ...boardsQuery(key ?? ''), enabled: Boolean(key) && modules.boards });
  const spaces = useQuery({
    ...projectSpacesQuery(key ?? ''),
    enabled: Boolean(key) && modules.wiki,
  });
  return {
    loaded: boards.isSuccess || !modules.boards,
    board: modules.boards ? (boards.data?.[0] ?? null) : null,
    scrum: modules.boards ? (boards.data?.find((board) => board.type === 'scrum') ?? null) : null,
    lore: modules.wiki ? (spaces.data?.[0] ?? null) : null,
  };
}

/**
 * Where a project switch leads: the same page in the other project if it has it, else its board
 * (or its issues without a board).
 */
export async function projectTarget(
  queryClient: QueryClient,
  key: string,
  item: string | null,
): Promise<string> {
  const boards = await queryClient.fetchQuery(boardsQuery(key)).catch(() => []);
  const board = boards[0];
  const fallback = board ? `/boards/${board.id}` : `/projects/${key}`;
  const path = item ? PROJECT_PATHS[item as ProjectItem] : undefined;
  if (path) return path(key);
  if (item === 'backlog') {
    const scrum = boards.find((entry) => entry.type === 'scrum');
    return scrum ? `/boards/${scrum.id}/backlog` : fallback;
  }
  if (item === 'calendar') return `/calendar?q=${encodeURIComponent(`project = ${key}`)}`;
  if (item === 'wiki') {
    const spaces = await queryClient.fetchQuery(projectSpacesQuery(key)).catch(() => []);
    return spaces[0] ? `/spaces/${spaces[0].key}` : fallback;
  }
  return fallback;
}
