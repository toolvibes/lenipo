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
  const groupsOfUser = sql`(select ${groupMembers.groupId} from ${groupMembers} where ${groupMembers.userId} = ${userId})`;
  return sql`(${issues.securityLevelId} is null or exists (
    select 1 from ${securityLevelGrants}
    where ${securityLevelGrants.levelId} = ${issues.securityLevelId} and (
      (${securityLevelGrants.grantee} = 'user' and ${securityLevelGrants.userId} = ${userId})
      or (${securityLevelGrants.grantee} = 'reporter' and ${issues.reporterId} = ${userId})
      or (${securityLevelGrants.grantee} = 'assignee' and ${issues.assigneeId} = ${userId})
      or (${securityLevelGrants.grantee} = 'group' and ${securityLevelGrants.groupId} in ${groupsOfUser})
      or (${securityLevelGrants.grantee} = 'role' and exists (
        select 1 from ${projectRoleMembers}
        where ${projectRoleMembers.projectId} = ${issues.projectId}
          and ${projectRoleMembers.role} = ${securityLevelGrants.role}
          and (${projectRoleMembers.userId} = ${userId} or ${projectRoleMembers.groupId} in ${groupsOfUser})
      ))
    )
  ))`;
}
