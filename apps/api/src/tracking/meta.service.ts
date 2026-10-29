import { Inject, Injectable } from '@nestjs/common';
import type {
  IssueLinkTypeInfo,
  IssueTypeInfo,
  PriorityInfo,
  ResolutionInfo,
  StatusInfo,
  TrackingMeta,
} from '@tasklore/shared';
import { desc } from 'drizzle-orm';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  issueLinkTypes,
  issueTypes,
  priorities,
  resolutions,
  statuses,
} from '../db/schema/index.js';

const CACHE_MS = 30_000;

/** Stored metadata; the attachment limit comes from configuration instead. */
export interface MetaIndex extends Omit<TrackingMeta, 'attachmentMaxBytes'> {
  issueType: Map<string, IssueTypeInfo>;
  status: Map<string, StatusInfo>;
  priority: Map<string, PriorityInfo>;
  resolution: Map<string, ResolutionInfo>;
  linkType: Map<string, IssueLinkTypeInfo>;
}

/** Issue types, statuses, priorities, resolutions and link types: tiny, rarely changing, cached briefly. */
@Injectable()
export class MetaService {
  private cached: { at: number; value: Promise<MetaIndex> } | undefined;

  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  load(): Promise<MetaIndex> {
    if (!this.cached || Date.now() - this.cached.at > CACHE_MS) {
      this.cached = { at: Date.now(), value: this.read() };
      this.cached.value.catch(() => {
        this.cached = undefined;
      });
    }
    return this.cached.value;
  }

  private async read(): Promise<MetaIndex> {
    const db = this.database.db;
    const [types, statusRows, priorityRows, resolutionRows, linkTypeRows] = await Promise.all([
      db
        .select()
        .from(issueTypes)
        .orderBy(desc(issueTypes.hierarchyLevel), issueTypes.position, issueTypes.name),
      db.select().from(statuses),
      db.select().from(priorities).orderBy(priorities.sequence),
      db.select().from(resolutions),
      db.select().from(issueLinkTypes).orderBy(issueLinkTypes.name),
    ]);
    const meta: Omit<TrackingMeta, 'attachmentMaxBytes'> = {
      issueTypes: types.map(({ id, key, name, icon, hierarchyLevel }) => ({
        id,
        key,
        name,
        icon,
        hierarchyLevel,
      })),
      statuses: statusRows.map(({ id, key, name, category }) => ({ id, key, name, category })),
      priorities: priorityRows.map(({ id, key, name, icon, sequence }) => ({
        id,
        key,
        name,
        icon,
        sequence,
      })),
      resolutions: resolutionRows.map(({ id, key, name }) => ({ id, key, name })),
      linkTypes: linkTypeRows.map(({ id, key, name, outward, inward }) => ({
        id,
        key,
        name,
        outward,
        inward,
      })),
    };
    return {
      ...meta,
      issueType: new Map(meta.issueTypes.map((entry) => [entry.id, entry])),
      status: new Map(meta.statuses.map((entry) => [entry.id, entry])),
      priority: new Map(meta.priorities.map((entry) => [entry.id, entry])),
      resolution: new Map(meta.resolutions.map((entry) => [entry.id, entry])),
      linkType: new Map(meta.linkTypes.map((entry) => [entry.id, entry])),
    };
  }
}
