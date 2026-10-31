import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  diffDocs,
  imageAttachmentIds,
  isValidDoc,
  richTextSchema,
  withoutPlaceholders,
} from '@tasklore/editor';
import type {
  Blog,
  BlogQuery,
  ContentFormat,
  CreatePageRequest,
  LabelCount,
  LabelledPage,
  MovePageRequest,
  Page,
  PageDiff,
  PageRef,
  PageRestrictions,
  PageStatus,
  PageTreeEntry,
  PageVersion,
  PageVersionSummary,
  PublishPageRequest,
  RestoreVersionRequest,
  RestrictedPage,
  RichText,
  SetPageRestrictionsRequest,
  SetPageStatusRequest,
  SpacePermission,
  TrashedPage,
  UserRef,
} from '@tasklore/shared';
import { AUTOMATION_ACTOR_ID } from '@tasklore/shared';
import { prosemirrorJSONToYDoc, yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, ne, not, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import * as Y from 'yjs';
import { AuditService } from '../audit/audit.service.js';
import { DRAFT_FIELD, DRAFT_RESET_CHANNEL, draftName } from '../collab/document-name.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import {
  collabDocuments,
  favourites,
  groups,
  pageAttachments,
  pageRestrictions,
  pages,
  pageVersions,
  spaces,
  users,
} from '../db/schema/index.js';
import { emitPageEvent } from '../notifications/events.js';
import { signal } from '../realtime/signals.js';
import { markdownOf } from '../tracking/content-format.js';
import { rankBetween } from '../tracking/rank.js';
import { plainText } from '../tracking/rich-text.js';
import { reanchorComments } from './comment-anchors.js';
import { indexIssueRefs } from './issue-refs.js';
import { pageVisible, passesEditList, seesPage } from './page-restrictions.js';
import { type SpaceRow, SpaceService } from './space.service.js';
import { SpaceAccessService } from './space-access.service.js';
import { TemplateService } from './template.service.js';
import { fillDocument, fillText, type VariableValues } from './template-variables.js';
import { autoWatch, setWatch, watchState } from './watches.js';

type PageRow = typeof pages.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Key order of JSON objects does not matter when comparing documents. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : entry,
  );
}

