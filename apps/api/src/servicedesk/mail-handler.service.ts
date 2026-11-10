import { createHash } from 'node:crypto';
import { HttpException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AUTOMATION_ACTOR_ID,
  type MailHandler,
  type MailReceipt,
  type SaveMailHandlerRequest,
} from '@toolvibes/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import { ImapFlow } from 'imapflow';
import { type ParsedMail, simpleParser } from 'mailparser';
import type { AppConfig } from '../core/config.js';
import type { Principal } from '../core/http/principal.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, DATABASE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  issues,
  issueTypes,
  mailHandlers,
  mailReceipts,
  projects,
  users,
} from '../db/schema/index.js';
import { AttachmentService } from '../tracking/attachment.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { ProjectService } from '../tracking/project.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { senderVerified } from './sender-check.js';
import { ContactRefused, ServiceDeskService } from './servicedesk.service.js';

type HandlerRow = typeof mailHandlers.$inferSelect;

const BATCH = 25;
const TEXT_LIMIT = 50_000;

/** The text of a reply without the quoted mail below it. */
export function replyText(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const kept: string[] = [];
  for (const line of lines) {
    if (
      /^\s*>/.test(line) ||
      /^(On .+ wrote:|Am .+ schrieb .+:|-----Original Message-----|-----Ursprüngliche Nachricht-----)\s*$/i.test(
        line.trim(),
      )
    ) {
      break;
    }
    kept.push(line);
  }
  return kept.join('\n').trim();
}

/** Out-of-office answers and mail loops are never handled. */
function automatic(mail: ParsedMail): boolean {
  const header = (name: string) => String(mail.headers.get(name) ?? '').toLowerCase();
  return (
    (header('auto-submitted') !== '' && header('auto-submitted') !== 'no') ||
    header('x-autoreply') !== '' ||
    ['bulk', 'junk', 'list', 'auto_reply'].includes(header('precedence'))
  );
}

/**
 * Mail handlers (TL-53, E-142): the worker reads each project's IMAP mailbox every minute.
 * A mail naming an issue of the project in its subject becomes a comment, any other a new issue
 * (or, from a customer of a service desk, a request). Senders act with their own rights;
 * unknown senders change nothing, unless the service desk lets them in (E-168).
 */
