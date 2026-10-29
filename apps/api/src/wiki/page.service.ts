import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { imageAttachmentIds, isValidDoc } from '@tasklore/editor';
import type {
  ContentFormat,
  CreatePageRequest,
  MovePageRequest,
  Page,
  PageRef,
  PageTreeEntry,
  PageVersion,
  PageVersionSummary,
  PublishPageRequest,
  RichText,
  SpacePermission,
  TrashedPage,
} from '@tasklore/shared';
import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import {
  favourites,
  pageAttachments,
  pages,
  pageVersions,
  spaces,
  users,
} from '../db/schema/index.js';
import { signal } from '../realtime/signals.js';
import { markdownOf } from '../tracking/content-format.js';
import { rankBetween } from '../tracking/rank.js';
import { plainText } from '../tracking/rich-text.js';
import { type SpaceRow, SpaceService } from './space.service.js';
import { SpaceAccessService } from './space-access.service.js';

type PageRow = typeof pages.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pages of a wiki space: tree, drafts, published versions and trash (W-PAG, E-59). */
@Injectable()
export class PageService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(SpaceService) private readonly spaces: SpaceService,
    @Inject(SpaceAccessService) private readonly spaceAccess: SpaceAccessService,
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
    if (permission !== 'view')
      await this.spaceAccess.require(principal, found.space.id, permission);
    return { page: row.page, ...found };
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
      .where(and(eq(pages.spaceId, space.id), isNull(pages.deletedAt)))
      .orderBy(asc(pages.rank), asc(pages.createdAt));
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
  async create(principal: Principal, spaceKey: string, request: CreatePageRequest): Promise<Page> {
    const { space } = await this.spaces.find(principal, spaceKey, 'edit');
    const parentId = await this.checkParent(space.id, request.parentId);
    const id = uuidv7();
    await this.database.db.transaction(async (tx) => {
      await tx.insert(pages).values({
        id,
        spaceId: space.id,
        parentId,
        rank: await this.lastRank(tx, space.id, parentId),
        title: request.title,
        createdById: principal.userId,
      });
      if (!space.homePageId) {
        await tx.update(spaces).set({ homePageId: id }).where(eq(spaces.id, space.id));
      }
      await signal(tx, { type: 'space', spaceKey: space.key });
    });
    return this.get(principal, id);
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
    };
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
      number: row.version.number,
      title: row.version.title,
      author:
        row.version.authorId && row.authorName
          ? { id: row.version.authorId, displayName: row.authorName }
          : null,
      comment: row.version.comment,
      createdAt: row.version.createdAt.toISOString(),
      content: format === 'markdown' ? markdownOf(content) : content,
    };
  }

  // ---------------------------------------------------------------- changing

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
    if (!isValidDoc(request.content)) {
      throw new BadRequestException('The content is not a valid document');
    }
    const images = imageAttachmentIds(request.content);
    if (images.length > 0) {
      const own = await this.database.db
        .select({ id: pageAttachments.id })
        .from(pageAttachments)
        .where(and(eq(pageAttachments.pageId, page.id), inArray(pageAttachments.id, images)));
      if (own.length !== images.length) {
        throw new BadRequestException('Images must be attachments of this page');
      }
    }
    await this.database.db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ version: pages.version })
        .from(pages)
        .where(eq(pages.id, page.id))
        .for('update');
      const number = (locked?.version ?? 0) + 1;
      const now = new Date();
      await tx.insert(pageVersions).values({
        id: uuidv7(),
        pageId: page.id,
        number,
        title: request.title,
        content: request.content,
        text: plainText(request.content),
        authorId: principal.userId,
        comment: request.comment,
        createdAt: now,
      });
      await tx
        .update(pages)
        .set({ title: request.title, version: number, publishedAt: now, updatedAt: now })
        .where(eq(pages.id, page.id));
      await signal(tx, { type: 'page', pageId: page.id, spaceKey: space.key });
    });
    return this.get(principal, id);
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
