import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { auditLog } from '../db/schema/index.js';

export interface AuditEntry {
  action: string;
  actorId?: string | null;
  via?: string | null;
  targetType?: string;
  targetId?: string;
  ip?: string | null;
  details?: Record<string, unknown>;
}

/** Append-only record of security-relevant and administrative events. */
@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.database.db.insert(auditLog).values({
      action: entry.action,
      actorId: entry.actorId ?? null,
      via: entry.via ?? null,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      ip: entry.ip ?? null,
      details: entry.details ?? {},
    });
  }
}
