import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type CallToolResult, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Principal } from '../core/http/principal.js';
import type { SearchService } from '../search/search.service.js';
import type { ToolHandler } from './tools.js';

/** JSON-RPC code for an unknown resource (MCP specification). */
const RESOURCE_NOT_FOUND = -32002;

const textOf = (result: CallToolResult) =>
  result.content.map((part) => (part.type === 'text' ? part.text : '')).join('\n');

async function run(
  handlers: Map<string, ToolHandler>,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const handler = handlers.get(name);
  if (!handler) throw new Error(`Tool ${name} is missing`);
  const result = await handler(args);
  if (result.isError) throw new McpError(RESOURCE_NOT_FOUND, textOf(result));
  return textOf(result);
}

const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

/**
 * Issues, pages, boards and sprints as MCP resources (D-MCP-08, E-114), read with the caller's
 * rights through the same code as the tools; Markdown like the tools return it.
 */
export function registerResources(
  server: McpServer,
  principal: Principal,
  handlers: Map<string, ToolHandler>,
  search: SearchService,
) {
  const markdown = (uri: URL, text: string) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text }],
  });

  server.registerResource(
    'issue',
    new ResourceTemplate('lenipo://issue/{key}', {
      // The caller's open issues, so clients can offer them without a search.
      list: async () => {
        const result = await search.search(principal, {
          query: 'assignee = currentUser() AND resolution is EMPTY ORDER BY updated DESC',
          limit: 50,
          offset: 0,
        });
        return {
          resources: result.issues.map((issue) => ({
            uri: `lenipo://issue/${issue.key}`,
            name: `${issue.key} ${issue.summary}`,
            mimeType: 'text/markdown',
          })),
        };
      },
    }),
    {
      title: 'Issue',
      description:
        'An issue with fields, links, description and comments, e.g. lenipo://issue/WEB-123.',
      mimeType: 'text/markdown',
    },
    async (uri, variables) =>
      markdown(uri, await run(handlers, 'get_issue', { key: one(variables.key), comments: true })),
  );

  server.registerResource(
    'page',
    new ResourceTemplate('lenipo://page/{id}', { list: undefined }),
    {
      title: 'Wiki page',
      description: 'The published version of a wiki page as Markdown, e.g. lenipo://page/<uuid>.',
      mimeType: 'text/markdown',
    },
    async (uri, variables) =>
      markdown(uri, await run(handlers, 'get_page', { page: one(variables.id) })),
  );

  server.registerResource(
    'board',
    new ResourceTemplate('lenipo://board/{id}', { list: undefined }),
    {
      title: 'Board',
      description: 'A board with its columns and cards in rank order, e.g. lenipo://board/<uuid>.',
      mimeType: 'text/markdown',
    },
    async (uri, variables) =>
      markdown(uri, await run(handlers, 'get_board', { board: one(variables.id) })),
  );

  server.registerResource(
    'sprint',
    new ResourceTemplate('lenipo://sprint/{id}', { list: undefined }),
    {
      title: 'Sprint',
      description:
        'A sprint report: goal, dates, completed and open issues, scope changes, e.g. lenipo://sprint/<uuid>.',
      mimeType: 'text/markdown',
    },
    async (uri, variables) =>
      markdown(uri, await run(handlers, 'get_sprint_report', { sprint: one(variables.id) })),
  );
}

/**
 * Prompt templates for recurring work (D-MCP-09, E-114). Where it is cheap they bring the data
 * along; otherwise they name the tools to use. Changes are always proposed before they are made.
 */
