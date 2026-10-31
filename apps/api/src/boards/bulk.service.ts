import { BadRequestException, HttpException, Inject, Injectable } from '@nestjs/common';
import type { BulkRequest, BulkResult } from '@tasklore/shared';
import type { Principal } from '../core/http/principal.js';
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
  ) {}

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
      case 'watch':
      case 'unwatch':
        await this.issues.setWatching(principal, key, action.type === 'watch');
        return;
    }
  }
}
