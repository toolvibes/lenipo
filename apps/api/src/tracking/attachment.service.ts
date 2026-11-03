import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Attachment, ProjectPermission, UserRef } from '@toolvibes/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Request } from 'express';
import { v7 as uuidv7 } from 'uuid';
import type { AppConfig } from '../core/config.js';
import type { Principal } from '../core/http/principal.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, DATABASE, FILE_STORE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { issueAttachments, issues, users } from '../db/schema/index.js';
import { FileNotFoundError, type FileStore } from '../storage/file-store.js';
import { contentTypeOf, receiveUpload, type SpooledUpload } from '../storage/upload.js';
import { recordChanges } from './history.js';
import { IssueService } from './issue.service.js';

type AttachmentRow = typeof issueAttachments.$inferSelect;

/** Issue attachments (T-ISS-06) in the configured file store (E-43). */
@Injectable()
export class AttachmentService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(FILE_STORE) private readonly store: FileStore,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(IssueService) private readonly issues: IssueService,
  ) {}

  get maxBytes(): number {
    return Math.floor(this.config.ATTACHMENT_MAX_MB * 1024 * 1024);
  }

  private present(
    row: AttachmentRow,
    author: UserRef | null,
    principal: Principal,
    permissions: Set<ProjectPermission>,
  ): Attachment {
    const own = row.authorId === principal.userId && permissions.has('comment');
    return {
      id: row.id,
      fileName: row.fileName,
      contentType: row.contentType,
      size: row.size,
      image: row.image,
      author,
      createdAt: row.createdAt.toISOString(),
      url: `/api/v1/attachments/${row.id}/content`,
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

  async list(principal: Principal, key: string): Promise<Attachment[]> {
    const { issue, permissions } = await this.issues.authorize(principal, key, 'browse');
    const rows = await this.database.db
      .select()
      .from(issueAttachments)
      .where(eq(issueAttachments.issueId, issue.id))
      .orderBy(asc(issueAttachments.createdAt), asc(issueAttachments.id));
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

  /** Anyone who may comment may attach (E-43); the file is stored before the row is written. */
  async upload(principal: Principal, key: string, request: Request): Promise<Attachment> {
    const { issue, permissions } = await this.issues.authorize(principal, key, 'comment');
    const upload = await receiveUpload(request, this.maxBytes);
    return this.keep(principal, issue, permissions, upload);
  }

  /** A file that did not come as an upload, e.g. from a mail (TL-53); same checks and limit. */
  async attachBuffer(
    principal: Principal,
    key: string,
    file: { fileName: string; contentType: string; data: Buffer },
  ): Promise<Attachment> {
    const { issue, permissions } = await this.issues.authorize(principal, key, 'comment');
    if (file.data.length > this.maxBytes) {
      throw new PayloadTooLargeException('The file is larger than the server accepts');
    }
    const directory = await mkdtemp(join(tmpdir(), 'lenipo-mail-'));
    const path = join(directory, 'file');
    await writeFile(path, file.data);
    return this.keep(principal, issue, permissions, {
      path,
      fileName: file.fileName.slice(0, 255) || 'anhang',
      declaredType: file.contentType,
      head: file.data.subarray(0, 64),
      size: file.data.length,
      sha256: createHash('sha256').update(file.data).digest('hex'),
    }).finally(() => rm(directory, { recursive: true, force: true }));
  }

  private async keep(
    principal: Principal,
    issue: Awaited<ReturnType<IssueService['authorize']>>['issue'],
    permissions: Awaited<ReturnType<IssueService['authorize']>>['permissions'],
    upload: SpooledUpload,
  ): Promise<Attachment> {
    const id = uuidv7();
    const storageKey = `attachments/${id}`;
    const { type, image } = contentTypeOf(upload.head, upload.declaredType);
    try {
      await this.store.put(storageKey, upload.path, type);
      try {
        await this.database.db.transaction(async (tx) => {
          await tx.insert(issueAttachments).values({
            id,
            issueId: issue.id,
            authorId: principal.userId,
            fileName: upload.fileName,
            contentType: type,
            size: upload.size,
            sha256: upload.sha256,
            image,
            storageKey,
          });
          await tx.update(issues).set({ updatedAt: sql`now()` }).where(eq(issues.id, issue.id));
          await recordChanges(tx, issue.id, principal, [
            {
              field: 'attachment',
              fromValue: null,
              toValue: id,
              fromDisplay: null,
              toDisplay: upload.fileName,
            },
          ]);
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
      .from(issueAttachments)
      .where(eq(issueAttachments.id, id));
    if (!row) throw new NotFoundException('Attachment not found');
    const author = (await this.authors([principal.userId])).get(principal.userId) ?? null;
    return this.present(row, author, principal, permissions);
  }

  /** The stored file, after checking that the caller may see its issue. */
  async content(
    principal: Principal,
    id: string,
  ): Promise<{ row: AttachmentRow; stream: Readable }> {
    const [found] = await this.database.db
      .select({ attachment: issueAttachments, key: issues.key })
      .from(issueAttachments)
      .innerJoin(issues, eq(issues.id, issueAttachments.issueId))
      .where(eq(issueAttachments.id, id));
    if (!found) throw new NotFoundException('Attachment not found');
    try {
      await this.issues.authorize(principal, found.key, 'browse');
    } catch (error) {
      if (error instanceof NotFoundException) throw new NotFoundException('Attachment not found');
      throw error;
    }
    try {
      return { row: found.attachment, stream: await this.store.get(found.attachment.storageKey) };
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        this.logger.error({ attachment: id }, 'Attachment content is missing from the file store');
        throw new NotFoundException('The file of this attachment is missing');
      }
      throw error;
    }
  }

  /** Own attachments, or any as project administrator; row and stored file go right away. */
  async delete(principal: Principal, key: string, id: string): Promise<void> {
    const { issue, permissions } = await this.issues.authorize(principal, key, 'comment');
    const [row] = await this.database.db
      .select()
      .from(issueAttachments)
      .where(and(eq(issueAttachments.id, id), eq(issueAttachments.issueId, issue.id)));
    if (!row) throw new NotFoundException('Attachment not found');
    if (row.authorId !== principal.userId && !permissions.has('administer')) {
      throw new ForbiddenException(
        'Only the uploader or a project administrator can delete this attachment',
      );
    }
    await this.database.db.transaction(async (tx) => {
      await tx.delete(issueAttachments).where(eq(issueAttachments.id, id));
      await tx.update(issues).set({ updatedAt: sql`now()` }).where(eq(issues.id, issue.id));
      await recordChanges(tx, issue.id, principal, [
        {
          field: 'attachment',
          fromValue: id,
          toValue: null,
          fromDisplay: row.fileName,
          toDisplay: null,
        },
      ]);
    });
    try {
      await this.store.delete(row.storageKey);
    } catch (error) {
      // The row is gone; a leftover object is harmless and can be cleaned up later.
      this.logger.warn({ err: error, attachment: id }, 'Could not delete attachment content');
    }
  }
}
