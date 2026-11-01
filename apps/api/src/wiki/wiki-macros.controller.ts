import { Controller, Get, Inject, Put } from '@nestjs/common';
import {
  EmbedHosts,
  LabelledPage,
  MacroPageQuery,
  PagePropertiesReport,
  WikiTask,
} from '@toolvibes/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { RequireModule } from '../operations/operations.guard.js';
import { WikiMacrosService } from './wiki-macros.service.js';

@RequireModule('wiki')
@Controller()
export class WikiMacrosController {
  constructor(@Inject(WikiMacrosService) private readonly macros: WikiMacrosService) {}

  @Endpoint({
    tag: 'Wiki',
    summary: 'Recently published pages, optionally of a space or with a label',
    response: z.array(LabelledPage),
  })
  @Get('wiki/recent-pages')
  recent(
    @CurrentPrincipal() principal: Principal,
    @ValidQuery(MacroPageQuery) query: MacroPageQuery,
  ): Promise<LabelledPage[]> {
    return this.macros.recent(principal, query);
  }

  @Endpoint({
    tag: 'Wiki',
    summary: 'Page properties of the pages with a label, as one table',
    response: PagePropertiesReport,
  })
  @Get('wiki/page-properties')
  properties(
    @CurrentPrincipal() principal: Principal,
    @ValidQuery(MacroPageQuery) query: MacroPageQuery,
  ): Promise<PagePropertiesReport> {
    return this.macros.properties(principal, query);
  }

  @Endpoint({
    tag: 'Wiki',
    summary: 'Open tasks of wiki pages with their mentioned people and due dates',
    response: z.array(WikiTask),
  })
  @Get('wiki/tasks')
  tasks(
    @CurrentPrincipal() principal: Principal,
    @ValidQuery(MacroPageQuery) query: MacroPageQuery,
  ): Promise<WikiTask[]> {
    return this.macros.tasks(principal, query);
  }

  @Endpoint({ tag: 'Wiki', summary: 'Hosts whose pages may be embedded', response: EmbedHosts })
  @Get('wiki/embed-hosts')
  embedHosts(): Promise<EmbedHosts> {
    return this.macros.embedHosts();
  }

  @Endpoint({ tag: 'Admin', summary: 'Change the embed allow-list', response: EmbedHosts })
  @Put('admin/embed-hosts')
  setEmbedHosts(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(EmbedHosts) body: EmbedHosts,
  ): Promise<EmbedHosts> {
    return this.macros.setEmbedHosts(principal, body);
  }
}
