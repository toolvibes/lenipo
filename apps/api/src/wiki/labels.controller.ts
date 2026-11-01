import { Controller, Get, Inject, Param } from '@nestjs/common';
import { LabelledPage } from '@toolvibes/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { RequireModule } from '../operations/operations.guard.js';
import { PageService } from './page.service.js';

const LabelQuery = z.object({ space: z.string().min(1).max(20).optional() });
type LabelQuery = z.infer<typeof LabelQuery>;

/** Pages by label across the wiki (W-PAG-08, E-65). */
@RequireModule('wiki')
@Controller('labels')
export class LabelsController {
  constructor(@Inject(PageService) private readonly pages: PageService) {}

  @Endpoint({
    tag: 'Pages',
    summary: 'List the pages with a label',
    description: 'In every space the caller can see, or only in `space`; sorted by title.',
    response: z.array(LabelledPage),
  })
  @Get(':label/pages')
  pagesWithLabel(
    @CurrentPrincipal() principal: Principal,
    @Param('label') label: string,
    @ValidQuery(LabelQuery) query: LabelQuery,
  ): Promise<LabelledPage[]> {
    return this.pages.labelledPages(principal, { label, spaceKey: query.space });
  }
}
