import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateWorklogRequest,
  ProjectPermission,
  UpdateWorklogRequest,
  UserRef,
  WorkingTime,
  Worklog,
} from '@tasklore/shared';
import { formatDuration } from '@tasklore/tql';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import { issues, issueWorklogs, users } from '../db/schema/index.js';
import { emitIssueEvent } from '../notifications/events.js';
import { durationSeconds } from './duration.js';
import { recordChanges } from './history.js';
import { IssueService } from './issue.service.js';
import { WorkingTimeService } from './working-time.service.js';

type WorklogRow = typeof issueWorklogs.$inferSelect;
type IssueRow = Pick<typeof issues.$inferSelect, 'id'>;

/** The work log of issues (T-TIM-02, E-47); keeps time spent and remaining estimate in step. */
@Injectable()
export class WorklogService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(WorkingTimeService) private readonly workingTime: WorkingTimeService,
  ) {}

  private present(
    row: WorklogRow,
    author: UserRef | null,
    principal: Principal,
    permissions: Set<ProjectPermission>,
  ): Worklog {
    const own = row.authorId === principal.userId && permissions.has('edit-issues');
    return {
      id: row.id,
      author,
      started: row.startedAt.toISOString(),
      timeSpentSeconds: row.timeSpentSeconds,
      comment: row.comment,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      canEdit: own,
      canDelete: own || permissions.has('administer'),
    };
  }

  private async author(id: string | null): Promise<UserRef | null> {
    if (!id) return null;
    const [user] = await this.database.db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, id));
    return user ?? null;
  }

  async list(principal: Principal, key: string): Promise<Worklog[]> {
    const { issue, permissions } = await this.issues.authorize(principal, key, 'browse');
    const rows = await this.database.db
      .select()
      .from(issueWorklogs)
      .where(eq(issueWorklogs.issueId, issue.id))
      .orderBy(desc(issueWorklogs.startedAt), desc(issueWorklogs.id));
    const ids = [...new Set(rows.flatMap((row) => (row.authorId ? [row.authorId] : [])))];
    const people =
      ids.length > 0
        ? await this.database.db
            .select({ id: users.id, displayName: users.displayName })
            .from(users)
            .where(inArray(users.id, ids))
        : [];
    const byId = new Map(people.map((person) => [person.id, person]));
    return rows.map((row) =>
      this.present(
        row,
        row.authorId ? (byId.get(row.authorId) ?? null) : null,
        principal,
        permissions,
      ),
    );
  }

  /**
   * Moves time spent by `delta` and, unless told otherwise, the remaining estimate the other
   * way (never below zero); an issue without an estimate keeps none.
   */
  private async adjust(
    tx: Executor,
    principal: Principal,
    issue: IssueRow,
    delta: number,
    remaining: { mode: 'auto' } | { mode: 'leave' } | { mode: 'set'; seconds: number },
    time: WorkingTime,
  ): Promise<void> {
    // Read under a row lock, so two worklogs at once cannot overwrite each other's adjustment.
    const [current] = await tx
      .select({ remaining: issues.remainingEstimateSeconds })
      .from(issues)
      .where(eq(issues.id, issue.id))
      .for('update');
    const before = current?.remaining ?? null;
    let next = before;
    if (remaining.mode === 'auto' && next !== null) next = Math.max(0, next - delta);
    if (remaining.mode === 'set') next = remaining.seconds;
    await tx
      .update(issues)
      .set({
        timeSpentSeconds: sql`greatest(0, ${issues.timeSpentSeconds} + ${delta})`,
        remainingEstimateSeconds: next,
        updatedAt: sql`now()`,
      })
      .where(eq(issues.id, issue.id));
    // Only an explicitly set remaining estimate is a change worth the history (E-47).
    if (remaining.mode === 'set' && next !== before) {
      const show = (seconds: number | null) =>
        seconds === null ? null : formatDuration(seconds, time);
      await recordChanges(tx, issue.id, principal, [
        {
          field: 'remainingEstimate',
          fromValue: before?.toString() ?? null,
          toValue: next?.toString() ?? null,
          fromDisplay: show(before),
          toDisplay: show(next),
        },
      ]);
    }
  }

  async create(principal: Principal, key: string, request: CreateWorklogRequest): Promise<Worklog> {
    const { issue, permissions } = await this.issues.authorize(principal, key, 'edit-issues');
    const time = await this.workingTime.get();
    const seconds = durationSeconds(request.timeSpent, time, 'timeSpent');
    const remaining =
      request.remaining.mode === 'set'
        ? {
            mode: 'set' as const,
            seconds: durationSeconds(request.remaining.value, time, 'remaining'),
          }
        : request.remaining;
    const id = uuidv7();
    const [row] = await this.database.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(issueWorklogs)
        .values({
          id,
          issueId: issue.id,
          authorId: principal.userId,
          startedAt: request.started ? new Date(request.started) : new Date(),
          timeSpentSeconds: seconds,
          comment: request.comment.trim(),
        })
        .returning();
      await this.adjust(tx, principal, issue, seconds, remaining, time);
      await emitIssueEvent(tx, issue.id, principal.userId, {
        type: 'issue.worklog',
        action: 'created',
        worklogId: id,
        timeSpentSeconds: seconds,
      });
      return inserted;
    });
    if (!row) throw new NotFoundException('Worklog not found');
    return this.present(row, await this.author(principal.userId), principal, permissions);
  }

  private async loadOwn(principal: Principal, key: string, id: string, deleting: boolean) {
    const { issue, permissions } = await this.issues.authorize(principal, key, 'edit-issues');
    const [row] = await this.database.db
      .select()
      .from(issueWorklogs)
      .where(and(eq(issueWorklogs.id, id), eq(issueWorklogs.issueId, issue.id)));
    if (!row) throw new NotFoundException('Worklog not found');
    const own = row.authorId === principal.userId;
    if (!own && !(deleting && permissions.has('administer'))) {
      throw new ForbiddenException(
        deleting
          ? 'Only the author or a project administrator can delete this worklog'
          : 'Only the author can change this worklog',
      );
    }
    return { issue, permissions, row };
  }

  async update(
    principal: Principal,
    key: string,
    id: string,
    request: UpdateWorklogRequest,
  ): Promise<Worklog> {
    const { issue, permissions, row } = await this.loadOwn(principal, key, id, false);
    const time = await this.workingTime.get();
    const seconds =
      request.timeSpent !== undefined
        ? durationSeconds(request.timeSpent, time, 'timeSpent')
        : row.timeSpentSeconds;
    const [updated] = await this.database.db.transaction(async (tx) => {
      const result = await tx
        .update(issueWorklogs)
        .set({
          timeSpentSeconds: seconds,
          ...(request.started !== undefined ? { startedAt: new Date(request.started) } : {}),
          ...(request.comment !== undefined ? { comment: request.comment.trim() } : {}),
          updatedAt: sql`now()`,
        })
        .where(eq(issueWorklogs.id, row.id))
        .returning();
      const delta = seconds - row.timeSpentSeconds;
      if (delta !== 0) await this.adjust(tx, principal, issue, delta, { mode: 'auto' }, time);
      await emitIssueEvent(tx, issue.id, principal.userId, {
        type: 'issue.worklog',
        action: 'updated',
        worklogId: row.id,
        timeSpentSeconds: seconds,
      });
      return result;
    });
    if (!updated) throw new NotFoundException('Worklog not found');
    return this.present(updated, await this.author(updated.authorId), principal, permissions);
  }

  /** Deleting gives the time back to the remaining estimate, as in Jira's "auto adjust". */
  async delete(principal: Principal, key: string, id: string): Promise<void> {
    const { issue, row } = await this.loadOwn(principal, key, id, true);
    const time = await this.workingTime.get();
    await this.database.db.transaction(async (tx) => {
      await tx.delete(issueWorklogs).where(eq(issueWorklogs.id, row.id));
      await this.adjust(tx, principal, issue, -row.timeSpentSeconds, { mode: 'auto' }, time);
      await emitIssueEvent(tx, issue.id, principal.userId, {
        type: 'issue.worklog',
        action: 'deleted',
        worklogId: row.id,
        timeSpentSeconds: row.timeSpentSeconds,
      });
    });
  }
}
