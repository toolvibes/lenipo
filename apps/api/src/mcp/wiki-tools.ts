import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ForbiddenException } from '@nestjs/common';
import { docToMarkdown, headingsOf, markdownToDoc } from '@tasklore/editor';
import type { RichText } from '@tasklore/shared';
import { z } from 'zod';
import type { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import type { EverythingService } from '../search/everything.service.js';
import type { DraftService } from '../wiki/draft.service.js';
import type { PageService } from '../wiki/page.service.js';
import type { PageCommentService } from '../wiki/page-comment.service.js';
import type { SpaceService } from '../wiki/space.service.js';

export interface WikiToolServices {
  spaces: SpaceService;
  pages: PageService;
  drafts: DraftService;
  pageComments: PageCommentService;
  everything: EverythingService;
  audit: AuditService;
}

type Tool = <Shape extends z.ZodRawShape>(
  name: string,
  config: { title: string; description: string; inputSchema: Shape; readOnly?: boolean },
  handler: (args: z.infer<z.ZodObject<Shape>>) => Promise<CallToolResult>,
) => void;

const PageId = z.uuid().describe('Page id, from get_page_tree or search_pages');
const SpaceKey = z.string().min(1).max(10).describe('Space key, e.g. DOCS');
const Markdown = z
  .string()
  .max(200_000)
  .describe(
    'Markdown. Macros: > [!NOTE] … (also TIP, IMPORTANT, WARNING), :::expand Title … :::, ::toc, ::children, ::issues{query="…"}, :status[Text]{color=green}, :issue[WEB-1]; mentions as @[Name](user:<uuid>).',
  );

function text(markdown: string, structured?: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text: markdown }],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

const canonical = (doc: unknown) => docToMarkdown(doc).trim();

/**
 * Wiki tools for agents (D-MCP wiki tools, E-74): reading published pages and drafts, and
 * changing drafts through the collab service, so people editing at the same time keep their
 * text and see the agent. Publishing stays a separate, deliberate step.
 */
