import { Inject, Injectable } from '@nestjs/common';
import { AUTOMATION_ACTOR_ID, type GlobalPermission } from '@toolvibes/shared';
import { eq } from 'drizzle-orm';
import type { Principal } from '../core/http/principal.js';
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
    // The automation actor may do anything; each rule limits it to its projects (E-103).
    if (userId === AUTOMATION_ACTOR_ID) return true;
    const granted = await this.globalPermissions(userId);
    return granted.includes(permission) || granted.includes('system-admin');
  }

  /**
   * Administration in the caller's name: the permission, and for tokens also the `admin` scope,
   * as the route guard checks it (TL-44, E-125). OAuth tokens never carry that scope.
   */
  async isAdmin(principal: Principal): Promise<boolean> {
    if ('scopes' in principal && !principal.scopes.includes('admin')) return false;
    return this.hasGlobal(principal.userId, 'admin');
  }
}
