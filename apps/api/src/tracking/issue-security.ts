import { AUTOMATION_ACTOR_ID } from '@tasklore/shared';
import { type SQL, sql } from 'drizzle-orm';
import {
  groupMembers,
  issues,
  projectRoleMembers,
  securityLevelGrants,
} from '../db/schema/index.js';

/**
 * Issues the user may see under issue security (TL-13, E-94): issues without a level, and those
 * whose level grants the user directly, through a group, a project role, or as reporter or
 * assignee. Browse rights on the project are checked separately; nobody bypasses a level.
 */
export function securityVisible(userId: string): SQL {
  // Rules act on every issue of their projects (TL-22, E-103).
  if (userId === AUTOMATION_ACTOR_ID) return sql`true`;
  const groupsOfUser = sql`(select ${groupMembers.groupId} from ${groupMembers} where ${groupMembers.userId} = ${userId})`;
  // Only uncorrelated subqueries: PostgreSQL runs each once and hashes it, instead of once per
  // issue. A correlated EXISTS cost 26 µs per row, 26 s for a million issues (TL-44, E-125).
  return sql`(${issues.securityLevelId} is null
    or ${issues.securityLevelId} in (
      select ${securityLevelGrants.levelId} from ${securityLevelGrants}
      where (${securityLevelGrants.grantee} = 'user' and ${securityLevelGrants.userId} = ${userId})
        or (${securityLevelGrants.grantee} = 'group' and ${securityLevelGrants.groupId} in ${groupsOfUser}))
    or (${issues.reporterId} = ${userId} and ${issues.securityLevelId} in (
      select ${securityLevelGrants.levelId} from ${securityLevelGrants}
      where ${securityLevelGrants.grantee} = 'reporter'))
    or (${issues.assigneeId} = ${userId} and ${issues.securityLevelId} in (
      select ${securityLevelGrants.levelId} from ${securityLevelGrants}
      where ${securityLevelGrants.grantee} = 'assignee'))
    or (${issues.securityLevelId}, ${issues.projectId}) in (
      select ${securityLevelGrants.levelId}, ${projectRoleMembers.projectId}
      from ${securityLevelGrants}
      join ${projectRoleMembers} on ${projectRoleMembers.role} = ${securityLevelGrants.role}
      where ${securityLevelGrants.grantee} = 'role'
        and (${projectRoleMembers.userId} = ${userId} or ${projectRoleMembers.groupId} in ${groupsOfUser})))`;
}
