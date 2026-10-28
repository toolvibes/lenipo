import { Inject, Injectable } from '@nestjs/common';
import type { GlobalPermission } from '@tasklore/shared';
import { eq } from 'drizzle-orm';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import { globalPermissionGrants, groupMembers } from '../db/schema/index.js';

/**
 * The single place that answers "may this user do that?". UI, API, MCP, search and
 * notifications all ask here; nothing decides permissions on its own.
 */
@Injectable()
export class AccessService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async globalPermissions(
    userId: string,
    db: Executor = this.database.db,
  ): Promise<GlobalPermission[]> {
    const rows = await db
      .selectDistinct({ permission: globalPermissionGrants.permission })
      .from(globalPermissionGrants)
      .innerJoin(groupMembers, eq(groupMembers.groupId, globalPermissionGrants.groupId))
      .where(eq(groupMembers.userId, userId));
    return rows.map((row) => row.permission as GlobalPermission).sort();
  }

  /** System administrators hold every global permission implicitly. */
  async hasGlobal(userId: string, permission: GlobalPermission): Promise<boolean> {
    const granted = await this.globalPermissions(userId);
    return granted.includes(permission) || granted.includes('system-admin');
  }
}
