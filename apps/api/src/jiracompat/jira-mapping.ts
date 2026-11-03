import type {
  Comment,
  IssueSummary,
  StatusCategory,
  StatusInfo,
  Transition,
  UserRef,
} from '@toolvibes/shared';

/**
 * Lenipo's issues in the shapes of the Jira REST API v2 (TL-48, E-138). Ids stay Lenipo's ids;
 * rich text travels as Markdown, which plain text and most wiki-markup scripts write anyway.
 */

/** Jira writes times with milliseconds and a numeric offset. */
export function jiraTime(iso: string): string {
  const date = new Date(iso);
  return date.toISOString().replace('Z', '+0000');
}

/** Jira's three fixed status categories. */
const CATEGORIES: Record<
  StatusCategory,
  { id: number; key: string; name: string; colorName: string }
> = {
  todo: { id: 2, key: 'new', name: 'To Do', colorName: 'blue-gray' },
  in_progress: { id: 4, key: 'indeterminate', name: 'In Progress', colorName: 'yellow' },
  done: { id: 3, key: 'done', name: 'Done', colorName: 'green' },
};

export function jiraStatus(status: StatusInfo) {
  return { id: status.id, name: status.name, statusCategory: CATEGORIES[status.category] };
}

export function jiraUser(user: UserRef | null) {
  if (!user) return null;
  return {
    accountId: user.id,
    key: user.id,
    name: user.id,
    displayName: user.displayName,
    active: true,
  };
}

export type JiraFields = Record<string, unknown>;

/** The fields of an issue; `description` only where the caller has it (search lists leave it out). */
export function jiraFields(issue: IssueSummary, description?: string | null): JiraFields {
  const fields: JiraFields = {
    summary: issue.summary,
    issuetype: {
      id: issue.issueType.id,
      name: issue.issueType.name,
      subtask: issue.issueType.hierarchyLevel < 0,
    },
    project: { id: issue.project.key, key: issue.project.key, name: issue.project.name },
    status: jiraStatus(issue.status),
    priority: { id: issue.priority.id, name: issue.priority.name },
    assignee: jiraUser(issue.assignee),
    reporter: jiraUser(issue.reporter),
    labels: issue.labels,
    resolution: issue.resolution ? { id: issue.resolution.id, name: issue.resolution.name } : null,
    resolutiondate: issue.resolvedAt ? jiraTime(issue.resolvedAt) : null,
    created: jiraTime(issue.createdAt),
    updated: jiraTime(issue.updatedAt),
    duedate: issue.dueDate,
    components: issue.components.map((component) => ({ id: component.id, name: component.name })),
    fixVersions: issue.fixVersions.map((version) => ({ id: version.id, name: version.name })),
    versions: issue.affectsVersions.map((version) => ({ id: version.id, name: version.name })),
    parent: issue.parent
      ? { key: issue.parent.key, fields: { summary: issue.parent.summary } }
      : null,
    timetracking: {
      originalEstimateSeconds: issue.timeTracking.originalEstimateSeconds ?? undefined,
      remainingEstimateSeconds: issue.timeTracking.remainingEstimateSeconds ?? undefined,
      timeSpentSeconds: issue.timeTracking.timeSpentSeconds,
    },
  };
  if (description !== undefined) fields.description = description;
  for (const [id, value] of Object.entries(issue.customFields)) {
    fields[`customfield_${id}`] = value;
  }
  return fields;
}

/**
 * Only the requested fields, as Jira's `fields` parameter asks: a list of names, `*all` or
 * `*navigable`, and `-name` to leave one out.
 */
export function pickFields(fields: JiraFields, requested: string[] | undefined): JiraFields {
  if (!requested || requested.length === 0) return fields;
  const wanted = requested.filter((name) => !name.startsWith('-'));
  const excluded = new Set(
    requested.filter((name) => name.startsWith('-')).map((name) => name.slice(1)),
  );
  const everything =
    wanted.length === 0 || wanted.some((name) => name === '*all' || name === '*navigable');
  const names = new Set(wanted);
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([name]) => (everything || names.has(name)) && !excluded.has(name),
    ),
  );
}

export function jiraIssue(base: string, issue: IssueSummary, fields: JiraFields) {
  return { expand: '', id: issue.id, self: `${base}/issue/${issue.id}`, key: issue.key, fields };
}

export function jiraComment(base: string, issueId: string, comment: Comment, body: string) {
  return {
    id: comment.id,
    self: `${base}/issue/${issueId}/comment/${comment.id}`,
    author: jiraUser(comment.author),
    updateAuthor: jiraUser(comment.author),
    body,
    created: jiraTime(comment.createdAt),
    updated: jiraTime(comment.updatedAt),
  };
}

export function jiraTransition(transition: Transition) {
  return {
    id: transition.id,
    name: transition.name,
    to: jiraStatus(transition.to),
    hasScreen: transition.screen || transition.requiredFields.length > 0,
    isGlobal: false,
    isInitial: false,
    isConditional: false,
  };
}

/** Jira's error body: messages for the request and messages by field. */
export function jiraErrors(messages: string[], errors: Record<string, string> = {}) {
  return { errorMessages: messages, errors };
}
