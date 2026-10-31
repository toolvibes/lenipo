import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreatedGitConnection,
  CreateGitConnectionRequest,
  DevelopmentSummary,
  GitConnection,
  GitEvent,
  GitProvider,
  IssueDevelopment,
} from '@tasklore/shared';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import type { Logger } from '../core/logger.js';
import { DATABASE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import {
  developmentLinks,
  domainEvents,
  gitConnections,
  issues,
  users,
} from '../db/schema/index.js';
import { randomSecret } from '../identity/secrets.js';
import { IssueService } from '../tracking/issue.service.js';
import { WorklogService } from '../tracking/worklog.service.js';
import { type GitChange, issueKeysIn, smartCommands } from './providers.js';

type Connection = typeof gitConnections.$inferSelect;
type Link = typeof developmentLinks.$inferSelect;

/** A transition name as a smart commit word: "In Review" → "in-review". */
const slugOf = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Git hosting through inbound webhooks: development links, smart commits, events (E-116). */
@Injectable()
export class GitService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(WorklogService) private readonly worklogs: WorklogService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- connections

  private present(row: Connection, base: string): GitConnection {
    return {
      id: row.id,
      name: row.name,
      provider: row.provider as GitProvider,
      webhookUrl: `${base}/api/v1/git/webhooks/${row.id}`,
      createdAt: row.createdAt.toISOString(),
      lastEventAt: row.lastEventAt?.toISOString() ?? null,
      lastError: row.lastError,
    };
  }

  async list(base: string): Promise<GitConnection[]> {
    const rows = await this.database.db.select().from(gitConnections).orderBy(gitConnections.name);
    return rows.map((row) => this.present(row, base));
  }

  async create(
    principal: Principal,
    request: CreateGitConnectionRequest,
    base: string,
  ): Promise<CreatedGitConnection> {
    const [row] = await this.database.db
      .insert(gitConnections)
      .values({
        id: uuidv7(),
        name: request.name,
        provider: request.provider,
        secret: randomSecret(24),
        createdById: principal.userId,
      })
      .returning();
    const created = row as Connection;
    await this.audit.record({
      action: 'git.connection_created',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'git_connection',
      targetId: created.id,
      details: { name: request.name, provider: request.provider },
    });
    return { ...this.present(created, base), secret: created.secret };
  }

  async delete(principal: Principal, id: string): Promise<void> {
    const [row] = await this.database.db
      .delete(gitConnections)
      .where(eq(gitConnections.id, id))
      .returning({ id: gitConnections.id });
    if (!row) throw new NotFoundException('Connection not found');
    await this.audit.record({
      action: 'git.connection_deleted',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'git_connection',
      targetId: id,
    });
  }

  async connection(id: string): Promise<Connection | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [row] = await this.database.db
      .select()
      .from(gitConnections)
      .where(eq(gitConnections.id, id));
    return row ?? null;
  }

  async noteDelivery(id: string, error: string | null): Promise<void> {
    await this.database.db
      .update(gitConnections)
      .set(error ? { lastError: error } : { lastEventAt: sql`now()`, lastError: null })
      .where(eq(gitConnections.id, id));
  }

  // ---------------------------------------------------------------- receiving

  /** Issues by key that exist; unknown keys (other systems, typos) are skipped. */
  private async issuesFor(keys: string[]): Promise<Array<{ id: string; key: string }>> {
    if (keys.length === 0) return [];
    return this.database.db
      .select({ id: issues.id, key: issues.key })
      .from(issues)
      .where(and(inArray(issues.key, keys), isNull(issues.deletedAt)));
  }

  /** Applies the changes of one delivery. */
  async receive(connection: Connection, changes: GitChange[]): Promise<void> {
    for (const change of changes) {
      try {
        await this.apply(connection, change);
      } catch (error) {
        this.logger.error(
          { err: error, connection: connection.id, kind: change.kind },
          'Git change failed',
        );
      }
    }
  }

  private async apply(connection: Connection, change: GitChange): Promise<void> {
    let targets: Array<{ id: string; key: string }>;
    if (change.kind === 'build') {
      // Builds name no issue: they belong to the issues of their branch or commit.
      const byBranch = await this.issuesFor(issueKeysIn(change.branch));
      const bySha = change.sha
        ? await this.database.db
            .selectDistinct({ id: issues.id, key: issues.key })
            .from(developmentLinks)
            .innerJoin(issues, eq(issues.id, developmentLinks.issueId))
            .where(
              and(
                eq(developmentLinks.connectionId, connection.id),
                eq(developmentLinks.kind, 'commit'),
                eq(developmentLinks.externalId, change.sha),
              ),
            )
        : [];
      targets = [...new Map([...byBranch, ...bySha].map((entry) => [entry.id, entry])).values()];
    } else {
      targets = await this.issuesFor(
        change.kind === 'branch'
          ? issueKeysIn(change.name)
          : change.kind === 'commit'
            ? issueKeysIn(change.message)
            : issueKeysIn(change.title, change.branch),
      );
    }
    if (targets.length === 0) return;

    const values = this.linkValues(change);
    for (const issue of targets) {
      const fresh = await this.database.db.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(developmentLinks)
          .where(
            and(
              eq(developmentLinks.connectionId, connection.id),
              eq(developmentLinks.kind, change.kind),
              eq(developmentLinks.externalId, values.externalId),
              eq(developmentLinks.issueId, issue.id),
            ),
          )
          .for('update');
        if (before && change.kind === 'commit') return false; // A commit is handled once.
        const data = { ...(before?.data ?? {}), ...values.data } as Record<string, unknown>;
        // A review state stays until a later review changes it.
        if (change.kind === 'pull_request' && !change.review && before?.data.review) {
          data.review = before.data.review;
        }
        if (before) {
          await tx
            .update(developmentLinks)
            .set({ ...values, data, updatedAt: sql`now()` })
            .where(eq(developmentLinks.id, before.id));
        } else {
          await tx.insert(developmentLinks).values({
            id: uuidv7(),
            connectionId: connection.id,
            issueId: issue.id,
            ...values,
            data,
          });
        }
        const event = this.eventFor(change, before);
        if (event) await this.emit(tx, issue.id, event, change);
        return !before;
      });
      if (fresh && change.kind === 'commit') await this.smartCommit(connection, issue, change);
    }
  }

  private linkValues(change: GitChange) {
    switch (change.kind) {
      case 'branch':
        return {
          kind: 'branch',
          externalId: `${change.repository}:${change.name}`,
          repository: change.repository,
          title: change.name,
          url: change.url,
          state: '',
          author: change.author,
          occurredAt: new Date(),
          data: {},
        };
      case 'commit':
        return {
          kind: 'commit',
          externalId: change.sha,
          repository: change.repository,
          title: change.message.split('\n')[0]?.slice(0, 500) ?? '',
          url: change.url,
          state: '',
          author: change.authorName,
          occurredAt: new Date(change.at),
          data: { branch: change.branch, smart: [] },
        };
      case 'pull_request':
        return {
          kind: 'pull_request',
          externalId: `${change.repository}#${change.number}`,
          repository: change.repository,
          title: change.title.slice(0, 500),
          url: change.url,
          state: change.state,
          author: change.author,
          occurredAt: new Date(),
          data: { number: change.number, branch: change.branch, review: change.review },
        };
      case 'build':
        return {
          kind: 'build',
          externalId: `${change.repository}:${change.id}`,
          repository: change.repository,
          title: change.name,
          url: change.url,
          state: change.state,
          author: null,
          occurredAt: new Date(),
          data: { branch: change.branch, sha: change.sha },
        };
    }
  }

  /** The automation event a change means, if any (D-GIT-05, TL-89). */
  private eventFor(change: GitChange, before: Link | undefined): GitEvent | null {
    switch (change.kind) {
      case 'branch':
        return before ? null : 'branch_created';
      case 'commit':
        return 'commit_pushed';
      case 'pull_request':
        if (change.state === 'merged' && before?.state !== 'merged') return 'pull_request_merged';
        if (!before && (change.state === 'open' || change.state === 'draft'))
          return 'pull_request_opened';
        return null;
      case 'build':
        return change.state === 'failure' && before?.state !== 'failure' ? 'build_failed' : null;
    }
  }

  private async emit(tx: Executor, issueId: string, event: GitEvent, change: GitChange) {
    const title =
      change.kind === 'commit'
        ? change.message.split('\n')[0]
        : change.kind === 'branch'
          ? change.name
          : change.kind === 'pull_request'
            ? change.title
            : change.name;
    await tx.insert(domainEvents).values({
      type: `git.${event}`,
      issueId,
      actorId: null,
      payload: {
        repository: change.repository,
        title: title ?? '',
        url: 'url' in change ? change.url : null,
        ...(change.kind === 'pull_request' ? { number: change.number, branch: change.branch } : {}),
        ...(change.kind === 'build' ? { branch: change.branch, state: change.state } : {}),
        ...(change.kind === 'commit' ? { sha: change.sha, author: change.authorName } : {}),
      },
    });
  }

  /**
   * Runs the commands of a commit as the person whose e-mail is the author's, with their rights
   * (D-GIT-03, E-116); unknown authors only get the link. Results are kept on the link.
   */
  private async smartCommit(
    connection: Connection,
    issue: { id: string; key: string },
    change: Extract<GitChange, { kind: 'commit' }>,
  ): Promise<void> {
    const commands = smartCommands(change.message);
    if (commands.length === 0) return;
    const notes: string[] = [];
    const [person] = change.authorEmail
      ? await this.database.db
          .select({ id: users.id, status: users.status })
          .from(users)
          .where(eq(users.email, change.authorEmail.toLowerCase()))
      : [];
    if (person?.status !== 'active') {
      notes.push('Smart Commit übersprungen: Autor ist keine Person in Tasklore');
    } else {
      const principal: Principal = { userId: person.id, via: 'session', sessionId: 'git' };
      for (const command of commands) {
        try {
          if (command.type === 'comment') {
            await this.issues.addComment(principal, issue.key, {
              body: { markdown: command.text },
            } as never);
            notes.push('Kommentar hinzugefügt');
          } else if (command.type === 'time') {
            await this.worklogs.create(principal, issue.key, {
              timeSpent: command.duration,
              comment: command.text,
              remaining: { mode: 'auto' },
            } as never);
            notes.push(`Zeit erfasst: ${command.duration}`);
          } else {
            const options = await this.issues.transitions(principal, issue.key);
            const transition = options.find(
              (entry) =>
                slugOf(entry.name) === command.name || slugOf(entry.to.name) === command.name,
            );
            if (!transition) {
              notes.push(`Kein Übergang „${command.name}“ möglich`);
              continue;
            }
            await this.issues.transition(principal, issue.key, {
              transitionId: transition.id,
              ...(transition.setsResolution ? { resolution: 'done' } : {}),
            });
            notes.push(`Status → ${transition.to.name}`);
          }
        } catch (error) {
          notes.push(
            `Fehler bei #${command.type === 'transition' ? command.name : command.type}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    await this.database.db
      .update(developmentLinks)
      .set({ data: sql`${developmentLinks.data} || ${JSON.stringify({ smart: notes })}::jsonb` })
      .where(
        and(
          eq(developmentLinks.connectionId, connection.id),
          eq(developmentLinks.kind, 'commit'),
          eq(developmentLinks.externalId, change.sha),
          eq(developmentLinks.issueId, issue.id),
        ),
      );
  }

  // ---------------------------------------------------------------- reading

  async development(principal: Principal, key: string): Promise<IssueDevelopment> {
    const issue = await this.issues.get(principal, key);
    const rows = await this.database.db
      .select()
      .from(developmentLinks)
      .where(eq(developmentLinks.issueId, issue.id))
      .orderBy(desc(developmentLinks.occurredAt));
    const of = (kind: string) => rows.filter((row) => row.kind === kind);
    const commits = of('commit');
    // Builds per repository and name: only the latest run counts.
    const builds = new Map<string, Link>();
    for (const row of of('build').sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())) {
      const id = `${row.repository}:${row.title}`;
      if (!builds.has(id)) builds.set(id, row);
    }
    return {
      branches: of('branch').map((row) => ({
        name: row.title,
        repository: row.repository,
        url: row.url,
        updatedAt: row.updatedAt.toISOString(),
      })),
      commits: {
        count: commits.length,
        latest: commits.slice(0, 5).map((row) => ({
          sha: row.externalId,
          message: row.title,
          repository: row.repository,
          url: row.url,
          author: row.author,
          at: row.occurredAt.toISOString(),
          smart: (row.data.smart as string[] | undefined) ?? [],
        })),
      },
      pullRequests: of('pull_request').map((row) => ({
        number: String(row.data.number ?? ''),
        title: row.title,
        repository: row.repository,
        url: row.url,
        state: row.state as 'open',
        review: (row.data.review as 'approved' | null | undefined) ?? null,
        author: row.author,
        updatedAt: row.updatedAt.toISOString(),
      })),
      builds: [...builds.values()].map((row) => ({
        name: row.title,
        repository: row.repository,
        url: row.url,
        state: row.state as 'pending',
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }

  /** Open and merged pull requests and failing builds per issue, e.g. for a release. */
  async summaries(issueIds: Array<{ id: string; key: string }>): Promise<DevelopmentSummary[]> {
    if (issueIds.length === 0) return [];
    const rows = await this.database.db
      .select()
      .from(developmentLinks)
      .where(
        and(
          inArray(
            developmentLinks.issueId,
            issueIds.map((issue) => issue.id),
          ),
          inArray(developmentLinks.kind, ['pull_request', 'build']),
        ),
      );
    return issueIds.flatMap((issue) => {
      const mine = rows.filter((row) => row.issueId === issue.id);
      if (mine.length === 0) return [];
      const latest = new Map<string, Link>();
      for (const row of mine.filter((entry) => entry.kind === 'build')) {
        const id = `${row.repository}:${row.title}`;
        const known = latest.get(id);
        if (!known || known.updatedAt < row.updatedAt) latest.set(id, row);
      }
      return [
        {
          issueKey: issue.key,
          openPullRequests: mine.filter(
            (row) => row.kind === 'pull_request' && (row.state === 'open' || row.state === 'draft'),
          ).length,
          mergedPullRequests: mine.filter(
            (row) => row.kind === 'pull_request' && row.state === 'merged',
          ).length,
          failingBuilds: [...latest.values()].filter((row) => row.state === 'failure').length,
        },
      ];
    });
  }
}
