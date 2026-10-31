import { Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { AccessCheckRequest, AccessCheckResult } from '@tasklore/shared';
import { RequireGlobal } from '../access/require-global.js';
import { ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import { RequireModule } from '../operations/operations.guard.js';
import { AccessCheckService } from './access-check.service.js';

/** "Why may X not do this?" for global administrators (TL-15, P-PRM-05, E-96). */
@RequireGlobal('admin')
@RequireModule('wiki')
@Controller('admin/access-check')
export class AccessCheckController {
  constructor(@Inject(AccessCheckService) private readonly checks: AccessCheckService) {}

  @Endpoint({
    tag: 'Administration',
    summary: 'Explain whether a person holds a permission on a project, issue, space or page',
    description:
      'The verdict and the facts behind it: roles, scheme grants, issue security, space roles and page restrictions.',
    response: AccessCheckResult,
  })
  @Post()
  @HttpCode(200)
  check(@ValidBody(AccessCheckRequest) body: AccessCheckRequest): Promise<AccessCheckResult> {
    return this.checks.check(body);
  }
}
