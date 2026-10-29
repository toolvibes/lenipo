import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type {
  SearchRequest,
  SearchResult,
  ValueSuggestion,
  ValueSuggestionQuery,
} from '@tasklore/shared';
import { findField, parse, STATUS_CATEGORY_NAMES } from '@tasklore/tql';
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { AccessService } from '../access/access.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { issues, projectComponents, projects, users } from '../db/schema/index.js';
import { UserService } from '../identity/user.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { MetaService } from '../tracking/meta.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { QueryException } from './query-exception.js';
import { type CompiledQuery, TqlCompiler } from './tql-compiler.js';

const { searchVector: _searchVector, ...issueColumns } = getTableColumns(issues);

const DEFAULT_TIME_ZONE = 'Europe/Berlin';

function validTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Tokens need an issues scope to search, like every other tracking read. */
export function requireIssueScope(principal: Principal, write = false): void {
  if (principal.via !== 'token') return;
  const needed = write ? ['issues:write'] : ['issues:read', 'issues:write'];
  if (!principal.scopes.some((scope) => needed.includes(scope))) {
    throw new ForbiddenException(`This token lacks the ${needed.at(-1)} scope`);
  }
}

/** Runs TQL queries (decisions E-33 to E-36); the permission filter is always part of the SQL. */
@Injectable()
export class SearchService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(MetaService) private readonly meta: MetaService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(IssueService) private readonly issueService: IssueService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(UserService) private readonly userService: UserService,
  ) {}

  private async browsableProjects(userId: string) {
    return this.database.db
      .select({ id: projects.id, key: projects.key, name: projects.name })
      .from(projects)
      .where(await this.projectAccess.browsableCondition(userId))
      .orderBy(projects.key);
  }

  /** Parses and compiles a query as this user would run it; throws a QueryException if invalid. */
  async compile(
    principal: Principal,
    text: string,
  ): Promise<CompiledQuery & { projectIds: string[] }> {
    const parsed = parse(text);
    if (!parsed.query || parsed.errors.length > 0) throw new QueryException(parsed.errors);
    const [meta, visibleProjects, [user]] = await Promise.all([
      this.meta.load(),
      this.browsableProjects(principal.userId),
      this.database.db
        .select({ timeZone: users.timeZone })
        .from(users)
        .where(eq(users.id, principal.userId)),
    ]);
    const timeZone = user && validTimeZone(user.timeZone) ? user.timeZone : DEFAULT_TIME_ZONE;
    const projectIds = visibleProjects.map((project) => project.id);
    const components =
      projectIds.length > 0
        ? await this.database.db
            .select({ id: projectComponents.id, name: projectComponents.name })
            .from(projectComponents)
            .where(inArray(projectComponents.projectId, projectIds))
        : [];
    const compiler = new TqlCompiler(this.database.db, {
      userId: principal.userId,
      timeZone,
      meta,
      projects: visibleProjects,
      components,
    });
    const compiled = await compiler.compile(parsed.query);
    if (compiler.errors.length > 0) {
      throw new QueryException(compiler.errors.sort((a, b) => a.start - b.start));
    }
    return { ...compiled, projectIds };
  }

  async search(principal: Principal, request: SearchRequest): Promise<SearchResult> {
    requireIssueScope(principal);
    const compiled = await this.compile(principal, request.query);
    const empty = { issues: [], total: 0, limit: request.limit, offset: request.offset };
    if (compiled.projectIds.length === 0) return empty;
    const where = and(
      inArray(issues.projectId, compiled.projectIds),
      isNull(issues.deletedAt),
      compiled.where,
    );
    const [rows, [total]] = await Promise.all([
      this.database.db
        .select(issueColumns)
        .from(issues)
        .where(where)
        .orderBy(...compiled.orderBy)
        .limit(request.limit)
        .offset(request.offset),
      this.database.db.select({ total: count() }).from(issues).where(where),
    ]);
    return {
      issues: await this.issueService.summarize(rows),
      total: total?.total ?? 0,
      limit: request.limit,
      offset: request.offset,
    };
  }

  /** Stored values for completing the value of a field; `value` is what goes into the query. */
  async suggestions(principal: Principal, query: ValueSuggestionQuery): Promise<ValueSuggestion[]> {
    requireIssueScope(principal);
    const field = findField(query.field);
    if (!field) throw new BadRequestException(`The field "${query.field}" does not exist`);
    const prefix = query.prefix.trim().toLowerCase();
    const startsWith = (...names: string[]) =>
      names.some((name) => name.toLowerCase().startsWith(prefix));
    const meta = await this.meta.load();

    switch (field.type) {
      case 'project': {
        const visible = await this.browsableProjects(principal.userId);
        return visible
          .filter((project) => startsWith(project.key, project.name))
          .slice(0, query.limit)
          .map((project) => ({ value: project.key, label: project.name, detail: project.key }));
      }
      case 'issue-type':
        return meta.issueTypes
          .filter((type) => startsWith(type.name, type.key))
          .slice(0, query.limit)
          .map((type) => ({ value: type.name, label: type.name, key: type.key }));
      case 'status':
        return meta.statuses
          .filter((status) => startsWith(status.name, status.key))
          .slice(0, query.limit)
          .map((status) => ({ value: status.name, label: status.name, key: status.key }));
      case 'priority':
        return meta.priorities
          .filter((priority) => startsWith(priority.name, priority.key))
          .slice(0, query.limit)
          .map((priority) => ({ value: priority.name, label: priority.name, key: priority.key }));
      case 'resolution':
        return meta.resolutions
          .filter((resolution) => startsWith(resolution.name, resolution.key))
          .slice(0, query.limit)
          .map((resolution) => ({
            value: resolution.name,
            label: resolution.name,
            key: resolution.key,
          }));
      case 'status-category':
        return Object.entries(STATUS_CATEGORY_NAMES)
          .filter(([, names]) => startsWith(...names))
          .map(([category]) => ({ value: category, label: category, key: category }));
      case 'user': {
        // Listing people needs the same permission as the user directory.
        if (!(await this.access.hasGlobal(principal.userId, 'browse-users'))) return [];
        const people = await this.userService.search(prefix, query.limit);
        return people.map((person) => ({
          value: person.email,
          label: person.displayName,
          detail: person.email,
        }));
      }
      case 'label': {
        const projectIds = (await this.browsableProjects(principal.userId)).map(
          (project) => project.id,
        );
        if (projectIds.length === 0) return [];
        const ids = sql.join(
          projectIds.map((id) => sql`${id}`),
          sql`, `,
        );
        const rows = await this.database.db.execute<{ label: string }>(sql`
          select distinct l.label from issues i, unnest(i.labels) as l(label)
          where i.project_id in (${ids}) and i.deleted_at is null
            and lower(l.label) like ${`${escapeLike(prefix)}%`}
          order by l.label limit ${query.limit}`);
        return [...rows].map((row) => ({ value: row.label, label: row.label }));
      }
      case 'component': {
        const visible = await this.browsableProjects(principal.userId);
        if (visible.length === 0) return [];
        const rows = await this.database.db
          .select({ name: projectComponents.name, projectId: projectComponents.projectId })
          .from(projectComponents)
          .where(
            and(
              inArray(
                projectComponents.projectId,
                visible.map((project) => project.id),
              ),
              ilike(projectComponents.name, `${escapeLike(prefix)}%`),
            ),
          )
          .orderBy(projectComponents.name)
          .limit(query.limit);
        const keyOf = new Map(visible.map((project) => [project.id, project.key]));
        return rows.map((row) => ({
          value: row.name,
          label: row.name,
          detail: keyOf.get(row.projectId),
        }));
      }
      case 'link-type':
        // Both direction phrases; the type key or name would match both directions.
        return meta.linkTypes
          .flatMap((type) =>
            [...new Set([type.outward, type.inward])].map((phrase) => ({
              value: phrase,
              label: phrase,
            })),
          )
          .filter((entry) => startsWith(entry.value))
          .slice(0, query.limit);
      case 'issue': {
        const projectIds = (await this.browsableProjects(principal.userId)).map(
          (project) => project.id,
        );
        if (projectIds.length === 0) return [];
        const pattern = `%${escapeLike(prefix)}%`;
        const rows = await this.database.db
          .select({ key: issues.key, summary: issues.summary })
          .from(issues)
          .where(
            and(
              inArray(issues.projectId, projectIds),
              isNull(issues.deletedAt),
              prefix
                ? or(ilike(issues.key, `${escapeLike(prefix)}%`), ilike(issues.summary, pattern))
                : undefined,
            ),
          )
          .orderBy(desc(issues.updatedAt))
          .limit(query.limit);
        return rows.map((row) => ({ value: row.key, label: row.summary, detail: row.key }));
      }
      default:
        return [];
    }
  }
}
