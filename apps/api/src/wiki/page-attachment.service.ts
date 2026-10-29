import { rm } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Attachment, SpacePermission, UserRef } from '@tasklore/shared';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Request } from 'express';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import type { AppConfig } from '../core/config.js';
import type { Principal } from '../core/http/principal.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, DATABASE, FILE_STORE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { pageAttachments, users } from '../db/schema/index.js';
import { FileNotFoundError, type FileStore } from '../storage/file-store.js';
import { contentTypeOf, receiveUpload } from '../storage/upload.js';
import { PageService } from './page.service.js';

type PageAttachmentRow = typeof pageAttachments.$inferSelect;

/**
 * Files of wiki pages, also the images in their text (W-EDT-08, -09, E-61). Whoever may view
 * the page may load them; editors upload; the uploader or the space administration deletes.
 */
@Injectable()
export class PageAttachmentService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(FILE_STORE) private readonly store: FileStore,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PageService) private readonly pages: PageService,
  ) {}

  private present(
    row: PageAttachmentRow,
    author: UserRef | null,
    principal: Principal,
    permissions: Set<SpacePermission>,
  ): Attachment {
    const own = row.authorId === principal.userId && permissions.has('edit');
    return {
      id: row.id,
      fileName: row.fileName,
      contentType: row.contentType,
      size: row.size,
      image: row.image,
      author,
      createdAt: row.createdAt.toISOString(),
      url: `/api/v1/page-attachments/${row.id}/content`,
      canDelete: own || permissions.has('administer'),
    };
  }

  private async authors(ids: Array<string | null>): Promise<Map<string, UserRef>> {
    const unique = [...new Set(ids.filter((id): id is string => id !== null))];
    if (unique.length === 0) return new Map();
    const rows = await this.database.db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, unique));
    return new Map(rows.map((row) => [row.id, row]));
  }

  async list(principal: Principal, pageId: string): Promise<Attachment[]> {
    const { page, permissions } = await this.pages.authorize(principal, pageId, 'view');
    const rows = await this.database.db
      .select()
      .from(pageAttachments)
      .where(eq(pageAttachments.pageId, page.id))
      .orderBy(asc(pageAttachments.createdAt), asc(pageAttachments.id));
    const people = await this.authors(rows.map((row) => row.authorId));
    return rows.map((row) =>
      this.present(
        row,
        row.authorId ? (people.get(row.authorId) ?? null) : null,
        principal,
        permissions,
      ),
    );
  }

  /** Editors attach files; the file is stored before the row is written. */
  async upload(principal: Principal, pageId: string, request: Request): Promise<Attachment> {
    const { page, permissions } = await this.pages.authorize(principal, pageId, 'edit');
    const upload = await receiveUpload(
      request,
      Math.floor(this.config.ATTACHMENT_MAX_MB * 1024 * 1024),
    );
    const id = uuidv7();
    const storageKey = `page-attachments/${id}`;
    const { type, image } = contentTypeOf(upload.head, upload.declaredType);
    try {
      await this.store.put(storageKey, upload.path, type);
      try {
        await this.database.db.insert(pageAttachments).values({
          id,
          pageId: page.id,
          authorId: principal.userId,
          fileName: upload.fileName,
          contentType: type,
          size: upload.size,
          sha256: upload.sha256,
          image,
          storageKey,
        });
      } catch (error) {
        await this.store.delete(storageKey);
        throw error;
      }
    } finally {
      await rm(upload.path, { force: true });
    }
    const [row] = await this.database.db
      .select()
      .from(pageAttachments)
      .where(eq(pageAttachments.id, id));
    if (!row) throw new NotFoundException('Attachment not found');
    const author = (await this.authors([principal.userId])).get(principal.userId) ?? null;
    return this.present(row, author, principal, permissions);
  }

  /** The stored file, after checking that the caller may view its page. */
  async content(
    principal: Principal,
    id: string,
  ): Promise<{ row: PageAttachmentRow; stream: Readable }> {
    const [row] = await this.database.db
      .select()
      .from(pageAttachments)
      .where(eq(pageAttachments.id, id));
    if (!row) throw new NotFoundException('Attachment not found');
    try {
      await this.pages.authorize(principal, row.pageId, 'view');
    } catch (error) {
      if (error instanceof NotFoundException) throw new NotFoundException('Attachment not found');
      throw error;
    }
    try {
      return { row, stream: await this.store.get(row.storageKey) };
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        this.logger.error({ attachment: id }, 'Page attachment content is missing');
        throw new NotFoundException('The file of this attachment is missing');
      }
      throw error;
    }
  }

  /** Own attachments, or any as space administrator; versions showing it get a placeholder. */
  async delete(principal: Principal, pageId: string, id: string): Promise<void> {
    const { page, permissions } = await this.pages.authorize(principal, pageId, 'edit');
    const [row] = await this.database.db
      .select()
      .from(pageAttachments)
      .where(and(eq(pageAttachments.id, id), eq(pageAttachments.pageId, page.id)));
    if (!row) throw new NotFoundException('Attachment not found');
    if (row.authorId !== principal.userId && !permissions.has('administer')) {
      throw new ForbiddenException(
        'Only the uploader or a space administrator can delete this attachment',
      );
    }
    await this.database.db.delete(pageAttachments).where(eq(pageAttachments.id, id));
    await this.audit.record({
      action: 'page.attachment-deleted',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'page',
      targetId: page.id,
      details: { attachmentId: id, fileName: row.fileName, sha256: row.sha256 },
    });
    try {
      await this.store.delete(row.storageKey);
    } catch (error) {
      // The row is gone; a leftover object is harmless and can be cleaned up later.
      this.logger.warn({ err: error, attachment: id }, 'Could not delete page attachment');
    }
  }
}
