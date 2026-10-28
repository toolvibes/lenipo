import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  issueTypes,
  priorities,
  resolutions,
  statuses,
  workflows,
  workflowVersions,
} from '../db/schema/index.js';
import {
  BUILT_IN_ISSUE_TYPES,
  BUILT_IN_PRIORITIES,
  BUILT_IN_RESOLUTIONS,
  BUILT_IN_STATUSES,
  BUILT_IN_WORKFLOWS,
  builtInId,
} from './builtins.js';

/** Creates the built-in issue types, statuses, priorities, resolutions and workflows if missing. */
@Injectable()
export class TrackingBootstrapService implements OnApplicationBootstrap {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      await tx
        .insert(issueTypes)
        .values(
          BUILT_IN_ISSUE_TYPES.map((type, position) => ({
            ...type,
            id: builtInId('issue-type', type.key),
            position,
            builtIn: true,
          })),
        )
        .onConflictDoNothing();
      await tx
        .insert(statuses)
        .values(
          BUILT_IN_STATUSES.map((entry) => ({
            ...entry,
            id: builtInId('status', entry.key),
            builtIn: true,
          })),
        )
        .onConflictDoNothing();
      await tx
        .insert(priorities)
        .values(
          BUILT_IN_PRIORITIES.map((entry) => ({ ...entry, id: builtInId('priority', entry.key) })),
        )
        .onConflictDoNothing();
      await tx
        .insert(resolutions)
        .values(
          BUILT_IN_RESOLUTIONS.map((entry) => ({
            ...entry,
            id: builtInId('resolution', entry.key),
          })),
        )
        .onConflictDoNothing();
      for (const workflow of BUILT_IN_WORKFLOWS) {
        const id = builtInId('workflow', workflow.key);
        await tx
          .insert(workflows)
          .values({ id, key: workflow.key, name: workflow.name, builtIn: true })
          .onConflictDoNothing();
        await tx
          .insert(workflowVersions)
          .values({
            id: builtInId('workflow-version', `${workflow.key}:1`),
            workflowId: id,
            version: 1,
            definition: workflow.definition,
          })
          .onConflictDoNothing();
      }
    });
  }
}
