import { Controller, Delete, HttpCode, Inject, Param, Post } from '@nestjs/common';
import {
  BulkCreateRequest,
  BulkItemsResult,
  BulkRequest,
  BulkResult,
  BulkUpdateRequest,
  CloneIssueRequest,
  Issue,
  MoveIssueRequest,
} from '@tasklore/shared';
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
    summary: 'Create up to 100 issues',
    description:
      'Each issue goes through the same checks as POST /issues. The result has one line per issue in the order sent. With "atomic": true they are created in one transaction: all or none.',
    response: BulkItemsResult,
  })
  @Post('bulk-create')
  @HttpCode(200)
  bulkCreate(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(BulkCreateRequest) body: BulkCreateRequest,
  ): Promise<BulkItemsResult> {
    return this.bulk.create(principal, body);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'Change up to 100 issues, each in its own way',
    description:
      'Each change goes through the same checks as PATCH /issues/{key}. With "atomic": true all or none are made.',
    response: BulkItemsResult,
  })
  @Post('bulk-update')
  @HttpCode(200)
  bulkUpdate(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(BulkUpdateRequest) body: BulkUpdateRequest,
  ): Promise<BulkItemsResult> {
    return this.bulk.update(principal, body);
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
    summary: 'Move an issue with its subtasks to another project',
    description:
      'New keys, the old ones keep working. Type and status are kept where the target allows, else mapped (same category, else initial); components and versions by name; security level kept or the target default. Needs edit-issues in the source and create-issues in the target.',
    response: Issue,
  })
  @Post(':key/move')
  @HttpCode(200)
  move(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(MoveIssueRequest) body: MoveIssueRequest,
  ): Promise<Issue> {
    return this.issues.move(principal, key, body);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'Restore an issue from the trash',
    description: 'Brings back the subtasks deleted with it too. Needs delete-issues.',
    response: Issue,
  })
  @Post(':key/restore')
  @HttpCode(200)
  restore(@CurrentPrincipal() principal: Principal, @Param('key') key: string): Promise<Issue> {
    return this.issues.restore(principal, key);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'Delete an issue with its subtasks',
    description:
      'Moves it to the project trash, where it can be restored until retention removes it. Needs the project permission `delete-issues`.',
  })
  @Delete(':key')
  @HttpCode(204)
  async remove(@CurrentPrincipal() principal: Principal, @Param('key') key: string): Promise<void> {
    await this.issues.deleteIssue(principal, key);
  }
}