/** Pages of a wiki space: tree, drafts, published versions and trash (W-PAG, E-59). */
@Injectable()
export class PageService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(SpaceService) private readonly spaces: SpaceService,
    @Inject(SpaceAccessService) private readonly spaceAccess: SpaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(TemplateService) private readonly templates: TemplateService,
  ) {}

  /**
   * Loads a page and checks the permission in its space. Drafts that were never published
   * exist only for editors (E-59); for everyone else they look missing.
   */
  async authorize(
    principal: Principal,
    id: string,
    permission: SpacePermission,
    options: { deleted?: boolean } = {},
  ): Promise<{ page: PageRow; space: SpaceRow; permissions: Set<SpacePermission> }> {
    if (!UUID.test(id)) throw new NotFoundException('Page not found');
    const [row] = await this.database.db
      .select({ page: pages, spaceKey: spaces.key })
      .from(pages)
      .innerJoin(spaces, eq(spaces.id, pages.spaceId))
      .where(
        and(
          eq(pages.id, id),
          options.deleted ? isNotNull(pages.deletedAt) : isNull(pages.deletedAt),
        ),
      );
    if (!row) throw new NotFoundException('Page not found');
    let found: Awaited<ReturnType<SpaceService['find']>>;
    try {
      found = await this.spaces.find(principal, row.spaceKey);
    } catch (error) {
      if (error instanceof NotFoundException) throw new NotFoundException('Page not found');
      throw error;
    }
    if (row.page.version === 0 && !found.permissions.has('edit')) {
      throw new NotFoundException('Page not found');
    }
    // Page restrictions (TL-14, E-95): a view list that leaves the user out hides the page.
    if (!(await seesPage(this.database.db, principal.userId, row.page.id))) {
      throw new NotFoundException('Page not found');
    }
    if (permission !== 'view')
      await this.spaceAccess.require(principal, found.space.id, permission);
    // The page's own edit list narrows editing further.
    const editable =
      found.permissions.has('edit') &&
      (await passesEditList(this.database.db, principal.userId, row.page.id));
    if (permission === 'edit' && !editable) {
      throw new ForbiddenException('The page is restricted for editing');
    }
    const permissions = new Set(found.permissions);
    if (!editable) permissions.delete('edit');
    return { page: row.page, ...found, permissions };
  }

  /**
   * Of the given pages, those the user may open, with their space keys: outside the trash,
   * in a space they can view, and published unless they may edit there.
   */
  async visible(
    userId: string,
    ids: string[],
  ): Promise<Map<string, { id: string; title: string; spaceKey: string }>> {
    if (ids.length === 0) return new Map();
    const rows = await this.database.db
      .select({
        id: pages.id,
        title: pages.title,
        version: pages.version,
        spaceId: pages.spaceId,
        spaceKey: spaces.key,
      })
      .from(pages)
      .innerJoin(spaces, eq(spaces.id, pages.spaceId))
      .where(
        and(
          inArray(pages.id, ids),
          isNull(pages.deletedAt),
          await this.spaceAccess.viewableCondition(userId),
          pageVisible(userId),
        ),
      );
    const editable = new Map<string, boolean>();
    const result = new Map<string, { id: string; title: string; spaceKey: string }>();
    for (const row of rows) {
      if (row.version === 0) {
        if (!editable.has(row.spaceId)) {
          const granted = await this.spaceAccess.permissions(userId, row.spaceId);
          editable.set(row.spaceId, granted.has('edit'));
        }
        if (!editable.get(row.spaceId)) continue;
      }
      result.set(row.id, { id: row.id, title: row.title, spaceKey: row.spaceKey });
    }
    return result;
  }

  // ---------------------------------------------------------------- tree

  /**
   * The space's pages in tree order. Readers see published pages whose ancestors they can
   * see too, so the tree never has holes.
   */
  async tree(principal: Principal, spaceKey: string): Promise<PageTreeEntry[]> {
    const { space, permissions } = await this.spaces.find(principal, spaceKey);
    const rows = await this.database.db
      .select({
        id: pages.id,
        parentId: pages.parentId,
        title: pages.title,
        version: pages.version,
      })
      .from(pages)
      // Blog posts live outside the tree (TL-29).
      .where(and(eq(pages.spaceId, space.id), isNull(pages.deletedAt), eq(pages.kind, 'page')))
      .orderBy(asc(pages.rank), asc(pages.createdAt));
    // A view list that leaves the user out hides the page and everything below (E-95).
    const hidden = new Set(
      (
        await this.database.db
          .select({ id: pages.id })
          .from(pages)
          .where(
            and(
              eq(pages.spaceId, space.id),
              isNull(pages.deletedAt),
              sql`exists (select 1 from ${pageRestrictions} r where r.page_id = ${pages.id} and r.kind = 'view')`,
              not(pageVisible(principal.userId)),
            ),
          )
      ).map((row) => row.id),
    );
    const children = new Map<string | null, typeof rows>();
    for (const row of rows) {
      const list = children.get(row.parentId) ?? [];
      list.push(row);
      children.set(row.parentId, list);
    }
    const result: PageTreeEntry[] = [];
    const walk = (parentId: string | null) => {
      for (const row of children.get(parentId) ?? []) {
        if (row.version === 0 && !permissions.has('edit')) continue;
        if (hidden.has(row.id)) continue;
        result.push({
          id: row.id,
          parentId: row.parentId,
          title: row.title,
          published: row.version > 0,
        });
        walk(row.id);
      }
    };
    walk(null);
    return result;
  }

  /** Rank after the last sibling under `parentId`. */
  private async lastRank(db: Executor, spaceId: string, parentId: string | null) {
    const [last] = await db
      .select({ rank: pages.rank })
      .from(pages)
      .where(
        and(
          eq(pages.spaceId, spaceId),
          parentId ? eq(pages.parentId, parentId) : isNull(pages.parentId),
        ),
      )
      .orderBy(desc(pages.rank))
      .limit(1);
    return rankBetween(last?.rank ?? null, null);
  }

  /** A parent must be a live page of the same space. */
  private async checkParent(spaceId: string, parentId: string | null | undefined) {
    if (!parentId) return null;
    const [parent] = await this.database.db
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.id, parentId), eq(pages.spaceId, spaceId), isNull(pages.deletedAt)));
    if (!parent) throw new BadRequestException('The parent must be a page of this space');
    return parent.id;
  }

  /** A new page starts as a draft (W-PAG-03); the first page becomes the space's home. */
  /** `initial` starts the draft with this content when no template is given (MCP, E-74). */
  async create(
    principal: Principal,
    spaceKey: string,
    request: CreatePageRequest,
    initial?: RichText,
    options: { publish?: boolean; labels?: string[] } = {},
  ): Promise<Page> {
    const { space } = await this.spaces.find(principal, spaceKey, 'edit');
    const blog = request.kind === 'blog';
    let parentId = blog ? null : await this.checkParent(space.id, request.parentId);
    // A template's content becomes the new draft right away (E-72).
    const resolved = request.template
      ? await this.templates.resolve(principal, space.id, request.template)
      : null;
    let title = request.title;
    let template: { content: RichText } | null = initial ? { content: initial } : null;
    let labels: string[] = [];
    if (resolved) {
      // Variables are filled in once, when the page is created (TL-27, E-108).
      const [user] = await this.database.db
        .select({ displayName: users.displayName, timeZone: users.timeZone })
        .from(users)
        .where(eq(users.id, principal.userId));
      const values: VariableValues = {
        date: new Intl.DateTimeFormat('en-CA', {
          timeZone: user?.timeZone ?? 'Europe/Berlin',
        }).format(new Date()),
        author: user?.displayName ?? '',
        space: space.name,
        title: '',
        inputs: request.variables ?? {},
      };
      title = fillText(request.title, values).trim() || request.title;
      values.title = title;
      template = { content: fillDocument(resolved.content, values) };
      if (resolved.blueprint) {
        labels = [resolved.blueprint];
        // Pages of a blueprint gather under its index page unless placed elsewhere.
        if (!request.parentId && resolved.index) {
          parentId = await this.blueprintIndex(
            principal,
            space,
            resolved.blueprint,
            resolved.index,
          );
        }
      }
    }
    const id = uuidv7();
    await this.database.db.transaction(async (tx) => {
      if (template) {
        const draft = prosemirrorJSONToYDoc(richTextSchema, template.content, DRAFT_FIELD);
        await tx
          .insert(collabDocuments)
          .values({ name: draftName(id), state: Y.encodeStateAsUpdate(draft) });
      }
      await tx.insert(pages).values({
        id,
        spaceId: space.id,
        parentId,
        rank: await this.lastRank(tx, space.id, parentId),
        title,
        labels: [...labels, ...(options.labels ?? [])],
        kind: blog ? 'blog' : 'page',
        ownerId: principal.userId === AUTOMATION_ACTOR_ID ? null : principal.userId,
        createdById: principal.userId,
      });
      if (!space.homePageId && !blog) {
        await tx.update(spaces).set({ homePageId: id }).where(eq(spaces.id, space.id));
      }
      await autoWatch(tx, principal.userId, id);
      await signal(tx, { type: 'space', spaceKey: space.key });
    });
    // Pages made by the system are published right away (TL-28, E-109).
    if (options.publish && template) {
      await this.publish(principal, id, { title, content: template.content, comment: '' });
    }
    return this.get(principal, id);
  }

  /**
   * The index page of a blueprint in a space, created with the first page of that blueprint:
   * a report (or list) by the blueprint's label, so it stays current by itself (W-TPL-04).
   */
  async blueprintIndex(
    principal: Principal,
    space: SpaceRow,
    key: string,
    indexTitle: string,
  ): Promise<string> {
    const marker = `index-${key}`;
    const [existing] = await this.database.db
      .select({ id: pages.id })
      .from(pages)
      .where(
        and(
          eq(pages.spaceId, space.id),
          isNull(pages.deletedAt),
          sql`${pages.labels} @> array[${marker}]::text[]`,
        ),
      )
      .limit(1);
    if (existing) return existing.id;
    const index = await this.create(principal, space.key, { title: indexTitle });
    const report = [
      'decision',
      'project-plan',
      'post-mortem',
      'release-notes',
      'sprint-report',
    ].includes(key);
    await this.publish(principal, index.id, {
      title: indexTitle,
      comment: '',
      content: {
        type: 'doc',
        content: [
          report
            ? { type: 'propertiesReport', attrs: { label: key, space: space.key } }
            : { type: 'contentByLabel', attrs: { labels: key, space: space.key, limit: 50 } },
        ],
      } as RichText,
    });
    await this.database.db
      .update(pages)
      .set({ labels: [marker] })
      .where(eq(pages.id, index.id));
    return index.id;
  }

  /** The owner, unless deactivated: then the space administrators answer (TL-29, E-110). */
  private async ownerOf(ownerId: string | null): Promise<UserRef | null> {
    if (!ownerId) return null;
    const [owner] = await this.database.db
      .select({ id: users.id, displayName: users.displayName, status: users.status })
      .from(users)
      .where(eq(users.id, ownerId));
    return owner && owner.status === 'active'
      ? { id: owner.id, displayName: owner.displayName }
      : null;
  }

  async setStatus(principal: Principal, id: string, request: SetPageStatusRequest): Promise<Page> {
    const { page } = await this.authorize(principal, id, 'edit');
    if (request.ownerId) {
      const [owner] = await this.database.db
        .select({ status: users.status })
        .from(users)
        .where(eq(users.id, request.ownerId));
      if (owner?.status !== 'active')
        throw new BadRequestException('The owner must be an active user');
    }
    await this.database.db
      .update(pages)
      .set({
        status: request.status,
        ...(request.status !== page.status ? { statusChangedAt: new Date() } : {}),
        ...(request.ownerId !== undefined ? { ownerId: request.ownerId } : {}),
      })
      .where(eq(pages.id, id));
    return this.get(principal, id);
  }

  /** Published blog posts of a space, newest first, with the months for the archive. */
  async blog(principal: Principal, spaceKey: string, query: BlogQuery): Promise<Blog> {
    const { space } = await this.spaces.find(principal, spaceKey);
    const where = and(
      eq(pages.spaceId, space.id),
      eq(pages.kind, 'blog'),
      isNull(pages.deletedAt),
      gt(pages.version, 0),
      pageVisible(principal.userId),
    );
    const month = sql<string>`to_char(${pages.publishedAt}, 'YYYY-MM')`;
    const [rows, months] = await Promise.all([
      this.database.db
        .select({
          id: pages.id,
          title: pages.title,
          publishedAt: pages.publishedAt,
          text: pageVersions.text,
          authorId: users.id,
          authorName: users.displayName,
        })
        .from(pages)
        .innerJoin(
          pageVersions,
          and(eq(pageVersions.pageId, pages.id), eq(pageVersions.number, pages.version)),
        )
        .leftJoin(users, eq(users.id, pages.createdById))
        .where(and(where, query.month ? sql`${month} = ${query.month}` : undefined))
        .orderBy(desc(pages.publishedAt))
        .limit(query.limit),
      this.database.db
        .select({ month, count: sql<number>`count(*)::int` })
        .from(pages)
        .where(where)
        .groupBy(sql`1`)
        .orderBy(desc(sql`1`)),
    ]);
    return {
      posts: rows.map((row) => ({
        id: row.id,
        title: row.title,
        spaceKey: space.key,
        publishedAt: row.publishedAt?.toISOString() ?? '',
        author:
          row.authorId && row.authorName ? { id: row.authorId, displayName: row.authorName } : null,
        excerpt: row.text.slice(0, 280),
      })),
      months: months.map((entry) => ({ month: entry.month, count: entry.count })),
    };
  }

  /** Verified pages without changes for `days` become outdated (TL-29); returns how many. */
  async markOutdated(days: number): Promise<number> {
    const rows = await this.database.db
      .update(pages)
      .set({ status: 'outdated', statusChangedAt: new Date() })
      .where(
        and(
          eq(pages.status, 'verified'),
          isNull(pages.deletedAt),
          sql`coalesce(${pages.publishedAt}, ${pages.createdAt}) < now() - make_interval(days => ${days})`,
          sql`coalesce(${pages.statusChangedAt}, ${pages.createdAt}) < now() - make_interval(days => ${days})`,
        ),
      )
      .returning({ id: pages.id });
    return rows.length;
  }

  // ---------------------------------------------------------------- reading

  private async ancestors(pageId: string): Promise<PageRef[]> {
    const rows = await this.database.db.execute<{ id: string; title: string; depth: number }>(sql`
      with recursive chain(id, parent_id, title, depth) as (
        select p.id, p.parent_id, p.title, 0 from pages p where p.id = ${pageId}
        union all
        select p.id, p.parent_id, p.title, c.depth + 1
        from pages p join chain c on p.id = c.parent_id
      )
      select id, title, depth from chain where depth > 0 order by depth desc`);
    return [...rows].map((row) => ({ id: row.id, title: row.title }));
  }

  private async versionRow(pageId: string, number: number) {
    const [row] = await this.database.db
      .select({
        version: pageVersions,
        authorName: users.displayName,
      })
      .from(pageVersions)
      .leftJoin(users, eq(users.id, pageVersions.authorId))
      .where(and(eq(pageVersions.pageId, pageId), eq(pageVersions.number, number)));
    return row ?? null;
  }

  async get(principal: Principal, id: string, format: ContentFormat = 'json'): Promise<Page> {
    const { page, space, permissions } = await this.authorize(principal, id, 'view');
    const published = page.version > 0 ? await this.versionRow(page.id, page.version) : null;
    const content = (published?.version.content as RichText | undefined) ?? null;
    return {
      id: page.id,
      space: { key: space.key, name: space.name },
      parentId: page.parentId,
      ancestors: await this.ancestors(page.id),
      title: page.title,
      version: page.version,
      content: content && format === 'markdown' ? markdownOf(content) : content,
      publishedAt: page.publishedAt?.toISOString() ?? null,
      publishedBy:
        published?.version.authorId && published.authorName
          ? { id: published.version.authorId, displayName: published.authorName }
          : null,
      createdAt: page.createdAt.toISOString(),
      canEdit: permissions.has('edit'),
      favourite: await this.starred(principal.userId, page.id),
      draftChanged: permissions.has('edit') ? await this.draftChanged(page.id, content) : false,
      kind: page.kind === 'blog' ? 'blog' : 'page',
      status: page.status as PageStatus,
      owner: await this.ownerOf(page.ownerId),
      canComment: permissions.has('comment'),
      labels: page.labels,
      watch: await watchState(this.database.db, principal.userId, page.id),
      restrictions: await this.restrictionFlags(page.id),
    };
  }

  // ---------------------------------------------------------------- restrictions (TL-14, E-95)

  /** Whether the page has view or edit lists, and whether a page above limits viewing. */
  private async restrictionFlags(pageId: string) {
    const own = await this.database.db
      .selectDistinct({ kind: pageRestrictions.kind })
      .from(pageRestrictions)
      .where(eq(pageRestrictions.pageId, pageId));
    return {
      view: own.some((row) => row.kind === 'view'),
      edit: own.some((row) => row.kind === 'edit'),
      inherited: (await this.restrictedAncestors(pageId)).length > 0,
    };
  }

  /** Pages above this one with a view list. */
  private async restrictedAncestors(pageId: string): Promise<PageRef[]> {
    const ancestors = await this.ancestors(pageId);
    if (ancestors.length === 0) return [];
    const restricted = await this.database.db
      .selectDistinct({ pageId: pageRestrictions.pageId })
      .from(pageRestrictions)
      .where(
        and(
          inArray(
            pageRestrictions.pageId,
            ancestors.map((ancestor) => ancestor.id),
          ),
          eq(pageRestrictions.kind, 'view'),
        ),
      );
    const ids = new Set(restricted.map((row) => row.pageId));
    return ancestors.filter((ancestor) => ids.has(ancestor.id));
  }

  async restrictions(principal: Principal, id: string): Promise<PageRestrictions> {
    const { page } = await this.authorize(principal, id, 'view');
    return this.presentRestrictions(page.id);
  }

  private async presentRestrictions(pageId: string): Promise<PageRestrictions> {
    const rows = await this.database.db
      .select({
        kind: pageRestrictions.kind,
        userId: users.id,
        userName: users.displayName,
        groupId: groups.id,
        groupName: groups.name,
      })
      .from(pageRestrictions)
      .leftJoin(users, eq(users.id, pageRestrictions.userId))
      .leftJoin(groups, eq(groups.id, pageRestrictions.groupId))
      .where(eq(pageRestrictions.pageId, pageId));
    const list = (kind: 'view' | 'edit') => ({
      users: rows.flatMap((row) =>
        row.kind === kind && row.userId
          ? [{ id: row.userId, displayName: row.userName ?? '' }]
          : [],
      ),
      groups: rows.flatMap((row) =>
        row.kind === kind && row.groupId ? [{ id: row.groupId, name: row.groupName ?? '' }] : [],
      ),
    });
    return {
      view: list('view'),
      edit: list('edit'),
      inheritedFrom: await this.restrictedAncestors(pageId),
    };
  }

  /**
   * Replaces the page's lists; needs edit on the page. Whoever sets a non-empty list stays in
   * it, so nobody locks themselves out (E-95).
   */
  async setRestrictions(
    principal: Principal,
    id: string,
    request: SetPageRestrictionsRequest,
  ): Promise<PageRestrictions> {
    const { page } = await this.authorize(principal, id, 'edit');
    const withSelf = (input: SetPageRestrictionsRequest['view']) => {
      const userIds = new Set(input.userIds);
      if (userIds.size > 0 || input.groupIds.length > 0) userIds.add(principal.userId);
      return { userIds: [...userIds], groupIds: [...new Set(input.groupIds)] };
    };
    const lists = { view: withSelf(request.view), edit: withSelf(request.edit) };
    const userIds = [...new Set([...lists.view.userIds, ...lists.edit.userIds])];
    const groupIds = [...new Set([...lists.view.groupIds, ...lists.edit.groupIds])];
    if (userIds.length > 0) {
      const found = await this.database.db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, userIds));
      if (found.length !== userIds.length) throw new BadRequestException('Unknown user');
    }
    if (groupIds.length > 0) {
      const found = await this.database.db
        .select({ id: groups.id })
        .from(groups)
        .where(inArray(groups.id, groupIds));
      if (found.length !== groupIds.length) throw new BadRequestException('Unknown group');
    }
    await this.database.db.transaction(async (tx) => {
      await tx.delete(pageRestrictions).where(eq(pageRestrictions.pageId, page.id));
      const values = (['view', 'edit'] as const).flatMap((kind) => [
        ...lists[kind].userIds.map((userId) => ({ id: uuidv7(), pageId: page.id, kind, userId })),
        ...lists[kind].groupIds.map((groupId) => ({
          id: uuidv7(),
          pageId: page.id,
          kind,
          groupId,
        })),
      ]);
      if (values.length > 0) await tx.insert(pageRestrictions).values(values);
    });
    return this.presentRestrictions(page.id);
  }

  /** Restricted pages of a space, for its administrators even where they cannot see them. */
  async restrictedPages(principal: Principal, spaceKey: string): Promise<RestrictedPage[]> {
    const { space } = await this.spaces.find(principal, spaceKey);
    await this.spaceAccess.require(principal, space.id, 'administer');
    const rows = await this.database.db
      .selectDistinct({ id: pages.id, title: pages.title, kind: pageRestrictions.kind })
      .from(pageRestrictions)
      .innerJoin(pages, eq(pages.id, pageRestrictions.pageId))
      .where(and(eq(pages.spaceId, space.id), isNull(pages.deletedAt)));
    const byPage = new Map<string, RestrictedPage>();
    for (const row of rows) {
      const entry = byPage.get(row.id) ?? {
        id: row.id,
        title: row.title,
        view: false,
        edit: false,
      };
      entry[row.kind] = true;
      byPage.set(row.id, entry);
    }
    return [...byPage.values()].sort((a, b) => a.title.localeCompare(b.title));
  }

  /** Lifts all restrictions of a page; for space administrators, who may not see it. */
  async clearRestrictions(principal: Principal, spaceKey: string, id: string): Promise<void> {
    const { space } = await this.spaces.find(principal, spaceKey);
    await this.spaceAccess.require(principal, space.id, 'administer');
    const [page] = await this.database.db
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.id, id), eq(pages.spaceId, space.id)));
    if (!page) throw new NotFoundException('Page not found');
    await this.database.db.delete(pageRestrictions).where(eq(pageRestrictions.pageId, page.id));
  }

  /**
   * Whether the stored draft says something else than the published content (E-62). Both are
   * normalised through the schema, so default attributes and key order do not count.
   */
  private async draftChanged(pageId: string, published: RichText | null): Promise<boolean> {
    const [row] = await this.database.db
      .select({ state: collabDocuments.state })
      .from(collabDocuments)
      .where(eq(collabDocuments.name, draftName(pageId)));
    if (!row) return false;
    const doc = new Y.Doc();
    Y.applyUpdate(doc, row.state);
    const draft = yXmlFragmentToProsemirrorJSON(doc.getXmlFragment(DRAFT_FIELD));
    const normalise = (value: unknown) => {
      try {
        return canonicalJson(richTextSchema.nodeFromJSON(value).toJSON());
      } catch {
        return null;
      }
    };
    const empty = { type: 'doc', content: [{ type: 'paragraph' }] };
    return normalise(draft) !== normalise(published ?? empty);
  }

  private async starred(userId: string, pageId: string): Promise<boolean> {
    const [row] = await this.database.db
      .select({ targetId: favourites.targetId })
      .from(favourites)
      .where(
        and(
          eq(favourites.userId, userId),
          eq(favourites.kind, 'page'),
          eq(favourites.targetId, pageId),
        ),
      );
    return !!row;
  }

  async versions(principal: Principal, id: string): Promise<PageVersionSummary[]> {
    const { page } = await this.authorize(principal, id, 'view');
    const rows = await this.database.db
      .select({
        number: pageVersions.number,
        title: pageVersions.title,
        authorId: pageVersions.authorId,
        authorName: users.displayName,
        comment: pageVersions.comment,
        restoredFrom: pageVersions.restoredFrom,
        createdAt: pageVersions.createdAt,
      })
      .from(pageVersions)
      .leftJoin(users, eq(users.id, pageVersions.authorId))
      .where(eq(pageVersions.pageId, page.id))
      .orderBy(desc(pageVersions.number));
    return rows.map((row) => ({
      number: row.number,
      title: row.title,
      author:
        row.authorId && row.authorName ? { id: row.authorId, displayName: row.authorName } : null,
      comment: row.comment,
      restoredFrom: row.restoredFrom,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async version(
    principal: Principal,
    id: string,
    number: number,
    format: ContentFormat = 'json',
  ): Promise<PageVersion> {
    const { page } = await this.authorize(principal, id, 'view');
    const row = await this.versionRow(page.id, number);
    if (!row) throw new NotFoundException('Version not found');
    const content = row.version.content as RichText;
    return {
      ...this.versionSummary(row),
      content: format === 'markdown' ? markdownOf(content) : content,
    };
  }

  private versionSummary(
    row: NonNullable<Awaited<ReturnType<PageService['versionRow']>>>,
  ): PageVersionSummary {
    return {
      number: row.version.number,
      title: row.version.title,
      author:
        row.version.authorId && row.authorName
          ? { id: row.version.authorId, displayName: row.authorName }
          : null,
      comment: row.version.comment,
      restoredFrom: row.version.restoredFrom,
      createdAt: row.version.createdAt.toISOString(),
    };
  }

  /** Two versions compared block by block, words inside changed blocks (W-PAG-05, E-62). */
  async diff(principal: Principal, id: string, from: number, to: number): Promise<PageDiff> {
    const { page } = await this.authorize(principal, id, 'view');
    const [before, after] = await Promise.all([
      this.versionRow(page.id, from),
      this.versionRow(page.id, to),
    ]);
    if (!before || !after) throw new NotFoundException('Version not found');
    return {
      from: this.versionSummary(before),
      to: this.versionSummary(after),
      blocks: diffDocs(before.version.content, after.version.content),
    };
  }

  // ---------------------------------------------------------------- changing

  // ---------------------------------------------------------------- labels and watching (E-65)

  /** Replaces the labels; they are page metadata, not part of a version. */
  async setLabels(principal: Principal, id: string, labels: string[]): Promise<Page> {
    const { page, space } = await this.authorize(principal, id, 'edit');
    const next = [...new Set(labels)].sort();
    if (next.join(' ') !== [...page.labels].sort().join(' ')) {
      await this.database.db.transaction(async (tx) => {
        await tx.update(pages).set({ labels: next }).where(eq(pages.id, page.id));
        await signal(tx, { type: 'page', pageId: page.id, spaceKey: space.key });
      });
      await this.audit.record({
        action: 'page.labels-changed',
        actorId: principal.userId,
        via: principal.via,
        targetType: 'page',
        targetId: page.id,
        details: { from: page.labels, to: next },
      });
    }
    return this.get(principal, id);
  }

  /** Labels used in a space with the number of pages the caller can see that carry them. */
  async spaceLabels(principal: Principal, spaceKey: string): Promise<LabelCount[]> {
    const pagesSeen = await this.labelledPages(principal, { spaceKey });
    const counts = new Map<string, number>();
    for (const page of pagesSeen) {
      for (const label of page.labels) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts]
      .map(([label, pages]) => ({ label, pages }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Pages with a label (or any label), across the spaces the caller can view or in one space;
   * drafts only where the caller may edit.
   */
  async labelledPages(
    principal: Principal,
    filter: { label?: string; spaceKey?: string },
  ): Promise<LabelledPage[]> {
    const space = filter.spaceKey
      ? (await this.spaces.find(principal, filter.spaceKey)).space
      : null;
    const rows = await this.database.db
      .select({
        id: pages.id,
        title: pages.title,
        labels: pages.labels,
        version: pages.version,
        publishedAt: pages.publishedAt,
        spaceId: spaces.id,
        spaceKey: spaces.key,
        spaceName: spaces.name,
      })
      .from(pages)
      .innerJoin(spaces, eq(spaces.id, pages.spaceId))
      .where(
        and(
          isNull(pages.deletedAt),
          space ? eq(pages.spaceId, space.id) : undefined,
          filter.label
            ? sql`${pages.labels} @> array[${filter.label.toLowerCase()}]::text[]`
            : sql`cardinality(${pages.labels}) > 0`,
          await this.spaceAccess.viewableCondition(principal.userId),
          pageVisible(principal.userId),
        ),
      )
      .orderBy(asc(pages.title));
    const editable = new Map<string, boolean>();
    const result: LabelledPage[] = [];
    for (const row of rows) {
      if (row.version === 0) {
        if (!editable.has(row.spaceId)) {
          const granted = await this.spaceAccess.permissions(principal.userId, row.spaceId);
          editable.set(row.spaceId, granted.has('edit'));
        }
        if (!editable.get(row.spaceId)) continue;
      }
      result.push({
        id: row.id,
        title: row.title,
        space: { key: row.spaceKey, name: row.spaceName },
        labels: row.labels,
        publishedAt: row.publishedAt?.toISOString() ?? null,
      });
    }
    return result;
  }

  /** Follows or stops following the page alone or with everything below it. */
  async watch(
    principal: Principal,
    id: string,
    scope: 'page' | 'subtree',
    on: boolean,
  ): Promise<Page> {
    const { page } = await this.authorize(principal, id, 'view');
    await setWatch(
      this.database.db,
      principal.userId,
      { kind: scope, spaceId: page.spaceId, pageId: page.id },
      on,
    );
    return this.get(principal, id);
  }

  async rename(principal: Principal, id: string, title: string): Promise<Page> {
    const { page, space } = await this.authorize(principal, id, 'edit');
    await this.database.db.transaction(async (tx) => {
      await tx.update(pages).set({ title, updatedAt: new Date() }).where(eq(pages.id, page.id));
      await signal(tx, { type: 'page', pageId: page.id, spaceKey: space.key });
    });
    return this.get(principal, id);
  }

  /**
   * Stores the editor's document as the next immutable version (W-PAG-04, E-59). The
   * document must fit the shared schema; the plain text is derived here.
   */
  async publish(principal: Principal, id: string, request: PublishPageRequest): Promise<Page> {
    const { page, space } = await this.authorize(principal, id, 'edit');
    // Template instructions never reach the published page (TL-27, E-108).
    const content = withoutPlaceholders(request.content);
    if (!isValidDoc(content)) {
      throw new BadRequestException('The content is not a valid document');
    }
    const images = imageAttachmentIds(content);
    if (images.length > 0) {
      const own = await this.database.db
        .select({ id: pageAttachments.id })
        .from(pageAttachments)
        .where(and(eq(pageAttachments.pageId, page.id), inArray(pageAttachments.id, images)));
      if (own.length !== images.length) {
        throw new BadRequestException('Images must be attachments of this page');
      }
    }
    await this.storeVersion(principal, page.id, space.key, {
      title: request.title,
      content: content,
      comment: request.comment,
      restoredFrom: null,
    });
    return this.get(principal, id);
  }

  /**
   * Publishes the content of an older version again (W-PAG-06, E-62). History stays linear;
   * the live draft follows, also in editors that have it open.
   */
  async restoreVersion(
    principal: Principal,
    id: string,
    number: number,
    request: RestoreVersionRequest,
  ): Promise<Page> {
    const { page, space } = await this.authorize(principal, id, 'edit');
    const row = await this.versionRow(page.id, number);
    if (!row) throw new NotFoundException('Version not found');
    if (number === page.version) {
      throw new ConflictException('This version is already the current one');
    }
    await this.storeVersion(principal, page.id, space.key, {
      title: row.version.title,
      content: row.version.content,
      comment: request.comment,
      restoredFrom: number,
    });
    return this.get(principal, id);
  }

  private async storeVersion(
    principal: Principal,
    pageId: string,
    spaceKey: string,
    version: { title: string; content: unknown; comment: string; restoredFrom: number | null },
  ): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ version: pages.version })
        .from(pages)
        .where(eq(pages.id, pageId))
        .for('update');
      const number = (locked?.version ?? 0) + 1;
      const now = new Date();
      await tx.insert(pageVersions).values({
        id: uuidv7(),
        pageId,
        number,
        title: version.title,
        content: version.content,
        text: plainText(version.content),
        authorId: principal.userId,
        comment: version.comment,
        restoredFrom: version.restoredFrom,
        createdAt: now,
      });
      await tx
        .update(pages)
        .set({ title: version.title, version: number, publishedAt: now, updatedAt: now })
        .where(eq(pages.id, pageId));
      await reanchorComments(tx, pageId, version.content);
      await indexIssueRefs(tx, pageId, version.content);
      await autoWatch(tx, principal.userId, pageId);
      await emitPageEvent(tx, pageId, principal.userId, {
        type: 'page.published',
        version: number,
        title: version.title,
        comment: version.comment,
        restoredFrom: version.restoredFrom,
      });
      if (version.restoredFrom !== null) {
        // After commit the collab service replaces the draft with the restored content.
        await tx.execute(sql`select pg_notify(${DRAFT_RESET_CHANNEL}, ${draftName(pageId)})`);
      }
      await signal(tx, { type: 'page', pageId, spaceKey });
    });
  }

  /** Moves a page within its space (W-PAG-01, -02); never below itself. */
  async move(principal: Principal, id: string, request: MovePageRequest): Promise<Page> {
    const { page, space } = await this.authorize(principal, id, 'edit');
    const parentId = await this.checkParent(space.id, request.parentId);
    if (parentId) {
      const ancestors = await this.ancestors(parentId);
      if (parentId === page.id || ancestors.some((entry) => entry.id === page.id)) {
        throw new BadRequestException('A page cannot move below itself');
      }
    }
    await this.database.db.transaction(async (tx) => {
      const siblings = await tx
        .select({ id: pages.id, rank: pages.rank })
        .from(pages)
        .where(
          and(
            eq(pages.spaceId, space.id),
            parentId ? eq(pages.parentId, parentId) : isNull(pages.parentId),
            ne(pages.id, page.id),
          ),
        )
        .orderBy(asc(pages.rank));
      let rank: string;
      if (request.beforeId) {
        const index = siblings.findIndex((entry) => entry.id === request.beforeId);
        if (index === -1) throw new BadRequestException('beforeId must be a sibling');
        rank = rankBetween(siblings[index - 1]?.rank ?? null, siblings[index]?.rank ?? null);
      } else {
        rank = rankBetween(siblings.at(-1)?.rank ?? null, null);
      }
      await tx
        .update(pages)
        .set({ parentId, rank, updatedAt: new Date() })
        .where(eq(pages.id, page.id));
      await signal(tx, { type: 'page', pageId: page.id, spaceKey: space.key });
    });
    return this.get(principal, id);
  }

  /** Ids of a page and all pages below it that are in the same state (live or trashed). */
  private async subtree(db: Executor, pageId: string, deletedAt: Date | null): Promise<string[]> {
    const rows = await db.execute<{ id: string }>(sql`
      with recursive tree(id) as (
        select ${pageId}::uuid
        union all
        select p.id from pages p join tree t on p.parent_id = t.id
        where ${deletedAt ? sql`p.deleted_at = ${deletedAt.toISOString()}::timestamptz` : sql`p.deleted_at is null`}
      )
      select id from tree`);
    return [...rows].map((row) => row.id);
  }

  /** Moves a page with everything below it to the space's trash (W-PAG-13). */
  async delete(principal: Principal, id: string): Promise<void> {
    const { page, space } = await this.authorize(principal, id, 'edit');
    await this.database.db.transaction(async (tx) => {
      const ids = await this.subtree(tx, page.id, null);
      const now = new Date();
      await tx
        .update(pages)
        .set({ deletedAt: now, deletedById: principal.userId })
        .where(inArray(pages.id, ids));
      if (space.homePageId && ids.includes(space.homePageId)) {
        await tx.update(spaces).set({ homePageId: null }).where(eq(spaces.id, space.id));
      }
      await signal(tx, { type: 'page', pageId: page.id, spaceKey: space.key });
    });
  }

  /** Pages that were deleted on their own, not together with a parent. */
  async trash(principal: Principal, spaceKey: string): Promise<TrashedPage[]> {
    const { space } = await this.spaces.find(principal, spaceKey, 'edit');
    const rows = await this.database.db.execute<{
      id: string;
      title: string;
      deleted_at: Date;
      deleted_by_id: string | null;
      deleted_by_name: string | null;
    }>(sql`
      select p.id, p.title, p.deleted_at, p.deleted_by_id, u.display_name as deleted_by_name
      from pages p
      left join pages parent on parent.id = p.parent_id
      left join users u on u.id = p.deleted_by_id
      where p.space_id = ${space.id} and p.deleted_at is not null
        and (parent.id is null or parent.deleted_at is distinct from p.deleted_at)
      order by p.deleted_at desc`);
    return [...rows].map((row) => ({
      id: row.id,
      title: row.title,
      deletedAt: new Date(row.deleted_at).toISOString(),
      deletedBy:
        row.deleted_by_id && row.deleted_by_name
          ? { id: row.deleted_by_id, displayName: row.deleted_by_name }
          : null,
    }));
  }

  /**
   * Brings a page back with the pages deleted together with it. If its parent is still in
   * the trash, it returns at the top level.
   */
  async restore(principal: Principal, id: string): Promise<Page> {
    const { page, space } = await this.authorize(principal, id, 'edit', { deleted: true });
    const deletedAt = page.deletedAt as Date;
    await this.database.db.transaction(async (tx) => {
      const ids = await this.subtree(tx, page.id, deletedAt);
      let parentId = page.parentId;
      if (parentId) {
        const [parent] = await tx
          .select({ deletedAt: pages.deletedAt })
          .from(pages)
          .where(eq(pages.id, parentId));
        if (!parent || parent.deletedAt) parentId = null;
      }
      await tx
        .update(pages)
        .set({ deletedAt: null, deletedById: null })
        .where(inArray(pages.id, ids));
      if (parentId !== page.parentId) {
        await tx
          .update(pages)
          .set({ parentId, rank: await this.lastRank(tx, space.id, parentId) })
          .where(eq(pages.id, page.id));
      }
      await signal(tx, { type: 'page', pageId: page.id, spaceKey: space.key });
    });
    return this.get(principal, id);
  }
}
