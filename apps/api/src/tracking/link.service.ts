import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateIssueLinkRequest, IssueLink, IssueLinkTypeInfo } from '@toolvibes/shared';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, type Executor, isUniqueViolation } from '../db/client.js';
import { issueLinks, issues, projects } from '../db/schema/index.js';
import { recordChanges } from './history.js';
import { securityVisible } from './issue-security.js';
import { MetaService } from './meta.service.js';
import { ProjectAccessService } from './project-access.service.js';

type IssueRow = Pick<typeof issues.$inferSelect, 'id' | 'key'>;

function phrase(type: IssueLinkTypeInfo, direction: IssueLink['direction']): string {
  return direction === 'outward' ? type.outward : type.inward;
}

/** Links between issues (T-ISS-04), stored once and shown from both sides (E-41). */
@Injectable()
export class LinkService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(MetaService) private readonly meta: MetaService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
  ) {}

  /** Links of an issue to issues the user can see (all for null); hidden ones are left out. */
  async linksFor(userId: string | null, issueId: string): Promise<IssueLink[]> {
    const db = this.database.db;
    const rows = await db
      .select()
      .from(issueLinks)
      .where(or(eq(issueLinks.sourceId, issueId), eq(issueLinks.targetId, issueId)));
    if (rows.length === 0) return [];
    const otherIds = rows.map((row) => (row.sourceId === issueId ? row.targetId : row.sourceId));
    const visibleProjects = userId
      ? db
          .select({ id: projects.id })
          .from(projects)
          .where(await this.projectAccess.browsableCondition(userId))
      : null;
    const others = await db
      .select()
      .from(issues)
      .where(
        and(
          inArray(issues.id, otherIds),
          isNull(issues.deletedAt),
          visibleProjects ? inArray(issues.projectId, visibleProjects) : undefined,
          userId ? securityVisible(userId) : undefined,
        ),
      );
    const meta = await this.meta.load();
    const byId = new Map(others.map((other) => [other.id, other]));
    const links: IssueLink[] = [];
    for (const row of rows) {
      const direction = row.sourceId === issueId ? 'outward' : 'inward';
      const other = byId.get(direction === 'outward' ? row.targetId : row.sourceId);
      const type = meta.linkType.get(row.typeId);
      const issueType = other && meta.issueType.get(other.issueTypeId);
      const status = other && meta.status.get(other.statusId);
      const priority = other && meta.priority.get(other.priorityId);
      if (!other || !type || !issueType || !status || !priority) continue;
      links.push({
        id: row.id,
        type,
        direction,
        issue: {
          id: other.id,
          key: other.key,
          summary: other.summary,
          issueType,
          status,
          priority,
        },
      });
    }
    return links.sort(
      (a, b) =>
        phrase(a.type, a.direction).localeCompare(phrase(b.type, b.direction)) ||
        a.issue.key.localeCompare(b.issue.key, undefined, { numeric: true }),
    );
  }

  private async linkType(value: string): Promise<IssueLinkTypeInfo> {
    const wanted = value.toLowerCase();
    const type = (await this.meta.load()).linkTypes.find(
      (entry) => entry.key === wanted || entry.name.toLowerCase() === wanted,
    );
    if (!type) throw new BadRequestException(`Unknown link type "${value}"`);
    return type;
  }

  /** Links `issue` to another issue the user can browse; both histories record the link. */
  async create(
    principal: Principal,
    issue: IssueRow,
    request: CreateIssueLinkRequest,
  ): Promise<void> {
    const type = await this.linkType(request.type);
    const [other] = await this.database.db
      .select({ id: issues.id, key: issues.key, projectId: issues.projectId })
      .from(issues)
      .where(
        and(
          eq(issues.key, request.issueKey.toUpperCase()),
          isNull(issues.deletedAt),
          // A secured issue the user cannot see stays "not found" (TL-44, E-125).
          securityVisible(principal.userId),
        ),
      );
    if (
      !other ||
      !(await this.projectAccess.permissions(principal.userId, other.projectId)).has('browse')
    ) {
      throw new NotFoundException(`Issue ${request.issueKey.toUpperCase()} not found`);
    }
    if (other.id === issue.id) throw new BadRequestException('An issue cannot be linked to itself');
    const [source, target] = request.direction === 'outward' ? [issue, other] : [other, issue];
    try {
      await this.database.db.transaction(async (tx) => {
        await tx.insert(issueLinks).values({
          id: uuidv7(),
          typeId: type.id,
          sourceId: source.id,
          targetId: target.id,
          createdById: principal.userId,
        });
        await this.record(tx, principal, type, source, target, 'added');
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('These issues are already linked this way');
      throw error;
    }
  }

  async delete(principal: Principal, issue: IssueRow, linkId: string): Promise<void> {
    const [link] = await this.database.db
      .select()
      .from(issueLinks)
      .where(
        and(
          eq(issueLinks.id, linkId),
          or(eq(issueLinks.sourceId, issue.id), eq(issueLinks.targetId, issue.id)),
        ),
      );
    if (!link) throw new NotFoundException('Link not found');
    const type = (await this.meta.load()).linkType.get(link.typeId);
    const ends = await this.database.db
      .select({ id: issues.id, key: issues.key })
      .from(issues)
      .where(inArray(issues.id, [link.sourceId, link.targetId]));
    const source = ends.find((end) => end.id === link.sourceId);
    const target = ends.find((end) => end.id === link.targetId);
    await this.database.db.transaction(async (tx) => {
      await tx.delete(issueLinks).where(eq(issueLinks.id, link.id));
      if (type && source && target)
        await this.record(tx, principal, type, source, target, 'removed');
    });
  }

  /** History on both issues, each from its own side: "blocks WEB-2" and "is blocked by WEB-1". */
  private async record(
    tx: Executor,
    principal: Principal,
    type: IssueLinkTypeInfo,
    source: IssueRow,
    target: IssueRow,
    action: 'added' | 'removed',
  ): Promise<void> {
    const sides: Array<[IssueRow, string]> = [
      [source, `${type.outward} ${target.key}`],
      [target, `${type.inward} ${source.key}`],
    ];
    for (const [issue, text] of sides) {
      await recordChanges(tx, issue.id, principal, [
        {
          field: 'link',
          fromValue: null,
          toValue: null,
          fromDisplay: action === 'removed' ? text : null,
          toDisplay: action === 'added' ? text : null,
        },
      ]);
    }
  }
}
