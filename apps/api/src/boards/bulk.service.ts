import { BadRequestException, HttpException, Inject, Injectable } from '@nestjs/common';
import type {
  BulkCreateRequest,
  BulkItemsResult,
  BulkRequest,
  BulkResult,
  BulkUpdateRequest,
} from '@tasklore/shared';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { IssueService } from '../tracking/issue.service.js';
import { SprintService } from './sprint.service.js';

/**
 * Bulk change (T-ISS-11, TL-16, E-97): each issue on its own, through the same checks as a
 * single change; one failure does not stop the others, and the result says which went wrong.
 */
@Injectable()
export class BulkService {
  constructor(
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(SprintService) private readonly sprints: SprintService,
    @Inject(DATABASE) private readonly database: DatabaseHandle,
  ) {}

  /**
   * Items one by one (D-API-10, TL-41, E-122); with `atomic`, in one transaction that is rolled
   * back at the first failure, and every item reports it.
   */
  private async items(
    count: number,
    atomic: boolean,
    work: (index: number) => Promise<string>,
  ): Promise<BulkItemsResult> {
    const message = (error: unknown) =>
      error instanceof HttpException || error instanceof Error ? error.message : String(error);
    const results: BulkItemsResult['results'] = [];
    if (atomic) {
      let failed: { index: number; error: string } | null = null;
      const keys: string[] = [];
      try {
        await this.database.atomic(async () => {
          for (let index = 0; index < count; index += 1) {
            try {
              keys.push(await work(index));
            } catch (error) {
              failed = { index, error: message(error) };
              throw error;
            }
          }
        });
      } catch (error) {
        failed ??= { index: -1, error: message(error) };
      }
      for (let index = 0; index < count; index += 1) {
        if (!failed) results.push({ index, ok: true, key: keys[index] ?? null, error: null });
        else
          results.push({
            index,
            ok: false,
            key: null,
            error:
              index === failed.index
                ? failed.error
                : `Not done: item ${failed.index + 1} failed (${failed.error})`,
          });
      }
      return { results };
    }
    for (let index = 0; index < count; index += 1) {
      try {
        results.push({ index, ok: true, key: await work(index), error: null });
      } catch (error) {
        results.push({ index, ok: false, key: null, error: message(error) });
      }
    }
    return { results };
  }

  create(principal: Principal, request: BulkCreateRequest): Promise<BulkItemsResult> {
    return this.items(request.issues.length, request.atomic, async (index) => {
      const issue = await this.issues.create(principal, request.issues[index] as never);
      return issue.key;
    });
  }

  update(principal: Principal, request: BulkUpdateRequest): Promise<BulkItemsResult> {
    return this.items(request.updates.length, request.atomic, async (index) => {
      const { key, fields } = request.updates[index] as BulkUpdateRequest['updates'][number];
      const issue = await this.issues.update(principal, key.toUpperCase(), fields);
      return issue.key;
    });
  }

  async run(principal: Principal, request: BulkRequest): Promise<BulkResult> {
    const results: BulkResult['results'] = [];
    for (const key of [...new Set(request.issueKeys.map((entry) => entry.toUpperCase()))]) {
      try {
        await this.apply(principal, key, request.action);
        results.push({ key, ok: true, error: null });
      } catch (error) {
        const message =
          error instanceof HttpException || error instanceof Error ? error.message : String(error);
        results.push({ key, ok: false, error: message });
      }
    }
    return { results };
  }

  private async apply(principal: Principal, key: string, action: BulkRequest['action']) {
    switch (action.type) {
      case 'edit': {
        const patch: Parameters<IssueService['update']>[2] = {};
        if (action.assigneeId !== undefined) patch.assigneeId = action.assigneeId;
        if (action.priority) patch.priority = action.priority;
        if (action.addLabels.length > 0 || action.removeLabels.length > 0) {
          const current = await this.issues.get(principal, key);
          patch.labels = [...new Set([...current.labels, ...action.addLabels])].filter(
            (label) => !action.removeLabels.includes(label),
          );
        }
        if (Object.keys(patch).length === 0) throw new BadRequestException('Nothing to change');
        await this.issues.update(principal, key, patch);
        return;
      }
      case 'transition': {
        // Workflows differ per issue type: each issue takes its own way into the status.
        const offered = await this.issues.transitions(principal, key);
        const transition = offered.find((entry) => entry.to.id === action.statusId);
        if (!transition) throw new BadRequestException('No transition into this status');
        await this.issues.transition(principal, key, {
          transitionId: transition.id,
          ...(action.resolution ? { resolution: action.resolution } : {}),
        });
        return;
      }
      case 'sprint':
        await this.sprints.moveIssues(principal, [key], action.sprintId);
        return;
      case 'delete':
        await this.issues.deleteIssue(principal, key);
        return;
      case 'move':
        await this.issues.move(principal, key, {
          projectKey: action.projectKey,
          ...(action.issueType ? { issueType: action.issueType } : {}),
          ...(action.statusId ? { statusId: action.statusId } : {}),
        });
        return;
      case 'watch':
      case 'unwatch':
        await this.issues.setWatching(principal, key, action.type === 'watch');
        return;
    }
  }
}
