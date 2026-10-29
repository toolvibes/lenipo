import { docToMarkdown } from '@tasklore/editor';
import type {
  ChangeGroup,
  Comment,
  CustomField,
  CustomFieldValue,
  Issue,
  IssueSummary,
  ProjectDetails,
  ProjectSummary,
} from '@tasklore/shared';
import { plainText } from '../tracking/rich-text.js';

/** Compact Markdown for agents (D-MCP-07, E-52): few tokens, the facts first. */

function markdown(doc: unknown): string {
  if (!doc) return '';
  if (typeof doc === 'string') return doc;
  try {
    return docToMarkdown(doc);
  } catch {
    return plainText(doc);
  }
}

function day(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

/** "a: b · c: d", leaving out empty values. */
function facts(entries: Array<[string, string | number | null | undefined]>): string {
  return entries
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([name, value]) => `${name}: ${value}`)
    .join(' · ');
}

function customValue(value: CustomFieldValue): string {
  if (Array.isArray(value)) return value.map((option) => option.value).join(', ');
  if (value && typeof value === 'object') {
    return 'value' in value ? value.value : value.displayName;
  }
  return String(value);
}

/** One line per issue, as search results and child lists show them. */
export function issueLine(issue: IssueSummary): string {
  const details = facts([
    ['type', issue.issueType.name],
    ['priority', issue.priority.name],
    ['assignee', issue.assignee?.displayName ?? 'unassigned'],
    ['updated', day(issue.updatedAt)],
  ]);
  return `- ${issue.key} [${issue.status.name}] ${issue.summary} (${details})`;
}

export function issueMarkdown(issue: Issue, fields: CustomField[]): string {
  const lines = [`# ${issue.key}: ${issue.summary}`, ''];
  lines.push(
    facts([
      ['project', issue.project.key],
      ['type', issue.issueType.name],
      ['status', issue.status.name],
      ['resolution', issue.resolution?.name],
      ['priority', issue.priority.name],
      ['assignee', issue.assignee?.displayName ?? 'unassigned'],
      ['reporter', issue.reporter?.displayName],
    ]),
  );
  const more = facts([
    ['labels', issue.labels.join(', ')],
    ['components', issue.components.map((component) => component.name).join(', ')],
    ['story points', issue.storyPoints],
    ['due', issue.dueDate],
    ['parent', issue.parent ? `${issue.parent.key} ${issue.parent.summary}` : null],
    ['created', day(issue.createdAt)],
    ['updated', day(issue.updatedAt)],
  ]);
  if (more) lines.push(more);
  const custom = Object.entries(issue.customFields).flatMap(([id, value]) => {
    const field = fields.find((entry) => entry.id === id);
    return field ? [`${field.name}: ${customValue(value)}`] : [];
  });
  if (custom.length > 0) lines.push(custom.join(' · '));
  const time = issue.timeTracking;
  if (time.originalEstimateSeconds !== null || time.timeSpentSeconds > 0) {
    const hours = (seconds: number | null) =>
      seconds === null ? null : `${Math.round((seconds / 3600) * 10) / 10}h`;
    lines.push(
      facts([
        ['estimate', hours(time.originalEstimateSeconds)],
        ['remaining', hours(time.remainingEstimateSeconds)],
        ['logged', hours(time.timeSpentSeconds)],
      ]),
    );
  }
  if (issue.links.length > 0) {
    lines.push('', '## Links');
    for (const link of issue.links) {
      lines.push(
        `- ${link.direction === 'outward' ? link.type.outward : link.type.inward} ${link.issue.key} [${link.issue.status.name}] ${link.issue.summary}`,
      );
    }
  }
  if (issue.children.length > 0) {
    lines.push('', '## Sub-issues', ...issue.children.map(issueLine));
  }
  const description = markdown(issue.description);
  lines.push('', '## Description', '', description || '(none)');
  return lines.join('\n');
}

export function commentsMarkdown(comments: Comment[]): string {
  if (comments.length === 0) return 'No comments.';
  return comments
    .map(
      (comment) =>
        `### ${comment.author?.displayName ?? 'unknown'}, ${comment.createdAt.slice(0, 16).replace('T', ' ')}\n\n${markdown(comment.body)}`,
    )
    .join('\n\n');
}

export function historyMarkdown(groups: ChangeGroup[]): string {
  if (groups.length === 0) return 'No changes yet.';
  return groups
    .map((group) => {
      const head = `- ${group.createdAt.slice(0, 16).replace('T', ' ')} ${group.author?.displayName ?? 'unknown'}${group.via === 'mcp' ? ' (via MCP)' : ''}:`;
      const items = group.items.map(
        (item) => `  - ${item.field}: ${item.from ?? '–'} → ${item.to ?? '–'}`,
      );
      return [head, ...items].join('\n');
    })
    .join('\n');
}

export function projectLine(project: ProjectSummary): string {
  const lead = project.lead ? ` (lead: ${project.lead.displayName})` : '';
  return `- ${project.key} ${project.name}${lead}, ${project.issueCount} issues`;
}

export function projectMarkdown(
  project: ProjectDetails,
  fields: CustomField[],
  components: string[],
): string {
  const used = fields.filter((field) => project.customFieldIds.includes(field.id));
  return [
    `# ${project.key}: ${project.name}`,
    '',
    project.description,
    `issue types: ${project.issueTypes.map((type) => type.name).join(', ')}`,
    `statuses (workflow order): ${project.statuses.map((status) => `${status.name} (${status.category})`).join(', ')}`,
    `components: ${components.join(', ') || '(none)'}`,
    `custom fields: ${
      used
        .map(
          (field) =>
            `${field.name} = cf[${field.number}] (${field.type}${
              field.options.length > 0
                ? `: ${field.options
                    .filter((option) => !option.archived)
                    .map((option) => option.value)
                    .join(', ')}`
                : ''
            })`,
        )
        .join('; ') || '(none)'
    }`,
    `your permissions: ${project.permissions.join(', ')}`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}
