import { useQuery } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { boardsQuery } from '../../lib/boards';
import { type Area, type Location, locate } from '../../lib/navigation';
import { recentQuery } from '../../lib/personal';
import { useCurrentProjectKey } from '../../lib/shortcuts';
import { projectsQuery } from '../../lib/tracking';
import { spacesQuery } from '../../lib/wiki';

export interface Nav extends Location {
  /** The area whose menu is shown: the active one, else the last one (search, profile …). */
  shown: Area;
  /** The project of the project tab: the page's, else the last used one. */
  project: { key: string; name: string } | null;
}

/** Where the person is: area, menu item and project, from the route (and the last used project). */
export function useNav(): Nav {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.search }) as { q?: unknown };
  const boards = useQuery(boardsQuery());
  const spaces = useQuery(spacesQuery);
  const projects = useQuery(projectsQuery);
  const recent = useQuery(recentQuery(8));
  const current = useCurrentProjectKey();
  const location = locate(path, search, {
    boardProject: (id) => boards.data?.find((board) => board.id === id)?.project.key ?? null,
    spaceProject: (key) => spaces.data?.find((space) => space.key === key)?.project?.key ?? null,
  });
  const [lastArea, setLastArea] = useState<Area>('start');
  useEffect(() => {
    if (location.area) setLastArea(location.area);
  }, [location.area]);

  // The last used project per person comes from the server's "recently viewed" list.
  const fromRecent = (recent.data ?? [])
    .map((item) =>
      item.kind === 'project'
        ? item.ref
        : item.kind === 'board'
          ? (item.projectKey ?? null)
          : item.kind === 'issue'
            ? (item.ref.split('-')[0] ?? null)
            : null,
    )
    .find((key): key is string => Boolean(key));
  const known = projects.data ?? [];
  const key = location.projectKey ?? current ?? fromRecent ?? known[0]?.key ?? null;
  const found = known.find((entry) => entry.key === key) ?? known[0] ?? null;
  return {
    ...location,
    shown: location.area ?? lastArea,
    project: found ? { key: found.key, name: found.name } : null,
  };
}
