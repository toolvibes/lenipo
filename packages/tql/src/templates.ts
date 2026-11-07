/**
 * Ready-made queries for the quick selection of the issue search. The UI names them by id; the
 * first four are also the default filters beside the results.
 */
export const QUERY_TEMPLATES = [
  {
    id: 'mine',
    query: 'assignee = currentUser() AND resolution is EMPTY ORDER BY priority, updated DESC',
  },
  { id: 'reported', query: 'reporter = currentUser() ORDER BY created DESC' },
  { id: 'recent', query: 'updated >= -7d ORDER BY updated DESC' },
  { id: 'all', query: 'ORDER BY created DESC' },
  { id: 'sprint', query: 'sprint in openSprints() ORDER BY rank' },
  { id: 'overdue', query: 'due < startOfDay() AND resolution is EMPTY ORDER BY due' },
  { id: 'unassigned', query: 'assignee is EMPTY AND resolution is EMPTY ORDER BY created DESC' },
  {
    id: 'watching',
    query: 'watcher = currentUser() AND resolution is EMPTY ORDER BY updated DESC',
  },
  { id: 'doneThisWeek', query: 'resolved >= startOfWeek() ORDER BY resolved DESC' },
] as const;

export type QueryTemplateId = (typeof QUERY_TEMPLATES)[number]['id'];
