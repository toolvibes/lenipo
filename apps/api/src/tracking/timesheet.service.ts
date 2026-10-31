import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  RunningTimer,
  Timesheet,
  TimesheetCellRequest,
  TimesheetQuery,
  Worklog,
} from '@tasklore/shared';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { issues, issueTimers, issueWorklogs, projects, users } from '../db/schema/index.js';
import { IssueService } from './issue.service.js';
import { securityVisible } from './issue-security.js';
import { ProjectAccessService } from './project-access.service.js';
import { WorklogService } from './worklog.service.js';

const DAY = 86_400_000;

/** Monday of the week of a date (yyyy-MM-dd). */
function monday(date: string): string {
  const day = new Date(`${date}T12:00:00Z`);
  const offset = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - offset * DAY).toISOString().slice(0, 10);
}

/** Whole minutes as a duration text, at least one minute. */
function minutes(seconds: number): string {
  return `${Math.max(1, Math.ceil(seconds / 60))}m`;
}

/**
 * The weekly timesheet and the running timer (TL-24, E-105). Changes go through the worklog
 * service, so remaining estimates, history and events behave as with any logged work.
 */
@Injectable()
export class TimesheetService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(WorklogService) private readonly worklogs: WorklogService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
  ) {}

  private async person(id: string) {
    const [user] = await this.database.db
      .select({ id: users.id, displayName: users.displayName, timeZone: users.timeZone })
      .from(users)
      .where(eq(users.id, id));
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async week(principal: Principal, query: TimesheetQuery): Promise<Timesheet> {
    const user = await this.person(query.user ?? principal.userId);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: user.timeZone }).format(new Date());
    const week = monday(query.week ?? today);
    const days = Array.from({ length: 7 }, (_, index) =>
      new Date(Date.parse(`${week}T12:00:00Z`) + index * DAY).toISOString().slice(0, 10),
    );
    const day = sql<string>`to_char(${issueWorklogs.startedAt} at time zone ${user.timeZone}, 'YYYY-MM-DD')`;
    const visibleProjects = this.database.db
      .select({ id: projects.id })
      .from(projects)
      .where(await this.projectAccess.browsableCondition(principal.userId));
    const rows = await this.database.db
      .select({
        id: issueWorklogs.id,
        day,
        seconds: issueWorklogs.timeSpentSeconds,
        key: issues.key,
        summary: issues.summary,
        projectKey: projects.key,
        projectName: projects.name,
      })
      .from(issueWorklogs)
      .innerJoin(issues, eq(issues.id, issueWorklogs.issueId))
      .innerJoin(projects, eq(projects.id, issues.projectId))
      .where(
        and(
          eq(issueWorklogs.authorId, user.id),
          isNull(issues.deletedAt),
          inArray(issues.projectId, visibleProjects),
          securityVisible(principal.userId),
          sql`${day} >= ${days[0]} and ${day} <= ${days[6]}`,
        ),
      )
      .orderBy(asc(issues.key), asc(issueWorklogs.startedAt));
    const byIssue = new Map<string, Timesheet['rows'][number]>();
    for (const row of rows) {
      let entry = byIssue.get(row.key);
      if (!entry) {
        entry = {
          issue: {
            key: row.key,
            summary: row.summary,
            project: { key: row.projectKey, name: row.projectName },
          },
          cells: days.map((date) => ({ date, seconds: 0, worklogIds: [] })),
          total: 0,
        };
        byIssue.set(row.key, entry);
      }
      const cell = entry.cells[days.indexOf(row.day)];
      if (!cell) continue;
      cell.seconds += row.seconds;
      cell.worklogIds.push(row.id);
      entry.total += row.seconds;
    }
    const list = [...byIssue.values()];
    const dayTotals = days.map((_, index) =>
      list.reduce((sum, row) => sum + (row.cells[index]?.seconds ?? 0), 0),
    );
    return {
      user: { id: user.id, displayName: user.displayName },
      week,
      days,
      rows: list,
      dayTotals,
      total: dayTotals.reduce((sum, value) => sum + value, 0),
      editable: user.id === principal.userId,
    };
  }

  /** One cell of one's own week: create, change or remove the day's single worklog. */
  async setCell(principal: Principal, request: TimesheetCellRequest): Promise<Timesheet> {
    const user = await this.person(principal.userId);
    const { issue } = await this.issues.authorize(principal, request.issueKey, 'browse');
    const day = sql<string>`to_char(${issueWorklogs.startedAt} at time zone ${user.timeZone}, 'YYYY-MM-DD')`;
    const existing = await this.database.db
      .select({ id: issueWorklogs.id })
      .from(issueWorklogs)
      .where(
        and(
          eq(issueWorklogs.issueId, issue.id),
          eq(issueWorklogs.authorId, principal.userId),
          sql`${day} = ${request.date}`,
        ),
      );
    if (existing.length > 1) {
      throw new ConflictException('Several worklogs on this day; change them on the issue');
    }
    const [own] = existing;
    if (own && request.seconds === 0) {
      await this.worklogs.delete(principal, request.issueKey, own.id);
    } else if (own) {
      await this.worklogs.update(principal, request.issueKey, own.id, {
        timeSpent: minutes(request.seconds),
      });
    } else if (request.seconds > 0) {
      await this.worklogs.create(principal, request.issueKey, {
        timeSpent: minutes(request.seconds),
        // Noon UTC keeps the day in every European time zone.
        started: `${request.date}T12:00:00.000Z`,
        comment: '',
        remaining: { mode: 'auto' },
      });
    }
    return this.week(principal, { week: request.date });
  }

  // ---------------------------------------------------------------- timer

  async timer(principal: Principal): Promise<RunningTimer | null> {
    const [row] = await this.database.db
      .select({ key: issues.key, summary: issues.summary, startedAt: issueTimers.startedAt })
      .from(issueTimers)
      .innerJoin(issues, eq(issues.id, issueTimers.issueId))
      .where(eq(issueTimers.userId, principal.userId));
    return row
      ? { issue: { key: row.key, summary: row.summary }, startedAt: row.startedAt.toISOString() }
      : null;
  }

  async start(principal: Principal, key: string): Promise<RunningTimer | null> {
    const { issue } = await this.issues.authorize(principal, key, 'edit-issues');
    const running = await this.timer(principal);
    if (running) {
      throw new ConflictException(`A timer is already running on ${running.issue.key}`);
    }
    await this.database.db
      .insert(issueTimers)
      .values({ userId: principal.userId, issueId: issue.id });
    return this.timer(principal);
  }

  /** Logs the elapsed time, rounded up to the minute, and ends the timer. */
  async stop(principal: Principal, comment: string): Promise<Worklog> {
    const running = await this.timer(principal);
    if (!running) throw new BadRequestException('No timer is running');
    const seconds = (Date.now() - Date.parse(running.startedAt)) / 1000;
    const worklog = await this.worklogs.create(principal, running.issue.key, {
      timeSpent: minutes(seconds),
      started: running.startedAt,
      comment,
      remaining: { mode: 'auto' },
    });
    await this.discard(principal);
    return worklog;
  }

  async discard(principal: Principal): Promise<void> {
    await this.database.db.delete(issueTimers).where(eq(issueTimers.userId, principal.userId));
  }
}
