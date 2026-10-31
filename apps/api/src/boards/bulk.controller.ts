import { Controller, Delete, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { BulkRequest, BulkResult, CloneIssueRequest, Issue } from '@tasklore/shared';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { IssueService } from '../tracking/issue.service.js';
import { BulkService } from './bulk.service.js';

/** Bulk change, clone and delete (T-ISS-10, T-ISS-11, TL-16, E-97). */
@Controller('issues')
export class BulkController {
  constructor(
    @Inject(BulkService) private readonly bulk: BulkService,
    @Inject(IssueService) private readonly issues: IssueService,
  ) {}

  @Endpoint({
    tag: 'Issues',
    summary: 'Change many issues at once',
    description:
      'Edit, transition, move to a sprint, delete, watch or unwatch. Each issue goes through the same checks as a single change; the result lists which failed and why.',
    response: BulkResult,
  })
  @Post('bulk')
  @HttpCode(200)
  run(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(BulkRequest) body: BulkRequest,
  ): Promise<BulkResult> {
    return this.bulk.run(principal, body);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'Copy an issue',
    description:
      'Copies fields, custom fields and the security level, links the copy to the original ("clones"), and optionally the subtasks. Needs create-issues.',
    response: Issue,
  })
  @Post(':key/clone')
  clone(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(CloneIssueRequest) body: CloneIssueRequest,
  ): Promise<Issue> {
    return this.issues.clone(principal, key, body);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'Delete an issue with its subtasks',
    description: 'Needs the project permission `delete-issues`.',
  })
  @Delete(':key')
  @HttpCode(204)
  async remove(@CurrentPrincipal() principal: Principal, @Param('key') key: string): Promise<void> {
    await this.issues.deleteIssue(principal, key);
  }
}
