import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { HttpException } from '@nestjs/common';
import {
  CreateIssueLinkRequest,
  CreateIssueRequest,
  CreateWorklogRequest,
  SearchRequest,
  TransitionRequest,
  UpdateIssueRequest,
} from '@tasklore/shared';
import { parse } from '@tasklore/tql';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AuditService } from '../audit/audit.service.js';
import type { BoardService } from '../boards/board.service.js';
import type { SprintService } from '../boards/sprint.service.js';
import type { Principal } from '../core/http/principal.js';
import type { DatabaseHandle } from '../db/client.js';
import { users } from '../db/schema/index.js';
import type { UserService } from '../identity/user.service.js';
import { QueryException } from '../search/query-exception.js';
import type { SearchService } from '../search/search.service.js';
import type { ComponentService } from '../tracking/component.service.js';
import type { CustomFieldService } from '../tracking/custom-field.service.js';
import type { IssueService } from '../tracking/issue.service.js';
import type { ProjectService } from '../tracking/project.service.js';
import type { WorklogService } from '../tracking/worklog.service.js';
import {
  commentsMarkdown,
  historyMarkdown,
  issueLine,
  issueMarkdown,
  projectLine,
  projectMarkdown,
} from './format.js';

export interface ToolServices {
  database: DatabaseHandle;
  boards: BoardService;
  sprints: SprintService;
  issues: IssueService;
  search: SearchService;
  projects: ProjectService;
  components: ComponentService;
  worklogs: WorklogService;
  customFields: CustomFieldService;
  users: UserService;
  audit: AuditService;
}

const IssueKey = z.string().min(1).max(30).describe('Issue key, e.g. WEB-12');
const ProjectKey = z.string().min(1).max(10).describe('Project key, e.g. WEB');
const MarkdownText = z.string().max(200_000);

function text(markdown: string, structured?: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text: markdown }],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

/** API errors go back to the agent as tool errors it can read and correct (E-52). */
function failure(error: unknown): CallToolResult {
  if (error instanceof QueryException) {
    const lines = error.queryErrors.map(
      (entry) => `- ${entry.message} (at ${entry.start}–${entry.end}, code ${entry.code})`,
    );
    return {
      isError: true,
      content: [{ type: 'text', text: `Invalid TQL:\n${lines.join('\n')}` }],
    };
  }
  if (error instanceof HttpException) {
    const response = error.getResponse();
    const message =
      typeof response === 'object' && response && 'message' in response
        ? String((response as { message: unknown }).message)
        : error.message;
    return { isError: true, content: [{ type: 'text', text: `${error.getStatus()}: ${message}` }] };
  }
  throw error;
}

/**
 * The MCP tools of Tasklore v1 (D-MCP, E-52). They call the services behind the REST API with
 * the caller's principal, so rights, history and events are the same.
 */
