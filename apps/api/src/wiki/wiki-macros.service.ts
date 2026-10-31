import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type {
  EmbedHosts,
  LabelledPage,
  MacroPageQuery,
  PagePropertiesReport,
  WikiTask,
} from '@tasklore/shared';
import { and, desc, eq, gt, inArray, isNull, type SQL, sql } from 'drizzle-orm';
import { AccessService } from '../access/access.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { pages, pageVersions, spaces, systemSettings, users } from '../db/schema/index.js';
import { plainText } from '../tracking/rich-text.js';
import { pageVisible } from './page-restrictions.js';
import { SpaceService } from './space.service.js';
import { SpaceAccessService } from './space-access.service.js';

const EMBEDS = 'embeds';
const DEFAULT_HOSTS = [
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'www.figma.com',
];
/** Pages scanned for tasks and properties at most. */
const MAX_PAGES = 500;

interface JsonNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
  text?: string;
}

function walk(node: JsonNode, visit: (node: JsonNode) => boolean | undefined): void {
  // A visitor returning true skips the children.
  if (visit(node)) return;
  for (const child of node.content ?? []) walk(child, visit);
}

/** The first date in a task: 2026-11-30 or 30.11.2026. */
function dueOf(text: string): string | null {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) return iso[0];
  const german = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/.exec(text);
  if (!german) return null;
  const [, day, month, year] = german as unknown as [string, string, string, string];
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Data for wiki macros that read across pages (TL-26, E-107): recently updated pages, the
 * page-properties report, the task report, and the embed allow-list. Always as the reader.
 */
@Injectable()
export class WikiMacrosService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(SpaceService) private readonly spaces: SpaceService,
    @Inject(SpaceAccessService) private readonly spaceAccess: SpaceAccessService,
  ) {}

  /** Published pages the reader may see, optionally of one space. */
  private async visible(principal: Principal, spaceKey: string | undefined): Promise<SQL> {
    const space = spaceKey ? (await this.spaces.find(principal, spaceKey)).space : null;
    return and(
      isNull(pages.deletedAt),
      gt(pages.version, 0),
      space ? eq(pages.spaceId, space.id) : undefined,
      await this.spaceAccess.viewableCondition(principal.userId),
      pageVisible(principal.userId),
    ) as SQL;
  }

  async recent(principal: Principal, query: MacroPageQuery): Promise<LabelledPage[]> {
    const rows = await this.database.db
      .select({
        id: pages.id,
        title: pages.title,
        labels: pages.labels,
        publishedAt: pages.publishedAt,
        spaceKey: spaces.key,
        spaceName: spaces.name,
      })
      .from(pages)
      .innerJoin(spaces, eq(spaces.id, pages.spaceId))
      .where(
        and(
          await this.visible(principal, query.space),
          query.label
            ? sql`${pages.labels} @> array[${query.label.toLowerCase()}]::text[]`
            : undefined,
        ),
      )
      .orderBy(desc(pages.publishedAt))
      .limit(query.limit);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      labels: row.labels,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      space: { key: row.spaceKey, name: row.spaceName },
    }));
  }

  /** Published content of the visible pages matching the query. */
  private async contents(principal: Principal, query: MacroPageQuery) {
    return this.database.db
      .select({
        id: pages.id,
        title: pages.title,
        spaceKey: spaces.key,
        content: pageVersions.content,
      })
      .from(pages)
      .innerJoin(spaces, eq(spaces.id, pages.spaceId))
      .innerJoin(
        pageVersions,
        and(eq(pageVersions.pageId, pages.id), eq(pageVersions.number, pages.version)),
      )
      .where(
        and(
          await this.visible(principal, query.space),
          query.label
            ? sql`${pages.labels} @> array[${query.label.toLowerCase()}]::text[]`
            : undefined,
        ),
      )
      .orderBy(pages.title)
      .limit(MAX_PAGES);
  }

  async properties(principal: Principal, query: MacroPageQuery): Promise<PagePropertiesReport> {
    const keys: string[] = [];
    const rows: PagePropertiesReport['rows'] = [];
    for (const page of await this.contents(principal, query)) {
      let found: JsonNode | undefined;
      walk(page.content as JsonNode, (node) => {
        if (found) return true;
        if (node.type === 'pageProperties') {
          found = node;
          return true;
        }
        return undefined;
      });
      if (!found) continue;
      const values: Record<string, string> = {};
      walk(found, (node) => {
        if (node.type !== 'tableRow') return undefined;
        const [key, value] = (node.content ?? []).map((cell) => plainText(cell, 500).trim());
        if (key && node.content?.[0]?.type !== 'tableHeader') {
          values[key] = value ?? '';
          if (!keys.includes(key)) keys.push(key);
        }
        return true;
      });
      rows.push({ page: { id: page.id, title: page.title, spaceKey: page.spaceKey }, values });
    }
    return { keys, rows };
  }

  async tasks(principal: Principal, query: MacroPageQuery): Promise<WikiTask[]> {
    const tasks: (Omit<WikiTask, 'assignees'> & { ids: string[] })[] = [];
    for (const page of await this.contents(principal, { ...query, label: query.label })) {
      walk(page.content as JsonNode, (node) => {
        if (node.type !== 'taskItem') return undefined;
        if (node.attrs?.checked) return true;
        const ids: string[] = [];
        walk(node, (inner) => {
          // Nested task lists are tasks of their own.
          if (inner !== node && inner.type === 'taskList') return true;
          if (inner.type === 'mention' && typeof inner.attrs?.id === 'string')
            ids.push(inner.attrs.id);
          return undefined;
        });
        const own = {
          ...node,
          content: (node.content ?? []).filter((child) => child.type !== 'taskList'),
        };
        const text = plainText(own, 500).trim();
        tasks.push({
          page: { id: page.id, title: page.title, spaceKey: page.spaceKey },
          text,
          ids,
          due: dueOf(text),
        });
        return undefined;
      });
    }
    const mine = query.assignee === 'me';
    const kept = tasks.filter((task) => !mine || task.ids.includes(principal.userId));
    const ids = [...new Set(kept.flatMap((task) => task.ids))];
    const names = new Map(
      (ids.length === 0
        ? []
        : await this.database.db
            .select({ id: users.id, displayName: users.displayName })
            .from(users)
            .where(inArray(users.id, ids))
      ).map((user) => [user.id, user]),
    );
    return kept
      .map(({ ids: own, ...task }) => ({
        ...task,
        assignees: own.flatMap((id) => {
          const user = names.get(id);
          return user ? [user] : [];
        }),
      }))
      .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
      .slice(0, query.limit * 10);
  }

  async embedHosts(): Promise<EmbedHosts> {
    const [row] = await this.database.db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, EMBEDS));
    return { hosts: (row?.value as EmbedHosts | undefined)?.hosts ?? DEFAULT_HOSTS };
  }

  async setEmbedHosts(principal: Principal, value: EmbedHosts): Promise<EmbedHosts> {
    if (!(await this.access.hasGlobal(principal.userId, 'admin'))) {
      throw new ForbiddenException('Requires administration');
    }
    const hosts = [
      ...new Set(value.hosts.map((host) => host.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))),
    ];
    await this.database.db
      .insert(systemSettings)
      .values({ key: EMBEDS, value: { hosts } })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: { hosts }, updatedAt: new Date() },
      });
    return { hosts };
  }
}
