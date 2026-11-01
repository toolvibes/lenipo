import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { locateAnchor, markdownToDoc, reanchor, reviewMentions } from '@toolvibes/editor';
import type {
  CreatePageCommentRequest,
  PageComment,
  RichText,
  RichTextInput,
  SpacePermission,
  TextAnchor,
  UpdatePageCommentRequest,
  UserRef,
} from '@toolvibes/shared';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { pageComments, pageVersions, users } from '../db/schema/index.js';
import { emitPageEvent } from '../notifications/events.js';
import { signal } from '../realtime/signals.js';
import { mentionedUserIds, plainText } from '../tracking/rich-text.js';
import { PageService } from './page.service.js';
import { SpaceAccessService } from './space-access.service.js';
import { autoWatch } from './watches.js';

type CommentRow = typeof pageComments.$inferSelect;

/** Page comments and inline comment threads (W-EDT-11, -12, E-63). */
@Injectable()
export class PageCommentService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(PageService) private readonly pages: PageService,
    @Inject(SpaceAccessService) private readonly spaceAccess: SpaceAccessService,
  ) {}

  private async people(ids: Array<string | null>): Promise<Map<string, UserRef>> {
    const unique = [...new Set(ids.filter((id): id is string => id !== null))];
    if (unique.length === 0) return new Map();
    const rows = await this.database.db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, unique));
    return new Map(rows.map((row) => [row.id, row]));
  }

  private present(
    row: CommentRow,
    people: Map<string, UserRef>,
    principal: Principal,
    permissions: Set<SpacePermission>,
  ): PageComment {
    const deleted = row.deletedAt !== null;
    const own = row.authorId === principal.userId && permissions.has('comment');
    return {
      id: row.id,
      parentId: row.parentId,
      author: row.authorId ? (people.get(row.authorId) ?? null) : null,
      body: deleted ? null : (row.body as RichText),
      anchor: (row.anchor as TextAnchor | null) ?? null,
      detached: row.detached,
      resolved: row.resolvedAt
        ? {
            at: row.resolvedAt.toISOString(),
            by: row.resolvedById ? (people.get(row.resolvedById) ?? null) : null,
          }
        : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      edited: row.updatedAt.getTime() - row.createdAt.getTime() > 1000,
      deleted,
      canEdit: !deleted && own,
      canDelete: !deleted && (own || permissions.has('administer')),
    };
  }

  /** Markdown becomes a document; mentions only of people who may view the space. */
  private async document(input: RichTextInput, spaceId: string): Promise<RichText> {
    if ('type' in input) return input;
    const doc = await reviewMentions(markdownToDoc(input.markdown), async ({ id, label }) => {
      const [person] = await this.database.db
        .select({ id: users.id, displayName: users.displayName, status: users.status })
        .from(users)
        .where(id ? eq(users.id, id) : eq(sql`lower(${users.email})`, label.toLowerCase()));
      if (person?.status !== 'active') return null;
      const visible = (await this.spaceAccess.permissions(person.id, spaceId)).has('view');
      return visible ? { id: person.id, label: id ? label : person.displayName } : null;
    });
    return doc as RichText;
  }

  /** All threads of the page, oldest first; deleted comments stay as long as answers follow. */
  async list(principal: Principal, pageId: string): Promise<PageComment[]> {
    const { page, permissions } = await this.pages.authorize(principal, pageId, 'view');
    const rows = await this.database.db
      .select()
      .from(pageComments)
      .where(eq(pageComments.pageId, page.id))
      .orderBy(asc(pageComments.createdAt), asc(pageComments.id));
    const answered = new Set(
      rows.filter((row) => row.parentId && !row.deletedAt).map((row) => row.parentId),
    );
    const shown = rows.filter(
      (row) => !row.deletedAt || (row.parentId === null && answered.has(row.id)),
    );
    const people = await this.people(shown.flatMap((row) => [row.authorId, row.resolvedById]));
    return shown.map((row) => this.present(row, people, principal, permissions));
  }

  private async load(pageId: string, commentId: string): Promise<CommentRow> {
    const [row] = await this.database.db
      .select()
      .from(pageComments)
      .where(
        and(
          eq(pageComments.id, commentId),
          eq(pageComments.pageId, pageId),
          isNull(pageComments.deletedAt),
        ),
      );
    if (!row) throw new NotFoundException('Comment not found');
    return row;
  }

  private async threadQuote(threadId: string): Promise<TextAnchor | null> {
    const [root] = await this.database.db
      .select({ anchor: pageComments.anchor })
      .from(pageComments)
      .where(eq(pageComments.id, threadId));
    return (root?.anchor as TextAnchor | null | undefined) ?? null;
  }

  async create(
    principal: Principal,
    pageId: string,
    request: CreatePageCommentRequest,
  ): Promise<PageComment> {
    const { page, space, permissions } = await this.pages.authorize(principal, pageId, 'comment');
    if (request.parentId) {
      const parent = await this.load(page.id, request.parentId).catch(() => null);
      if (!parent || parent.parentId) {
        throw new BadRequestException('Answers go to a comment that starts a thread');
      }
    }
    let anchor: TextAnchor | null = null;
    if (request.anchor) {
      // Inline comments quote the published text; it has to be there.
      const [published] = await this.database.db
        .select({ content: pageVersions.content })
        .from(pageVersions)
        .where(and(eq(pageVersions.pageId, page.id), eq(pageVersions.number, page.version)));
      anchor =
        published && locateAnchor(published.content, request.anchor)
          ? reanchor(published.content, request.anchor)
          : null;
      if (!anchor) throw new BadRequestException('The quoted text is not in the published page');
    }
    const body = await this.document(request.body, space.id);
    const text = plainText(body);
    if (!text) throw new BadRequestException('The comment is empty');
    const id = uuidv7();
    await this.database.db.transaction(async (tx) => {
      await tx.insert(pageComments).values({
        id,
        pageId: page.id,
        parentId: request.parentId ?? null,
        authorId: principal.userId,
        body,
        bodyText: text,
        anchor,
      });
      await autoWatch(tx, principal.userId, page.id);
      await emitPageEvent(tx, page.id, principal.userId, {
        type: 'page.commented',
        commentId: id,
        threadId: request.parentId ?? id,
        excerpt: text.slice(0, 500),
        quote:
          (anchor ?? (request.parentId ? await this.threadQuote(request.parentId) : null))?.exact ??
          null,
        mentions: mentionedUserIds(body),
        edited: false,
      });
      await signal(tx, { type: 'page', pageId: page.id, spaceKey: space.key });
    });
    const [row] = await this.database.db.select().from(pageComments).where(eq(pageComments.id, id));
    if (!row) throw new NotFoundException('Comment not found');
    return this.present(row, await this.people([principal.userId]), principal, permissions);
  }

  async update(
    principal: Principal,
    pageId: string,
    commentId: string,
    request: UpdatePageCommentRequest,
  ): Promise<PageComment> {
    const { page, space, permissions } = await this.pages.authorize(principal, pageId, 'comment');
    const row = await this.load(page.id, commentId);
    if (row.authorId !== principal.userId) {
      throw new ForbiddenException('Only the author can edit this comment');
    }
    const body = await this.document(request.body, space.id);
    const text = plainText(body);
    if (!text) throw new BadRequestException('The comment is empty');
    const [updated] = await this.database.db.transaction(async (tx) => {
      const result = await tx
        .update(pageComments)
        .set({ body, bodyText: text, updatedAt: sql`now()` })
        .where(eq(pageComments.id, row.id))
        .returning();
      // Only people mentioned for the first time hear about an edit.
      const added = mentionedUserIds(body).filter((id) => !mentionedUserIds(row.body).includes(id));
      if (added.length > 0) {
        await emitPageEvent(tx, page.id, principal.userId, {
          type: 'page.commented',
          commentId: row.id,
          threadId: row.parentId ?? row.id,
          excerpt: text.slice(0, 500),
          quote: (row.anchor as TextAnchor | null)?.exact ?? null,
          mentions: added,
          edited: true,
        });
      }
      await signal(tx, { type: 'page', pageId: page.id, spaceKey: space.key });
      return result;
    });
    if (!updated) throw new NotFoundException('Comment not found');
    const people = await this.people([updated.authorId, updated.resolvedById]);
    return this.present(updated, people, principal, permissions);
  }

  /** Own comments, or any as space administrator. */
  async delete(principal: Principal, pageId: string, commentId: string): Promise<void> {
    const { page, space, permissions } = await this.pages.authorize(principal, pageId, 'comment');
    const row = await this.load(page.id, commentId);
    if (row.authorId !== principal.userId && !permissions.has('administer')) {
      throw new ForbiddenException(
        'Only the author or a space administrator can delete this comment',
      );
    }
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(pageComments)
        .set({ deletedAt: sql`now()` })
        .where(eq(pageComments.id, row.id));
      await signal(tx, { type: 'page', pageId: page.id, spaceKey: space.key });
    });
  }

  /** Resolves or reopens an inline thread; everyone who may comment may do so. */
  async resolve(
    principal: Principal,
    pageId: string,
    commentId: string,
    resolved: boolean,
  ): Promise<PageComment> {
    const { page, space, permissions } = await this.pages.authorize(principal, pageId, 'comment');
    const row = await this.load(page.id, commentId);
    if (row.parentId || !row.anchor) {
      throw new BadRequestException('Only inline threads can be resolved');
    }
    const [updated] = await this.database.db.transaction(async (tx) => {
      const result = await tx
        .update(pageComments)
        .set(
          resolved
            ? { resolvedAt: sql`now()`, resolvedById: principal.userId }
            : { resolvedAt: null, resolvedById: null },
        )
        .where(eq(pageComments.id, row.id))
        .returning();
      await signal(tx, { type: 'page', pageId: page.id, spaceKey: space.key });
      return result;
    });
    if (!updated) throw new NotFoundException('Comment not found');
    const people = await this.people([updated.authorId, updated.resolvedById]);
    return this.present(updated, people, principal, permissions);
  }
}
