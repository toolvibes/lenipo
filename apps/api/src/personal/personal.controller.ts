import { Controller, Delete, Get, HttpCode, Inject, Param, Post, Put } from '@nestjs/common';
import {
  ActivityPage,
  ActivityQuery,
  Favourite,
  FavouriteKind,
  RecentItem,
  RecordRecentRequest,
} from '@tasklore/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { ActivityService } from './activity.service.js';
import { PersonalService } from './personal.service.js';

const RecentQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) });
type RecentQuery = z.infer<typeof RecentQuery>;

@Controller()
export class PersonalController {
  constructor(
    @Inject(PersonalService) private readonly personal: PersonalService,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  @Endpoint({
    tag: 'Personal',
    summary: 'List the caller’s favourites',
    description: 'Projects and saved filters; items the caller can no longer see are left out.',
    response: z.array(Favourite),
  })
  @Get('me/favourites')
  favourites(@CurrentPrincipal() principal: Principal): Promise<Favourite[]> {
    return this.personal.favourites(principal);
  }

  @Endpoint({
    tag: 'Personal',
    summary: 'Star a project (key) or saved filter (id)',
  })
  @Put('me/favourites/:kind/:ref')
  @HttpCode(204)
  star(
    @CurrentPrincipal() principal: Principal,
    @Param('kind') kind: string,
    @Param('ref') ref: string,
  ): Promise<void> {
    return this.personal.setFavourite(principal, FavouriteKind.parse(kind), ref, true);
  }

  @Endpoint({ tag: 'Personal', summary: 'Remove a favourite' })
  @Delete('me/favourites/:kind/:ref')
  @HttpCode(204)
  unstar(
    @CurrentPrincipal() principal: Principal,
    @Param('kind') kind: string,
    @Param('ref') ref: string,
  ): Promise<void> {
    return this.personal.setFavourite(principal, FavouriteKind.parse(kind), ref, false);
  }

  @Endpoint({
    tag: 'Personal',
    summary: 'Remember that the caller opened an issue or project',
    description: 'Sent by the web app when a page opens; scripts normally do not call it (E-46).',
  })
  @Post('me/recent')
  @HttpCode(204)
  record(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(RecordRecentRequest) body: RecordRecentRequest,
  ): Promise<void> {
    return this.personal.recordView(principal, body.kind, body.ref);
  }

  @Endpoint({
    tag: 'Personal',
    summary: 'List recently opened issues and projects, newest first',
    response: z.array(RecentItem),
  })
  @Get('me/recent')
  recent(
    @CurrentPrincipal() principal: Principal,
    @ValidQuery(RecentQuery) query: RecentQuery,
  ): Promise<RecentItem[]> {
    return this.personal.recent(principal, query.limit);
  }

  @Endpoint({
    tag: 'Personal',
    summary: 'Activity stream: new issues, changes and comments, newest first',
    description: 'Optionally for one project or one person; page with `before` = `next`.',
    response: ActivityPage,
  })
  @Get('activity')
  stream(
    @CurrentPrincipal() principal: Principal,
    @ValidQuery(ActivityQuery) query: ActivityQuery,
  ): Promise<ActivityPage> {
    return this.activity.stream(principal, query);
  }
}