export function registerWikiTools(tool: Tool, principal: Principal, services: WikiToolServices) {
  const { spaces, pages, drafts, pageComments, everything } = services;

  const scope = (needed: 'wiki:read' | 'wiki:write') => {
    if (!('scopes' in principal)) return;
    const granted =
      principal.scopes.includes(needed) ||
      (needed === 'wiki:read' && principal.scopes.includes('wiki:write'));
    if (!granted) throw new ForbiddenException(`This token lacks the ${needed} scope`);
  };
  const audited = (name: string, pageId: string) =>
    services.audit.record({
      action: `mcp.${name}`,
      actorId: principal.userId,
      via: 'mcp',
      targetType: 'page',
      targetId: pageId,
    });

  tool(
    'list_spaces',
    {
      title: 'List wiki spaces',
      description: 'Lore spaces you can read, with key, name and linked project.',
      inputSchema: {},
      readOnly: true,
    },
    async () => {
      scope('wiki:read');
      const list = await spaces.list(principal);
      return text(
        list
          .map(
            (space) =>
              `- ${space.key}: ${space.name}${space.project ? ` (project ${space.project.key})` : ''}${space.description ? ` — ${space.description}` : ''}`,
          )
          .join('\n') || 'No spaces.',
        { spaces: list.map(({ key, name, homePageId }) => ({ key, name, homePageId })) },
      );
    },
  );

  tool(
    'get_page_tree',
    {
      title: 'Page tree of a space',
      description: 'All pages of a space as an indented outline with ids; drafts are marked.',
      inputSchema: { space: SpaceKey },
      readOnly: true,
    },
    async ({ space }) => {
      scope('wiki:read');
      const entries = await pages.tree(principal, space.toUpperCase());
      const depth = new Map<string, number>();
      const lines = entries.map((entry) => {
        const level = entry.parentId ? (depth.get(entry.parentId) ?? 0) + 1 : 0;
        depth.set(entry.id, level);
        return `${'  '.repeat(level)}- ${entry.title} (${entry.id})${entry.published ? '' : ' [draft]'}`;
      });
      return text(lines.join('\n') || 'No pages.', { pages: entries });
    },
  );

  tool(
    'search_pages',
    {
      title: 'Search wiki pages',
      description:
        'Full-text search over published pages you can read (German and English, the last word as a prefix, "phrases", -word).',
      inputSchema: {
        query: z.string().min(1).max(200),
        project: z.string().max(10).optional().describe('Only spaces linked to this project'),
      },
      readOnly: true,
    },
    async ({ query, project }) => {
      scope('wiki:read');
      const result = await everything.search(principal, {
        q: query,
        type: 'page',
        project,
        limit: 20,
      });
      const lines = result.pages.map(
        (page) =>
          `- ${page.title} (${page.id}) in ${page.space.key}: ${page.snippet.map((part) => (part.hit ? `**${part.text}**` : part.text)).join('')}`,
      );
      return text(
        result.counts.page === 0
          ? 'No pages match.'
          : `${result.counts.page} pages${result.pages.length < result.counts.page ? `, showing ${result.pages.length}` : ''}:\n${lines.join('\n')}`,
        {
          total: result.counts.page,
          pages: result.pages.map(({ id, title, space }) => ({ id, title, space: space.key })),
        },
      );
    },
  );

  tool(
    'get_page',
    {
      title: 'Read a page',
      description:
        'The published version as Markdown. With draft: true the live draft instead (needs edit rights), noting whether it differs from the published version.',
      inputSchema: { page: PageId, draft: z.boolean().optional() },
      readOnly: true,
    },
    async ({ page: id, draft }) => {
      scope('wiki:read');
      const page = await pages.get(principal, id);
      const path = [...page.ancestors.map((ancestor) => ancestor.title), page.title].join(' / ');
      const head = `# ${page.title}\n\n${page.space.key}: ${path} · version ${page.version}${page.publishedAt ? ` of ${page.publishedAt.slice(0, 10)}` : ' (never published)'}`;
      if (draft) {
        const content = (await drafts.read(principal, id)) ?? (page.content as RichText | null);
        const published = page.content ? canonical(page.content) : '';
        const body = content ? canonical(content) : '';
        const note =
          body === published
            ? 'The draft equals the published version.'
            : 'The draft has unpublished changes.';
        return text(`${head} · draft\n${note}\n\n${body}`, {
          id,
          title: page.title,
          version: page.version,
          draft: true,
        });
      }
      const body = page.content
        ? canonical(page.content)
        : '(No published version yet; read it with draft: true.)';
      return text(`${head}\n\n${body}`, { id, title: page.title, version: page.version });
    },
  );

  tool(
    'get_page_history',
    {
      title: 'Version history of a page',
      description: 'Published versions, newest first, with author and change comment.',
      inputSchema: { page: PageId },
      readOnly: true,
    },
    async ({ page: id }) => {
      scope('wiki:read');
      const versions = await pages.versions(principal, id);
      return text(
        versions
          .map(
            (version) =>
              `- v${version.number} ${version.createdAt.slice(0, 16).replace('T', ' ')} ${version.author?.displayName ?? '?'}: ${version.title}${version.comment ? ` — ${version.comment}` : ''}${version.restoredFrom ? ` (restored from v${version.restoredFrom})` : ''}`,
          )
          .join('\n') || 'Never published.',
      );
    },
  );

  tool(
    'create_page',
    {
      title: 'Create a page',
      description:
        'Creates an unpublished draft page, optionally under a parent and from Markdown or a template (template id or blueprint:meeting|decision|requirements|retro). Publish it with publish_page after review.',
      inputSchema: {
        space: SpaceKey,
        title: z.string().min(1).max(255),
        parent: PageId.optional(),
        markdown: Markdown.optional(),
        template: z.string().max(64).optional(),
      },
    },
    async ({ space, title, parent, markdown, template }) => {
      scope('wiki:write');
      const page = await pages.create(
        principal,
        space.toUpperCase(),
        { title, parentId: parent ?? null, template },
        markdown ? (markdownToDoc(markdown) as RichText) : undefined,
      );
      await audited('create_page', page.id);
      return text(
        `Created draft "${page.title}" (${page.id}) in ${page.space.key}. Not published yet.`,
        {
          id: page.id,
        },
      );
    },
  );

  tool(
    'update_page',
    {
      title: 'Change a page draft',
      description:
        'Writes Markdown into the live draft; people editing see it at once and keep their own changes. With section (the exact text of a heading) only the content under that heading up to the next heading of the same or higher level is replaced; newHeading renames that heading. Publish with publish_page.',
      inputSchema: {
        page: PageId,
        markdown: Markdown,
        section: z.string().max(255).optional(),
        newHeading: z.string().max(255).optional(),
      },
    },
    async ({ page: id, markdown, section, newHeading }) => {
      scope('wiki:write');
      await drafts.write(principal, id, markdownToDoc(markdown) as RichText, {
        section,
        newHeading,
      });
      await audited('update_page', id);
      const draft = await drafts.read(principal, id);
      return text(
        `Draft updated${section ? ` (section "${section}")` : ''}. Headings now: ${draft ? headingsOf(draft as { type: 'doc' }).join(' | ') || 'none' : 'none'}. Not published yet.`,
      );
    },
  );

  tool(
    'publish_page',
    {
      title: 'Publish a page',
      description:
        'Publishes the current live draft as a new version, with an optional change comment and new title.',
      inputSchema: {
        page: PageId,
        comment: z.string().max(500).optional(),
        title: z.string().min(1).max(255).optional(),
      },
    },
    async ({ page: id, comment, title }) => {
      scope('wiki:write');
      const page = await pages.get(principal, id);
      const content = (await drafts.read(principal, id)) ?? (page.content as RichText | null);
      if (!content) throw new ForbiddenException('The page has no content to publish');
      const published = await pages.publish(principal, id, {
        title: title ?? page.title,
        content,
        comment: comment ?? '',
      });
      await audited('publish_page', id);
      return text(`Published "${published.title}" as version ${published.version}.`, {
        id,
        version: published.version,
      });
    },
  );

  tool(
    'add_page_comment',
    {
      title: 'Comment on a page',
      description: 'Adds a comment under the page; mentions as @[Name](user:<uuid>) notify people.',
      inputSchema: { page: PageId, markdown: Markdown },
    },
    async ({ page: id, markdown }) => {
      scope('wiki:write');
      const comment = await pageComments.create(principal, id, { body: { markdown } });
      await audited('add_page_comment', id);
      return text(`Comment added (${comment.id}).`, { id: comment.id });
    },
  );
}