export function registerTools(server: McpServer, principal: Principal, services: ToolServices) {
  const { issues, search, projects, customFields } = services;

  const tool = <Shape extends z.ZodRawShape>(
    name: string,
    config: { title: string; description: string; inputSchema: Shape; readOnly?: boolean },
    handler: (args: z.infer<z.ZodObject<Shape>>) => Promise<CallToolResult>,
  ) => {
    server.registerTool(
      name,
      {
        title: config.title,
        description: config.description,
        inputSchema: config.inputSchema,
        annotations: { readOnlyHint: config.readOnly ?? false },
      },
      // biome-ignore lint/suspicious/noExplicitAny: arguments are validated by the SDK
      (async (args: any) => {
        try {
          return await handler(args);
        } catch (error) {
          return failure(error);
        }
      }) as never,
    );
  };

  /** Every change through MCP is also in the audit log (D-MCP-06). */
  const audited = async (name: string, targetId: string) => {
    await services.audit.record({
      action: `mcp.${name}`,
      actorId: principal.userId,
      via: 'mcp',
      targetType: 'issue',
      targetId,
    });
  };

  const showIssue = async (key: string) => {
    const issue = await issues.get(principal, key);
    const fields = await customFields.list();
    return text(issueMarkdown(issue, fields), {
      key: issue.key,
      summary: issue.summary,
      status: issue.status.name,
      type: issue.issueType.name,
      priority: issue.priority.name,
      assignee: issue.assignee?.displayName ?? null,
    });
  };

  // ---------------------------------------------------------------- meta

  tool(
    'whoami',
    {
      title: 'Who am I',
      description: 'The person this token acts for, with global permissions.',
      inputSchema: {},
      readOnly: true,
    },
    async () => {
      const me = await services.users.me(principal.userId, 'mcp');
      return text(
        `${me.displayName} <${me.email}>, global permissions: ${me.globalPermissions.join(', ') || 'none'}`,
        { id: me.id, displayName: me.displayName, email: me.email },
      );
    },
  );

  tool(
    'get_field_schema',
    {
      title: 'TQL fields',
      description:
        'Fields usable in TQL queries with their type and operators, including custom fields (name or cf[n]).',
      inputSchema: {},
      readOnly: true,
    },
    async () => {
      const catalogue = await customFields.catalogue();
      const lines = catalogue.fields
        .filter((field) => field.operators.length > 0 || field.orderable)
        .map((field) => {
          const names = field.custom
            ? `${field.custom.name} (${field.id})`
            : [field.id, ...field.aliases].join(' / ');
          return `- ${names}: ${field.type}; ${field.operators.join(' ') || 'sort only'}${field.orderable ? '; sortable' : ''}`;
        });
      return text(
        `Functions: currentUser(), membersOf(group), now(), startOfDay/Week/Month/Year([±n]), endOf…, linkedIssues(KEY[, type]).\nDates: 2026-10-28, -7d, 2w. Text search with ~ ("word*" for prefixes).\n\n${lines.join('\n')}`,
      );
    },
  );

  tool(
    'explain_tql',
    {
      title: 'Check a TQL query',
      description:
        'Checks a TQL query against syntax and stored values without running it and lists its conditions.',
      inputSchema: { query: SearchRequest.shape.query },
      readOnly: true,
    },
    async ({ query }) => {
      const catalogue = await customFields.catalogue();
      const parsed = parse(query, catalogue);
      if (!parsed.query || parsed.errors.length > 0) throw new QueryException(parsed.errors);
      await search.compile(principal, query);
      const fields = new Set<string>();
      const visit = (node: NonNullable<typeof parsed.query.where>): void => {
        if (node.kind === 'clause') fields.add(`${node.field.id} ${node.operator}`);
        else if (node.kind === 'not') visit(node.expression);
        else node.items.forEach(visit);
      };
      if (parsed.query.where) visit(parsed.query.where);
      const order = parsed.query.orderBy.map((item) => `${item.field.id} ${item.direction}`);
      return text(
        `Valid. Conditions: ${[...fields].join(', ') || 'none (all issues you can see)'}. Order: ${order.join(', ') || 'created desc'}.`,
      );
    },
  );

  // ---------------------------------------------------------------- projects

  tool(
    'list_projects',
    {
      title: 'List projects',
      description: 'Projects you can see.',
      inputSchema: {},
      readOnly: true,
    },
    async () => {
      const list = await projects.list(principal);
      return text(list.map(projectLine).join('\n') || 'No projects.', {
        projects: list.map(({ key, name }) => ({ key, name })),
      });
    },
  );

  tool(
    'get_project',
    {
      title: 'Get a project',
      description:
        'Issue types, workflow statuses, components, custom fields (with ids for create/update) and your permissions.',
      inputSchema: { project: ProjectKey },
      readOnly: true,
    },
    async ({ project }) => {
      const details = await projects.details(principal, project);
      const [fields, components] = await Promise.all([
        customFields.list(),
        services.components.list(principal, project),
      ]);
      const ids = fields
        .filter((field) => details.customFieldIds.includes(field.id))
        .map((field) => `- ${field.name}: id ${field.id}`);
      return text(
        `${projectMarkdown(
          details,
          fields,
          components.map((component) => component.name),
        )}${ids.length > 0 ? `\n\nCustom field ids:\n${ids.join('\n')}` : ''}`,
      );
    },
  );

  tool(
    'list_components',
    {
      title: 'List components',
      description: 'Components of a project with lead and default assignee.',
      inputSchema: { project: ProjectKey },
      readOnly: true,
    },
    async ({ project }) => {
      const list = await services.components.list(principal, project);
      return text(
        list
          .map(
            (component) =>
              `- ${component.name}${component.lead ? ` (lead: ${component.lead.displayName})` : ''}${component.description ? `: ${component.description}` : ''}`,
          )
          .join('\n') || 'No components.',
      );
    },
  );

  // ---------------------------------------------------------------- issues

  tool(
    'search_issues',
    {
      title: 'Search issues with TQL',
      description:
        'Runs a TQL query (Jira-like, e.g. `project = WEB AND status != Done ORDER BY priority`). One line per issue.',
      inputSchema: {
        query: SearchRequest.shape.query,
        limit: z.number().int().min(1).max(100).default(20),
        offset: SearchRequest.shape.offset,
      },
      readOnly: true,
    },
    async ({ query, limit, offset }) => {
      const result = await search.search(principal, { query, limit, offset });
      const shown = result.issues.length;
      const head =
        result.total === 0
          ? 'No issues match.'
          : `${result.total} issues${shown < result.total ? `, showing ${offset + 1}–${offset + shown}` : ''}:`;
      return text([head, ...result.issues.map(issueLine)].join('\n'), {
        total: result.total,
        issues: result.issues.map((issue) => ({
          key: issue.key,
          summary: issue.summary,
          status: issue.status.name,
        })),
      });
    },
  );

  tool(
    'get_issue',
    {
      title: 'Get an issue',
      description:
        'An issue with its fields, links, sub-issues and Markdown description; optionally its comments.',
      inputSchema: { key: IssueKey, comments: z.boolean().default(false) },
      readOnly: true,
    },
    async ({ key, comments }) => {
      const shown = await showIssue(key);
      if (!comments) return shown;
      const list = await issues.comments(principal, key);
      const first = shown.content[0];
      return {
        ...shown,
        content: [
          {
            type: 'text',
            text: `${first?.type === 'text' ? first.text : ''}\n\n## Comments\n\n${commentsMarkdown(list)}`,
          },
        ],
      };
    },
  );

  tool(
    'create_issue',
    {
      title: 'Create an issue',
      description:
        'Creates an issue; the description is Markdown. Mention people with @email. Custom fields by field id (see get_project).',
      inputSchema: {
        ...CreateIssueRequest.shape,
        description: MarkdownText.optional().describe('Markdown'),
      },
    },
    async ({ description, ...rest }) => {
      const created = await issues.create(principal, {
        ...rest,
        description: description ? { markdown: description } : null,
      });
      await audited('create_issue', created.id);
      return showIssue(created.key);
    },
  );

  tool(
    'update_issue',
    {
      title: 'Update an issue',
      description:
        'Changes the given fields only; the description is Markdown, null clears a field. Use transition_issue for the status and assign_issue for the assignee.',
      inputSchema: {
        key: IssueKey,
        ...UpdateIssueRequest.omit({ assigneeId: true }).shape,
        description: MarkdownText.nullable().optional().describe('Markdown'),
      },
    },
    async ({ key, description, ...rest }) => {
      const updated = await issues.update(principal, key, {
        ...rest,
        ...(description !== undefined
          ? { description: description === null ? null : { markdown: description } }
          : {}),
      });
      await audited('update_issue', updated.id);
      return showIssue(updated.key);
    },
  );

  tool(
    'transition_issue',
    {
      title: 'Change the status',
      description:
        'Moves an issue to another status. Without `to` it lists the transitions allowed now. `to` is a target status name or transition id.',
      inputSchema: {
        key: IssueKey,
        to: z.string().min(1).optional(),
        resolution: TransitionRequest.shape.resolution,
      },
    },
    async ({ key, to, resolution }) => {
      const available = await issues.transitions(principal, key);
      const list = available
        .map((entry) => `- ${entry.to.name} (transition ${entry.id}: ${entry.name})`)
        .join('\n');
      if (!to) return text(list ? `Allowed transitions:\n${list}` : 'No transitions available.');
      // "In Progress", "in-progress" and "in_progress" all mean the same status.
      const norm = (value: string) =>
        value
          .toLowerCase()
          .replace(/[\s_-]+/g, ' ')
          .trim();
      const wanted = norm(to);
      const match = available.find(
        (entry) =>
          entry.id === to ||
          [entry.to.name, entry.to.key, entry.name].some((name) => norm(name) === wanted),
      );
      if (!match) {
        return {
          isError: true,
          content: [{ type: 'text', text: `"${to}" is not allowed now. Allowed:\n${list}` }],
        };
      }
      const moved = await issues.transition(principal, key, {
        transitionId: match.id,
        ...(resolution ? { resolution } : {}),
      });
      await audited('transition_issue', moved.id);
      return showIssue(moved.key);
    },
  );

  tool(
    'assign_issue',
    {
      title: 'Assign an issue',
      description: 'Sets the assignee: "me", an e-mail address, a user id, or null to unassign.',
      inputSchema: { key: IssueKey, assignee: z.string().min(1).max(200).nullable() },
    },
    async ({ key, assignee }) => {
      let assigneeId: string | null = null;
      if (assignee === 'me') assigneeId = principal.userId;
      else if (assignee) {
        const [person] = await services.database.db
          .select({ id: users.id })
          .from(users)
          .where(
            assignee.includes('@')
              ? eq(sql`lower(${users.email})`, assignee.toLowerCase())
              : eq(sql`${users.id}::text`, assignee),
          );
        if (!person) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Nobody found for "${assignee}".` }],
          };
        }
        assigneeId = person.id;
      }
      const updated = await issues.update(principal, key, { assigneeId });
      await audited('assign_issue', updated.id);
      return showIssue(updated.key);
    },
  );

  tool(
    'add_comment',
    {
      title: 'Comment on an issue',
      description: 'Adds a Markdown comment; mention people with @email.',
      inputSchema: { key: IssueKey, body: MarkdownText.min(1) },
    },
    async ({ key, body }) => {
      const comment = await issues.addComment(principal, key, { body: { markdown: body } });
      await audited('add_comment', comment.id);
      return text(`Comment added to ${key}.`, { id: comment.id });
    },
  );

  tool(
    'link_issues',
    {
      title: 'Link two issues',
      description:
        'Links `key` to `issueKey` with a type such as blocks, duplicates, relates or clones. direction "outward": key blocks issueKey; "inward": key is blocked by issueKey.',
      inputSchema: { key: IssueKey, ...CreateIssueLinkRequest.shape },
    },
    async ({ key, ...link }) => {
      const updated = await issues.addLink(principal, key, link);
      await audited('link_issues', updated.id);
      return text(`Linked ${key} and ${link.issueKey}.`);
    },
  );

  tool(
    'log_work',
    {
      title: 'Log work',
      description:
        'Logs time spent on an issue, e.g. "2h 30m"; the remaining estimate goes down unless told otherwise.',
      inputSchema: { key: IssueKey, ...CreateWorklogRequest.shape },
    },
    async ({ key, ...worklog }) => {
      const logged = await services.worklogs.create(principal, key, worklog);
      await audited('log_work', logged.id);
      return text(`Logged on ${key}.`, { id: logged.id, seconds: logged.timeSpentSeconds });
    },
  );

  tool(
    'get_issue_history',
    {
      title: 'Issue history',
      description: 'Changes of an issue, newest first, marked when made via MCP.',
      inputSchema: { key: IssueKey },
      readOnly: true,
    },
    async ({ key }) => text(historyMarkdown(await issues.history(principal, key))),
  );
  // ---------------------------------------------------------------- agile (E-53)

  const BoardId = z.uuid().describe('Board id from list_boards');

  tool(
    'list_boards',
    {
      title: 'List boards',
      description: 'Boards you can see, optionally of one project.',
      inputSchema: { project: ProjectKey.optional() },
      readOnly: true,
    },
    async ({ project }) => {
      const list = await services.boards.list(principal, project);
      return text(
        list
          .map((board) => `- ${board.name} (${board.type}, ${board.project.key}): id ${board.id}`)
          .join('\n') || 'No boards.',
        { boards: list.map(({ id, name, type }) => ({ id, name, type })) },
      );
    },
  );

  tool(
    'get_board',
    {
      title: 'Get a board',
      description:
        'The board columns with their cards in rank order (one line per card); optionally only your cards.',
      inputSchema: { board: BoardId, onlyMine: z.boolean().default(false) },
      readOnly: true,
    },
    async ({ board, onlyMine }) => {
      const data = await services.boards.issues(principal, board, onlyMine ? ['mine'] : []);
      const lines = [`# ${data.board.name} (${data.board.type}, scope: ${data.board.query})`];
      for (const column of data.board.columns) {
        const cards = data.issues.filter((issue) => column.statusIds.includes(issue.status.id));
        const limit = column.wipMax !== null ? ` / max ${column.wipMax}` : '';
        lines.push('', `## ${column.name} (${cards.length}${limit})`, ...cards.map(issueLine));
      }
      if (data.truncated)
        lines.push('', 'More than 500 issues match; only the first 500 are shown.');
      return text(lines.join('\n'));
    },
  );

  tool(
    'move_card',
    {
      title: 'Move a card on a board',
      description:
        'Moves an issue into a board column (by column name) through the workflow, optionally next to another card. Fails with the possible columns when the workflow does not allow it.',
      inputSchema: {
        board: BoardId,
        key: IssueKey,
        column: z.string().min(1).describe('Column name'),
        afterKey: IssueKey.optional().describe('Place directly below this card'),
        beforeKey: IssueKey.optional().describe('Place directly above this card'),
      },
    },
    async ({ board, key, column, afterKey, beforeKey }) => {
      const config = await services.boards.get(principal, board);
      const target = config.columns.find(
        (entry) => entry.name.toLowerCase() === column.toLowerCase(),
      );
      if (!target) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `No column "${column}". Columns: ${config.columns.map((entry) => entry.name).join(', ')}`,
            },
          ],
        };
      }
      const moved = await services.boards.move(principal, board, {
        issueKey: key,
        columnId: target.id,
        afterKey,
        beforeKey,
      });
      await audited('move_card', moved.id);
      return text(`${moved.key} is now in "${target.name}" (status ${moved.status.name}).`);
    },
  );

  tool(
    'rank_issue',
    {
      title: 'Rank an issue',
      description:
        'Moves an issue directly below `afterKey` and/or above `beforeKey` in the global rank (same order on every board and backlog).',
      inputSchema: { key: IssueKey, afterKey: IssueKey.optional(), beforeKey: IssueKey.optional() },
    },
    async ({ key, afterKey, beforeKey }) => {
      if (!afterKey && !beforeKey) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Give afterKey, beforeKey or both.' }],
        };
      }
      await issues.rank(principal, key, { afterKey, beforeKey });
      await audited('rank_issue', key);
      return text(`Ranked ${key}.`);
    },
  );
  // ---------------------------------------------------------------- sprints (E-55)

  tool(
    'get_backlog',
    {
      title: 'Backlog of a Scrum board',
      description: 'Open sprints with their issues, then the backlog, in rank order.',
      inputSchema: { board: BoardId },
      readOnly: true,
    },
    async ({ board }) => {
      const data = await services.sprints.backlog(principal, board);
      const lines: string[] = [];
      for (const { sprint, issues: members } of data.sprints) {
        lines.push(
          `## ${sprint.name} (${sprint.state}${sprint.endDate ? `, ends ${sprint.endDate}` : ''}): id ${sprint.id}`,
          ...(sprint.goal ? [`Goal: ${sprint.goal}`] : []),
          ...members.map(issueLine),
          '',
        );
      }
      lines.push('## Backlog', ...data.backlog.map(issueLine));
      return text(lines.join('\n'));
    },
  );

  tool(
    'get_active_sprint',
    {
      title: 'Active sprint of a board',
      description: 'The running sprint with goal, dates and its issues by board column.',
      inputSchema: { board: BoardId },
      readOnly: true,
    },
    async ({ board }) => {
      const data = await services.boards.issues(principal, board, []);
      if (!data.sprint) return text('No sprint is running on this board.');
      const lines = [
        `# ${data.sprint.name} (${data.sprint.startDate} – ${data.sprint.endDate})`,
        ...(data.sprint.goal ? [`Goal: ${data.sprint.goal}`] : []),
      ];
      for (const column of data.board.columns) {
        const cards = data.issues.filter((issue) => column.statusIds.includes(issue.status.id));
        lines.push('', `## ${column.name} (${cards.length})`, ...cards.map(issueLine));
      }
      return text(lines.join('\n'), { sprintId: data.sprint.id });
    },
  );

  tool(
    'move_to_sprint',
    {
      title: 'Move issues into a sprint',
      description:
        'Moves issues into a sprint (id from get_backlog) or, with sprint "backlog", out of their sprint.',
      inputSchema: {
        keys: z.array(IssueKey).min(1).max(100),
        sprint: z.string().min(1).describe('Sprint id or "backlog"'),
      },
    },
    async ({ keys, sprint }) => {
      const target = sprint.toLowerCase() === 'backlog' ? null : sprint;
      await services.sprints.moveIssues(principal, keys, target);
      for (const key of keys) await audited('move_to_sprint', key);
      return text(`Moved ${keys.join(', ')} ${target ? 'into the sprint' : 'to the backlog'}.`);
    },
  );
}
