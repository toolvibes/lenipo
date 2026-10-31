import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateVersionRequest,
  ReleaseVersionRequest,
  UpdateVersionRequest,
  Version,
  VersionRef,
} from '@tasklore/shared';
import { and, asc, count, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, type Executor, isUniqueViolation } from '../db/client.js';
import { issues, issueVersions, projectVersions } from '../db/schema/index.js';
import { emitProjectEvent } from '../notifications/events.js';
import { recordChanges } from './history.js';
import { MetaService } from './meta.service.js';
import { ProjectService } from './project.service.js';
import { ProjectAccessService } from './project-access.service.js';

type VersionRow = typeof projectVersions.$inferSelect;
type Kind = 'fix' | 'affects';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Field names in the issue history for the two kinds. */
export const VERSION_FIELD: Record<Kind, string> = {
  fix: 'fixVersions',
  affects: 'affectsVersions',
};

/** Versions of projects and releases (T-REL-01, -03; E-57). */
@Injectable()
export class VersionService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(MetaService) private readonly meta: MetaService,
  ) {}

  private async doneStatusIds(): Promise<string[]> {
    const meta = await this.meta.load();
    return meta.statuses.filter((status) => status.category === 'done').map((status) => status.id);
  }

  private async present(rows: VersionRow[]): Promise<Version[]> {
    if (rows.length === 0) return [];
    const done = await this.doneStatusIds();
    const counts = await this.database.db
      .select({
        versionId: issueVersions.versionId,
        total: count(),
        open: sql<number>`count(*) filter (where ${
          done.length > 0 ? notInArray(issues.statusId, done) : sql`true`
        })`.mapWith(Number),
      })
      .from(issueVersions)
      .innerJoin(issues, eq(issues.id, issueVersions.issueId))
      .where(
        and(
          inArray(
            issueVersions.versionId,
            rows.map((row) => row.id),
          ),
          eq(issueVersions.kind, 'fix'),
          isNull(issues.deletedAt),
        ),
      )
      .groupBy(issueVersions.versionId);
    return rows.map((row) => {
      const found = counts.find((entry) => entry.versionId === row.id);
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        startDate: row.startDate,
        releaseDate: row.releaseDate,
        released: row.released,
        archived: row.archived,
        issueCount: found?.total ?? 0,
        openCount: found?.open ?? 0,
      };
    });
  }

  private async rows(projectId: string): Promise<VersionRow[]> {
    return this.database.db
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.projectId, projectId))
      .orderBy(
        asc(projectVersions.released),
        asc(sql`coalesce(${projectVersions.releaseDate}, '9999-12-31')`),
        asc(projectVersions.createdAt),
      );
  }

  async list(principal: Principal, projectKey: string): Promise<Version[]> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'browse');
    return this.present(await this.rows(project.id));
  }

  private async administered(principal: Principal, projectKey: string, id?: string) {
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'administer');
    if (!id) return { project, version: null };
    const [version] = await this.database.db
      .select()
      .from(projectVersions)
      .where(and(eq(projectVersions.id, id), eq(projectVersions.projectId, project.id)));
    if (!version) throw new NotFoundException('Version not found');
    return { project, version };
  }

  private taken(error: unknown): never {
    if (isUniqueViolation(error)) throw new ConflictException('A version with this name exists');
    throw error;
  }

  async create(principal: Principal, projectKey: string, request: CreateVersionRequest) {
    const { project } = await this.administered(principal, projectKey);
    const id = uuidv7();
    try {
      await this.database.db
        .insert(projectVersions)
        .values({ id, projectId: project.id, ...request });
    } catch (error) {
      this.taken(error);
    }
    const [row] = await this.database.db
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.id, id));
    return (await this.present([row as VersionRow]))[0] as Version;
  }

  async update(
    principal: Principal,
    projectKey: string,
    id: string,
    request: UpdateVersionRequest,
  ) {
    await this.administered(principal, projectKey, id);
    try {
      await this.database.db
        .update(projectVersions)
        .set({
          ...request,
          ...(request.released === false ? { released: false } : {}),
        })
        .where(eq(projectVersions.id, id));
    } catch (error) {
      this.taken(error);
    }
    const [row] = await this.database.db
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.id, id));
    return (await this.present([row as VersionRow]))[0] as Version;
  }

  /** Only unused versions can be deleted; used ones are archived instead. */
  async delete(principal: Principal, projectKey: string, id: string): Promise<void> {
    await this.administered(principal, projectKey, id);
    const [used] = await this.database.db
      .select({ total: count() })
      .from(issueVersions)
      .where(eq(issueVersions.versionId, id));
    if ((used?.total ?? 0) > 0) {
      throw new ConflictException('Issues use this version; archive it instead');
    }
    await this.database.db.delete(projectVersions).where(eq(projectVersions.id, id));
  }

  /**
   * Marks a version released (T-REL-03). Open issues with it as fix version may move to
   * another unreleased version of the project; each moved issue gets a history entry.
   */
  async release(
    principal: Principal,
    projectKey: string,
    id: string,
    request: ReleaseVersionRequest,
  ): Promise<Version> {
    const { project, version } = await this.administered(principal, projectKey, id);
    if (!version) throw new NotFoundException('Version not found');
    let target: VersionRow | undefined;
    if (request.moveOpenTo) {
      [target] = await this.database.db
        .select()
        .from(projectVersions)
        .where(
          and(
            eq(projectVersions.id, request.moveOpenTo),
            eq(projectVersions.projectId, project.id),
          ),
        );
      if (!target || target.released || target.id === id) {
        throw new BadRequestException('Open issues can move to another unreleased version only');
      }
    }
    const done = await this.doneStatusIds();
    const today = new Date().toISOString().slice(0, 10);
    await this.database.db.transaction(async (tx) => {
      if (target) {
        const open = await tx
          .select({ issueId: issueVersions.issueId })
          .from(issueVersions)
          .innerJoin(issues, eq(issues.id, issueVersions.issueId))
          .where(
            and(
              eq(issueVersions.versionId, id),
              eq(issueVersions.kind, 'fix'),
              isNull(issues.deletedAt),
              done.length > 0 ? notInArray(issues.statusId, done) : undefined,
            ),
          );
        for (const { issueId } of open) {
          const before = await this.refsFor(tx, issueId, 'fix');
          await tx
            .delete(issueVersions)
            .where(
              and(
                eq(issueVersions.issueId, issueId),
                eq(issueVersions.versionId, id),
                eq(issueVersions.kind, 'fix'),
              ),
            );
          await tx
            .insert(issueVersions)
            .values({ issueId, versionId: target.id, kind: 'fix' })
            .onConflictDoNothing();
          const after = await this.refsFor(tx, issueId, 'fix');
          await recordChanges(tx, issueId, principal, [
            {
              field: VERSION_FIELD.fix,
              fromValue: before.map((entry) => entry.id).join(',') || null,
              toValue: after.map((entry) => entry.id).join(',') || null,
              fromDisplay: before.map((entry) => entry.name).join(', ') || null,
              toDisplay: after.map((entry) => entry.name).join(', ') || null,
            },
          ]);
        }
      }
      await tx
        .update(projectVersions)
        .set({ released: true, releaseDate: request.releaseDate ?? version.releaseDate ?? today })
        .where(eq(projectVersions.id, id));
      await emitProjectEvent(tx, principal.userId, {
        type: 'version.released',
        projectId: project.id,
        versionId: id,
        name: version.name,
      });
    });
    const [row] = await this.database.db
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.id, id));
    return (await this.present([row as VersionRow]))[0] as Version;
  }

  // ---------------------------------------------------------------- on issues

  async refsFor(db: Executor, issueId: string, kind: Kind): Promise<VersionRef[]> {
    return db
      .select({
        id: projectVersions.id,
        name: projectVersions.name,
        released: projectVersions.released,
      })
      .from(issueVersions)
      .innerJoin(projectVersions, eq(projectVersions.id, issueVersions.versionId))
      .where(and(eq(issueVersions.issueId, issueId), eq(issueVersions.kind, kind)))
      .orderBy(asc(sql`lower(${projectVersions.name})`));
  }

  /** Versions of many issues in one query, by issue id and kind. */
  async refsForMany(issueIds: string[]): Promise<Map<string, Record<Kind, VersionRef[]>>> {
    const result = new Map<string, Record<Kind, VersionRef[]>>();
    if (issueIds.length === 0) return result;
    const rows = await this.database.db
      .select({
        issueId: issueVersions.issueId,
        kind: issueVersions.kind,
        id: projectVersions.id,
        name: projectVersions.name,
        released: projectVersions.released,
      })
      .from(issueVersions)
      .innerJoin(projectVersions, eq(projectVersions.id, issueVersions.versionId))
      .where(inArray(issueVersions.issueId, issueIds))
      .orderBy(asc(sql`lower(${projectVersions.name})`));
    for (const { issueId, kind, ...ref } of rows) {
      const entry = result.get(issueId) ?? { fix: [], affects: [] };
      entry[kind].push(ref);
      result.set(issueId, entry);
    }
    return result;
  }

  /**
   * Versions by id or name within the project; archived ones only if the issue already has
   * them (`current`), so they stay but cannot be chosen anew.
   */
  async resolve(
    projectId: string,
    values: string[],
    current: VersionRef[] = [],
  ): Promise<VersionRef[]> {
    if (values.length === 0) return [];
    const rows = await this.rows(projectId);
    const found = new Map<string, VersionRef>();
    for (const value of values) {
      const wanted = value.toLowerCase();
      const row = rows.find(
        (entry) => (UUID.test(value) && entry.id === wanted) || entry.name.toLowerCase() === wanted,
      );
      if (!row)
        throw new BadRequestException(`The version "${value}" does not exist in this project`);
      if (row.archived && !current.some((entry) => entry.id === row.id)) {
        throw new BadRequestException(`The version "${row.name}" is archived`);
      }
      found.set(row.id, { id: row.id, name: row.name, released: row.released });
    }
    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async replaceOnIssue(tx: Executor, issueId: string, kind: Kind, versionIds: string[]) {
    await tx
      .delete(issueVersions)
      .where(and(eq(issueVersions.issueId, issueId), eq(issueVersions.kind, kind)));
    if (versionIds.length > 0) {
      await tx
        .insert(issueVersions)
        .values(versionIds.map((versionId) => ({ issueId, versionId, kind })));
    }
  }
}