export function registerPrompts(server: McpServer, handlers: Map<string, ToolHandler>) {
  const user = (text: string) => ({
    messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }],
  });
  /** Data for a prompt; a failure becomes a note the agent can act on. */
  const data = async (name: string, args: Record<string, unknown>) => {
    const result = await handlers.get(name)?.(args);
    if (!result) return '(No data)';
    return result.isError ? `(Could not load the data: ${textOf(result)})` : textOf(result);
  };

  server.registerPrompt(
    'sprint_review',
    {
      title: 'Summarize a sprint review',
      description: 'A summary of a sprint for stakeholders: goal, results, open work, risks.',
      argsSchema: { sprint: z.string().describe('Sprint id, e.g. from get_backlog') },
    },
    async ({ sprint }) =>
      user(
        [
          'Summarize this sprint for a sprint review with stakeholders. Write in the language of the sprint data.',
          'Cover: whether the sprint goal was reached, what was completed (grouped by theme, not issue by issue), what stays open and why, scope changes during the sprint, and risks or dependencies for the next sprint. Keep it to one page; name issue keys where they help.',
          '',
          await data('get_sprint_report', { sprint }),
        ].join('\n'),
      ),
  );

  server.registerPrompt(
    'release_notes',
    {
      title: 'Write release notes',
      description: 'Release notes for a version from the issues fixed in it.',
      argsSchema: {
        project: z.string().describe('Project key, e.g. WEB'),
        version: z.string().describe('Version name, e.g. 2.4'),
      },
    },
    async ({ project, version }) =>
      user(
        [
          `Write release notes for ${project} ${version} from the issues below. Group them into new features, improvements and fixed bugs; write for users, not developers, one line each, and leave out internal tasks. Ask before publishing them anywhere; if wanted, create a wiki page with create_page.`,
          '',
          await data('search_issues', {
            query: `project = ${project} AND fixVersion = "${version.replace(/"/g, '\\"')}" ORDER BY issuetype, key`,
            limit: 100,
          }),
        ].join('\n'),
      ),
  );

  server.registerPrompt(
    'backlog_cleanup',
    {
      title: 'Clean up a backlog',
      description: 'Find duplicates, stale and unclear items and missing estimates in a backlog.',
      argsSchema: { board: z.string().describe('Board id, e.g. from list_boards') },
    },
    async ({ board }) =>
      user(
        [
          'Review this backlog and propose a clean-up: likely duplicates (link or close them), items untouched for a long time, items too vague to estimate (suggest a sharper summary or acceptance criteria), missing estimates, and a better order at the top. Present the proposals as a list and change nothing before I confirm; then use update_issue, link_issues, transition_issue or rank_issue.',
          '',
          await data('get_backlog', { board }),
        ].join('\n'),
      ),
  );

  server.registerPrompt(
    'bug_from_error',
    {
      title: 'Create a bug report from an error message',
      description:
        'A well-structured bug from an error message or stack trace, after a duplicate check.',
      argsSchema: {
        project: z.string().describe('Project key, e.g. WEB'),
        error: z.string().describe('The error message, log excerpt or stack trace'),
      },
    },
    async ({ project, error }) =>
      user(
        [
          `Create a bug in project ${project} from the error below.`,
          '1. First look for an existing issue with search_issues (e.g. text ~ "<the key part of the message>" AND resolution is EMPTY); if one fits, show it and ask whether to comment there instead.',
          '2. Otherwise draft the bug: a short summary naming the symptom, and a description with Steps to reproduce (as far as known), Expected, Actual, Environment and the relevant excerpt of the error in a code block. Use get_field_schema for required fields.',
          '3. Show the draft, and create it with create_issue (issue type Bug) once I agree.',
          '',
          '```',
          error.slice(0, 20_000),
          '```',
        ].join('\n'),
      ),
  );

  server.registerPrompt(
    'retro_prep',
    {
      title: 'Prepare a retrospective',
      description: 'A retrospective draft from a sprint: what went well, what did not, questions.',
      argsSchema: { sprint: z.string().describe('Sprint id, e.g. from get_backlog') },
    },
    async ({ sprint }) =>
      user(
        [
          'Prepare a retrospective for this sprint. From the data, collect observations for "What went well" and "What did not go well" (e.g. carry-over, scope changes, long-running issues), and suggest three questions for the team. Do not invent feelings or opinions; mark guesses as such. If wanted, put it on a wiki page with create_page (the Retrospective blueprint fits).',
          '',
          await data('get_sprint_report', { sprint }),
        ].join('\n'),
      ),
  );
}
