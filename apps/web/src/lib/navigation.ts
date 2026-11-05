/**
 * Navigation by area (design "Neue Navigation"): the top bar shows the areas, the menu on the
 * left only the active one. Which area and item are active follows from the route alone, so
 * direct links and reloads show the same menu.
 */
export const AREAS = ['start', 'project', 'planning', 'wiki', 'service'] as const;
export type Area = (typeof AREAS)[number];

export type ProjectItem =
  | 'issues'
  | 'backlog'
  | 'board'
  | 'timeline'
  | 'calendar'
  | 'releases'
  | 'reports'
  | 'team'
  | 'wiki'
  | 'settings';

export interface Location {
  /** null: a page outside the areas (search, notifications, profile, help, administration). */
  area: Area | null;
  /** The menu entry to mark; null when the page has none of its own. */
  item: string | null;
  /** For the project area: the project the page is about, if the path names it. */
  projectKey: string | null;
}

/** "Assigned to me and not done": the query of "Meine Aufgaben". */
export const MY_ISSUES =
  'assignee = currentUser() AND resolution is EMPTY ORDER BY priority, updated DESC';

const KEY = '([A-Za-z][A-Za-z0-9]{1,9})';

/**
 * Area and item of a path. Boards and wiki spaces name their project only in their data, so the
 * caller passes what it knows: the project of a board and of a space linked to a project.
 */
export function locate(
  path: string,
  search: { q?: unknown },
  known: {
    boardProject?: (id: string) => string | null;
    spaceProject?: (key: string) => string | null;
  } = {},
): Location {
  const none = (area: Area | null, item: string | null = null): Location => ({
    area,
    item,
    projectKey: null,
  });
  const project = (key: string, item: ProjectItem | null): Location => ({
    area: 'project',
    item,
    projectKey: key.toUpperCase(),
  });
  if (path === '/') return none('start', 'overview');
  if (path === '/issues') return none('start', search.q === MY_ISSUES ? 'mine' : null);
  if (path === '/activity') return none('start', 'activity');
  if (path === '/timesheet') return none('start', 'time');

  if (path === '/projects') return none('planning', 'projects');
  if (path === '/boards') return none('planning', 'boards');
  if (path.startsWith('/plans')) return none('planning', 'plans');
  if (path.startsWith('/dashboards')) return none('planning', 'dashboards');
  if (path.startsWith('/agents')) return none('planning', 'agents');

  const inProject = new RegExp(`^/projects/${KEY}(?:/([a-z]+))?`).exec(path);
  if (inProject?.[1]) {
    const sub = inProject[2];
    const items: Record<string, ProjectItem> = {
      timeline: 'timeline',
      releases: 'releases',
      reports: 'reports',
      team: 'team',
      settings: 'settings',
    };
    return project(inProject[1], sub ? (items[sub] ?? null) : 'issues');
  }
  const onBoard = /^\/boards\/([^/]+)(?:\/([a-z]+))?/.exec(path);
  if (onBoard?.[1]) {
    const key = known.boardProject?.(onBoard[1]) ?? null;
    const sub = onBoard[2];
    const item: ProjectItem =
      sub === 'backlog' ? 'backlog' : sub === 'reports' ? 'reports' : 'board';
    return key ? project(key, item) : { area: 'project', item, projectKey: null };
  }
  const issue = new RegExp(`^/issues/${KEY}-\\d+`).exec(path);
  if (issue?.[1]) return project(issue[1], null);
  if (path === '/calendar') {
    const filter =
      typeof search.q === 'string'
        ? /project\s*=\s*"?([A-Za-z][A-Za-z0-9]*)/i.exec(search.q)
        : null;
    return filter?.[1] ? project(filter[1], 'calendar') : none('start');
  }

  if (path === '/spaces') return none('wiki', 'home');
  const space = new RegExp(`^/spaces/${KEY}`).exec(path);
  if (space?.[1]) {
    // A space linked to a project belongs to that project (design S8).
    const key = known.spaceProject?.(space[1].toUpperCase()) ?? null;
    if (key) return project(key, 'wiki');
    return none('wiki', `space:${space[1].toUpperCase()}`);
  }
  if (path.startsWith('/pages/') || path.startsWith('/labels')) return none('wiki');

  if (path.startsWith('/portal')) return none('service', 'portal');

  return none(null);
}

/** The pages of a project that exist in every project (no board or wiki needed). */
export const PROJECT_PATHS: Partial<Record<ProjectItem, (key: string) => string>> = {
  issues: (key) => `/projects/${key}`,
  timeline: (key) => `/projects/${key}/timeline`,
  releases: (key) => `/projects/${key}/releases`,
  reports: (key) => `/projects/${key}/reports`,
  team: (key) => `/projects/${key}/team`,
  settings: (key) => `/projects/${key}/settings`,
};
