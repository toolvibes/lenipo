import { Inject, Injectable } from '@nestjs/common';
import type { IssueSummary, Timeline, TimelineRow, TimelineSpan } from '@tasklore/shared';
import { and, asc, eq, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { issues, projectVersions, sprintIssues, sprints } from '../db/schema/index.js';
import { IssueService } from './issue.service.js';
import { MetaService } from './meta.service.js';
import { ProjectService } from './project.service.js';

type Range = { start: string; end: string };

/** The issue's own dates as a bar; a single date makes a one-day bar. */
function ownSpan(issue: IssueSummary): TimelineSpan | null {
  const start = issue.startDate ?? issue.dueDate;
  const end = issue.dueDate ?? issue.startDate;
  return start && end ? { start, end, derived: false } : null;
}

/** The smallest range around all given ranges; ISO dates sort as text. */
function cover(ranges: Range[]): Range | null {
  const starts = ranges.map((range) => range.start).sort();
  const ends = ranges.map((range) => range.end).sort();
  const start = starts[0];
  const end = ends.at(-1);
  return start && end ? { start, end } : null;
}

/**
 * The project timeline (T-RDM-01, E-68): epics with their bars and progress, their children,
 * and versions with a release date as milestones.
 */
@Injectable()
export class TimelineService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(MetaService) private readonly meta: MetaService,
  ) {}

  async get(principal: Principal, projectKey: string): Promise<Timeline> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    const db = this.database.db;
    const meta = await this.meta.load();
    const epicTypes = meta.issueTypes
      .filter((type) => type.hierarchyLevel >= 1)
      .map((type) => type.id);
    const epicRows =
      epicTypes.length === 0
        ? []
        : await db
            .select()
            .from(issues)
            .where(
              and(
                eq(issues.projectId, project.id),
                isNull(issues.deletedAt),
                inArray(issues.issueTypeId, epicTypes),
              ),
            )
            .orderBy(asc(issues.rank), asc(issues.id));
    const childRows =
      epicRows.length === 0
        ? []
        : await db
            .select()
            .from(issues)
            .where(
              and(
                inArray(
                  issues.parentId,
                  epicRows.map((row) => row.id),
                ),
                isNull(issues.deletedAt),
              ),
            )
            .orderBy(asc(issues.rank), asc(issues.id));
    const [summaries, sprintRanges, milestones] = await Promise.all([
      this.issues.summarize(principal.userId, [...epicRows, ...childRows]),
      this.sprintRanges(childRows.map((row) => row.id)),
      db
        .select({
          id: projectVersions.id,
          name: projectVersions.name,
          date: projectVersions.releaseDate,
          released: projectVersions.released,
        })
        .from(projectVersions)
        .where(
          and(
            eq(projectVersions.projectId, project.id),
            eq(projectVersions.archived, false),
            isNotNull(projectVersions.releaseDate),
          ),
        )
        .orderBy(asc(projectVersions.releaseDate), asc(projectVersions.name)),
    ]);
    const byId = new Map(summaries.map((summary) => [summary.id, summary]));

    const childRow = (id: string): TimelineRow | null => {
      const issue = byId.get(id);
      if (!issue) return null;
      const sprint = sprintRanges.get(id);
      return {
        issue,
        span: ownSpan(issue) ?? (sprint ? { ...sprint, derived: true } : null),
      };
    };

    return {
      epics: epicRows.flatMap((epicRow) => {
        const issue = byId.get(epicRow.id);
        if (!issue) return [];
        const children = childRows
          .filter((row) => row.parentId === epicRow.id)
          .map((row) => childRow(row.id))
          .filter((row): row is TimelineRow => row !== null);
        const derived = cover(children.flatMap((child) => (child.span ? [child.span] : [])));
        const points = children.reduce((sum, child) => sum + (child.issue.storyPoints ?? 0), 0);
        const done = children.filter((child) => child.issue.status.category === 'done');
        return [
          {
            issue,
            span: ownSpan(issue) ?? (derived ? { ...derived, derived: true } : null),
            progress:
              points > 0
                ? {
                    done: done.reduce((sum, child) => sum + (child.issue.storyPoints ?? 0), 0),
                    total: points,
                    unit: 'points' as const,
                  }
                : { done: done.length, total: children.length, unit: 'issues' as const },
            children,
          },
        ];
      }),
      milestones: milestones.flatMap((milestone) =>
        milestone.date ? [{ ...milestone, date: milestone.date }] : [],
      ),
    };
  }

  /**
   * The dates of the latest sprint each issue was or is in, for issues without own dates.
   * Planned dates win; otherwise the real start and end.
   */
  private async sprintRanges(issueIds: string[]): Promise<Map<string, Range>> {
    if (issueIds.length === 0) return new Map();
    const start = sql<string | null>`coalesce(${sprints.startDate}, ${sprints.startedAt}::date)`;
    const end = sql<string | null>`coalesce(${sprints.endDate}, ${sprints.completedAt}::date)`;
    const rows = await this.database.db
      .select({ issueId: sprintIssues.issueId, start, end })
      .from(sprintIssues)
      .innerJoin(sprints, eq(sprints.id, sprintIssues.sprintId))
      .where(
        and(
          inArray(sprintIssues.issueId, issueIds),
          isNull(sprintIssues.removedAt),
          gte(end, start),
        ),
      )
      .orderBy(asc(start));
    const ranges = new Map<string, Range>();
    for (const row of rows) {
      // Later sprints overwrite earlier ones.
      if (row.start && row.end) ranges.set(row.issueId, { start: row.start, end: row.end });
    }
    return ranges;
  }
}