@Injectable()
export class MailHandlerService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly access: ProjectAccessService,
    @Inject(IssueService) private readonly issueService: IssueService,
    @Inject(AttachmentService) private readonly attachments: AttachmentService,
    @Inject(ServiceDeskService) private readonly desks: ServiceDeskService,
  ) {}

  private async administered(principal: Principal, key: string) {
    const project = await this.projects.findBrowsable(principal, key);
    await this.access.require(principal, project.id, 'administer');
    return project;
  }

  private async present(row: HandlerRow | undefined): Promise<MailHandler | null> {
    if (!row) return null;
    const [type] = await this.database.db
      .select({ key: issueTypes.key })
      .from(issueTypes)
      .where(eq(issueTypes.id, row.issueTypeId));
    return {
      enabled: row.enabled,
      host: row.host,
      port: row.port,
      secure: row.secure,
      username: row.username,
      hasPassword: row.password !== '',
      folder: row.folder,
      doneFolder: row.doneFolder,
      issueType: type?.key ?? '',
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      lastResult: row.lastResult,
    };
  }

  async get(principal: Principal, key: string): Promise<MailHandler | null> {
    const project = await this.administered(principal, key);
    const [row] = await this.database.db
      .select()
      .from(mailHandlers)
      .where(eq(mailHandlers.projectId, project.id));
    return this.present(row);
  }

  async save(principal: Principal, key: string, request: SaveMailHandlerRequest) {
    const project = await this.administered(principal, key);
    const [type] = await this.database.db
      .select({ id: issueTypes.id })
      .from(issueTypes)
      .where(eq(issueTypes.key, request.issueType));
    if (!type) throw new NotFoundException(`The issue type "${request.issueType}" does not exist`);
    const [current] = await this.database.db
      .select({ password: mailHandlers.password })
      .from(mailHandlers)
      .where(eq(mailHandlers.projectId, project.id));
    const values = {
      enabled: request.enabled,
      host: request.host,
      port: request.port,
      secure: request.secure,
      username: request.username,
      password: request.password ?? current?.password ?? '',
      folder: request.folder,
      doneFolder: request.doneFolder,
      issueTypeId: type.id,
    };
    const [row] = await this.database.db
      .insert(mailHandlers)
      .values({ projectId: project.id, ...values })
      .onConflictDoUpdate({ target: mailHandlers.projectId, set: values })
      .returning();
    return this.present(row);
  }

  async remove(principal: Principal, key: string): Promise<void> {
    const project = await this.administered(principal, key);
    await this.database.db.delete(mailHandlers).where(eq(mailHandlers.projectId, project.id));
  }

  async receipts(principal: Principal, key: string): Promise<MailReceipt[]> {
    const project = await this.administered(principal, key);
    const rows = await this.database.db
      .select()
      .from(mailReceipts)
      .where(eq(mailReceipts.projectId, project.id))
      .orderBy(desc(mailReceipts.receivedAt))
      .limit(50);
    return rows.map((row) => ({
      messageId: row.messageId,
      issueKey: row.issueKey,
      outcome: row.outcome,
      receivedAt: row.receivedAt.toISOString(),
    }));
  }

  // ---------------------------------------------------------------- reading mailboxes

  /** Every enabled mailbox once; a failing one does not stop the others. */
  async pollAll(): Promise<void> {
    const rows = await this.database.db
      .select()
      .from(mailHandlers)
      .where(eq(mailHandlers.enabled, true));
    for (const row of rows) {
      let result: string;
      try {
        result = `${await this.poll(row)} Mails gelesen`;
      } catch (error) {
        result = `Fehler: ${(error as Error).message}`;
        this.logger.warn({ err: error, projectId: row.projectId }, 'Mail handler failed');
      }
      await this.database.db
        .update(mailHandlers)
        .set({ lastRunAt: sql`now()`, lastResult: result.slice(0, 500) })
        .where(eq(mailHandlers.projectId, row.projectId));
    }
  }

  private async poll(row: HandlerRow): Promise<number> {
    const client = new ImapFlow({
      host: row.host,
      port: row.port,
      secure: row.secure,
      auth: { user: row.username, pass: row.password },
      logger: false,
    });
    await client.connect();
    let handled = 0;
    try {
      const lock = await client.getMailboxLock(row.folder);
      try {
        const unseen = (await client.search({ seen: false }, { uid: true })) || [];
        for (const uid of unseen.slice(0, BATCH)) {
          const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!message || !message.source) continue;
          await this.handle(row.projectId, message.source);
          handled += 1;
          if (row.doneFolder) {
            await client.messageMove(String(uid), row.doneFolder, { uid: true });
          } else {
            await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => client.close());
    }
    return handled;
  }

  // ---------------------------------------------------------------- one mail

  private async receipt(projectId: string, messageId: string, outcome: string, issueKey?: string) {
    await this.database.db
      .insert(mailReceipts)
      .values({ projectId, messageId, outcome, issueKey: issueKey ?? null })
      .onConflictDoNothing();
    return { outcome, issueKey: issueKey ?? null };
  }

  /** Handles one raw mail for a project; what came of it is kept as a receipt. */
  async handle(
    projectId: string,
    source: Buffer,
  ): Promise<{ outcome: string; issueKey: string | null }> {
    const mail = await simpleParser(source);
    const messageId =
      mail.messageId ?? `<${createHash('sha256').update(source).digest('hex')}@lenipo>`;
    const [seen] = await this.database.db
      .select({ outcome: mailReceipts.outcome, issueKey: mailReceipts.issueKey })
      .from(mailReceipts)
      .where(and(eq(mailReceipts.projectId, projectId), eq(mailReceipts.messageId, messageId)));
    if (seen) return seen;

    const ownAddress = /<([^>]+)>/.exec(this.config.MAIL_FROM)?.[1] ?? this.config.MAIL_FROM;
    const from = mail.from?.value[0]?.address?.toLowerCase();
    if (!from || from === ownAddress.toLowerCase() || automatic(mail)) {
      return this.receipt(projectId, messageId, 'ignored');
    }
    const [sender] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, from), eq(users.status, 'active')));
    if (sender?.id === AUTOMATION_ACTOR_ID) {
      return this.receipt(projectId, messageId, 'unknown-sender');
    }
    let senderId = sender?.id;
    if (!senderId) {
      // Unknown senders only where the service desk lets them in, and only if confirmed (E-168).
      const results = mail.headerLines
        .filter((line) => line.key === 'authentication-results')
        .map((line) => line.line.replace(/^[^:]*:\s*/, ''));
      try {
        const desk = await this.desks.acceptsUnknownSenders(projectId);
        if (!desk) throw new ContactRefused('unknown-sender', 403);
        if (!senderVerified(results, from)) throw new ContactRefused('unverified-sender', 403);
        senderId = await this.desks.contactForMail(projectId, from, mail.from?.value[0]?.name);
      } catch (error) {
        if (error instanceof HttpException && error.getStatus() < 500) {
          this.logger.info(
            { projectId, from, reason: error.message },
            'Mail from an unknown sender ignored',
          );
          return this.receipt(projectId, messageId, error.message.slice(0, 200));
        }
        throw error;
      }
    }
    const principal: Principal = { userId: senderId, via: 'mail', projectId };
    const [project] = await this.database.db
      .select({ key: projects.key })
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!project) return this.receipt(projectId, messageId, 'no-project');

    const subject = (mail.subject ?? '').trim();
    const named = new RegExp(`\\b(${project.key}-[1-9][0-9]*)\\b`, 'i').exec(subject)?.[1];
    try {
      if (named) {
        const key = named.toUpperCase();
        const [issue] = await this.database.db
          .select({ key: issues.key })
          .from(issues)
          .where(eq(issues.key, key));
        if (issue) {
          const text = replyText(mail.text ?? '') || '(leer)';
          await this.comment(principal, key, text);
          await this.attach(principal, key, mail);
          return this.receipt(projectId, messageId, 'comment', key);
        }
      }
      const key = await this.create(principal, project.key, projectId, subject, mail);
      await this.attach(principal, key, mail);
      return this.receipt(projectId, messageId, 'issue', key);
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() < 500) {
        return this.receipt(projectId, messageId, `refused: ${error.message}`.slice(0, 200));
      }
      throw error;
    }
  }

  /** A comment as the sender; a service desk customer answers through the portal path. */
  private async comment(principal: Principal, key: string, text: string) {
    try {
      await this.issueService.addComment(principal, key, { body: { markdown: text } });
    } catch (error) {
      if (!(error instanceof HttpException) || ![403, 404].includes(error.getStatus())) throw error;
      await this.desks.comment(principal, key, { markdown: text });
    }
  }

  private async create(
    principal: Principal,
    projectKey: string,
    projectId: string,
    subject: string,
    mail: ParsedMail,
  ): Promise<string> {
    const summary = subject.slice(0, 255) || '(ohne Betreff)';
    const text = (mail.text ?? '').trim().slice(0, TEXT_LIMIT);
    const description = text ? { markdown: text } : undefined;
    const [handler] = await this.database.db
      .select({ issueTypeId: mailHandlers.issueTypeId, typeKey: issueTypes.key })
      .from(mailHandlers)
      .innerJoin(issueTypes, eq(issueTypes.id, mailHandlers.issueTypeId))
      .where(eq(mailHandlers.projectId, projectId));
    try {
      const issue = await this.issueService.create(principal, {
        projectKey,
        issueType: handler?.typeKey ?? 'task',
        summary,
        description: description ?? null,
        assigneeId: null,
        parentKey: null,
        labels: [],
        storyPoints: null,
        startDate: null,
        dueDate: null,
        components: [],
        fixVersions: [],
        affectsVersions: [],
        customFields: {},
      });
      return issue.key;
    } catch (error) {
      if (!(error instanceof HttpException) || ![403, 404].includes(error.getStatus())) throw error;
      // Not allowed to create issues: maybe a customer of the project's service desk.
      const desk = await this.desks.portalDesk(principal, projectKey);
      const requestType = desk.requestTypes[0];
      if (!requestType) throw error;
      const request = await this.desks.createRequest(principal, projectKey, {
        requestTypeId: requestType.id,
        summary,
        description,
      });
      return request.key;
    }
  }

  private async attach(principal: Principal, key: string, mail: ParsedMail) {
    for (const attachment of mail.attachments) {
      if (attachment.related) continue;
      try {
        await this.attachments.attachBuffer(principal, key, {
          fileName: attachment.filename ?? 'anhang',
          contentType: attachment.contentType,
          data: attachment.content,
        });
      } catch (error) {
        this.logger.warn({ err: error, key }, 'Mail attachment not stored');
      }
    }
  }
}
