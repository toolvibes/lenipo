import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SPACE_PERMISSIONS, type SpacePermission, type SpaceRole } from '@tasklore/shared';
import { and, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';
import { AccessService } from '../access/access.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { groupMembers, pages, spaceRoleMembers, spaces } from '../db/schema/index.js';

/** What each space role may do (W-SPC-03, E-59). */
const ROLE_PERMISSIONS: Record<SpaceRole, readonly SpacePermission[]> = {
  administrators: SPACE_PERMISSIONS,
  editors: ['view', 'comment', 'edit'],
  commenters: ['view', 'comment'],
  viewers: ['view'],
};

/** Space-level permission checks; every wiki route and the collab service go through here. */
@Injectable()
export class SpaceAccessService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  /** Role assignments that apply to a user: directly or through one of their groups. */
  private memberCondition(userId: string): SQL {
    const userGroups = this.database.db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userId));
    return or(
      eq(spaceRoleMembers.userId, userId),
      inArray(spaceRoleMembers.groupId, userGroups),
    ) as SQL;
  }

  async permissions(userId: string, spaceId: string): Promise<Set<SpacePermission>> {
    if (await this.access.hasGlobal(userId, 'admin')) return new Set(SPACE_PERMISSIONS);
    const rows = await this.database.db
      .selectDistinct({ role: spaceRoleMembers.role })
      .from(spaceRoleMembers)
      .where(and(eq(spaceRoleMembers.spaceId, spaceId), this.memberCondition(userId)));
    return new Set(rows.flatMap((row) => ROLE_PERMISSIONS[row.role]));
  }

  /** SQL condition limiting `spaces` to those the user may view. */
  async viewableCondition(userId: string): Promise<SQL> {
    if (await this.access.hasGlobal(userId, 'admin')) return isNull(spaces.archivedAt);
    const memberships = this.database.db
      .selectDistinct({ spaceId: spaceRoleMembers.spaceId })
      .from(spaceRoleMembers)
      .where(this.memberCondition(userId));
    return and(isNull(spaces.archivedAt), inArray(spaces.id, memberships)) as SQL;
  }

  /**
   * May the user work on the page's live draft? The page must exist outside the trash, in a
   * space that is not archived, and the user needs `edit` there (E-59). Used by the collab
   * service on connect and again while connected.
   */
  async canEditPage(userId: string, pageId: string): Promise<boolean> {
    const [page] = await this.database.db
      .select({ spaceId: pages.spaceId })
      .from(pages)
      .innerJoin(spaces, eq(spaces.id, pages.spaceId))
      .where(and(eq(pages.id, pageId), isNull(pages.deletedAt), isNull(spaces.archivedAt)));
    if (!page) return false;
    return (await this.permissions(userId, page.spaceId)).has('edit');
  }

  /**
   * Throws unless the principal holds the permission. Missing view access looks like a
   * missing space (404), so space existence does not leak.
   */
  async require(
    principal: Principal,
    spaceId: string,
    permission: SpacePermission,
  ): Promise<Set<SpacePermission>> {
    if ('scopes' in principal) {
      const needed = permission === 'view' ? ['wiki:read', 'wiki:write'] : ['wiki:write'];
      if (!principal.scopes.some((scope) => needed.includes(scope))) {
        throw new ForbiddenException(`This token lacks the ${needed.at(-1)} scope`);
      }
    }
    const granted = await this.permissions(principal.userId, spaceId);
    if (!granted.has('view')) throw new NotFoundException('Space not found');
    if (!granted.has(permission)) {
      throw new ForbiddenException(`Requires the space permission "${permission}"`);
    }
    return granted;
  }
}
