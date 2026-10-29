import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  AddSpaceMemberRequest,
  CreatePageRequest,
  CreateSpaceRequest,
  Page,
  PageTreeEntry,
  Space,
  SpaceMember,
  SpaceSummary,
  TrashedPage,
  UpdateSpaceRequest,
  UserRef,
} from '@tasklore/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { PageService } from './page.service.js';
import { SpaceService } from './space.service.js';
import { SpaceAccessService } from './space-access.service.js';

const SpaceUsersQuery = z.object({
  query: z.string().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
type SpaceUsersQuery = z.infer<typeof SpaceUsersQuery>;

/** Unknown and malformed ids are both "not found". */
const MemberId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@Controller('spaces')
export class SpacesController {
  constructor(
    @Inject(SpaceService) private readonly spaces: SpaceService,
    @Inject(PageService) private readonly pages: PageService,
    @Inject(SpaceAccessService) private readonly spaceAccess: SpaceAccessService,
  ) {}

  @Endpoint({
    tag: 'Spaces',
    summary: 'Find people who can see a space',
    description: 'For @-mentions in page comments; needs no global `browse-users`.',
    response: z.array(UserRef),
  })
  @Get(':key/users')
  async users(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidQuery(SpaceUsersQuery) query: SpaceUsersQuery,
  ): Promise<UserRef[]> {
    const { space } = await this.spaces.find(principal, key);
    return this.spaceAccess.viewingUsers(space.id, query.query.trim(), query.limit);
  }

  @Endpoint({
    tag: 'Spaces',
    summary: 'List the spaces the caller can see',
    response: z.array(SpaceSummary),
  })
  @Get()
  list(@CurrentPrincipal() principal: Principal): Promise<SpaceSummary[]> {
    return this.spaces.list(principal);
  }

  @Endpoint({
    tag: 'Spaces',
    summary: 'Create a space',
    description:
      'Requires the global permission `create-spaces`. The creator administers the space; all signed-in users may edit it.',
    response: Space,
  })
  @Post()
  @HttpCode(201)
  create(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateSpaceRequest) body: CreateSpaceRequest,
  ): Promise<Space> {
    return this.spaces.create(principal, body);
  }

  @Endpoint({
    tag: 'Spaces',
    summary: 'Get a space with the caller’s permissions',
    response: Space,
  })
  @Get(':key')
  get(@CurrentPrincipal() principal: Principal, @Param('key') key: string): Promise<Space> {
    return this.spaces.get(principal, key);
  }

  @Endpoint({
    tag: 'Spaces',
    summary: 'Change a space’s name, description, home page or project',
    description:
      'Requires the space permission `administer`; linking or unlinking a project also requires `administer` on that project.',
    response: Space,
  })
  @Patch(':key')
  update(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(UpdateSpaceRequest) body: UpdateSpaceRequest,
  ): Promise<Space> {
    return this.spaces.update(principal, key, body);
  }

  @Endpoint({
    tag: 'Spaces',
    summary: 'List the role assignments of a space',
    description: 'Requires the space permission `administer`.',
    response: z.array(SpaceMember),
  })
  @Get(':key/members')
  members(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<SpaceMember[]> {
    return this.spaces.members(principal, key);
  }

  @Endpoint({
    tag: 'Spaces',
    summary: 'Give a user or group a role in a space',
    response: z.array(SpaceMember),
  })
  @Post(':key/members')
  @HttpCode(201)
  addMember(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(AddSpaceMemberRequest) body: AddSpaceMemberRequest,
  ): Promise<SpaceMember[]> {
    return this.spaces.addMember(principal, key, body);
  }

  @Endpoint({
    tag: 'Spaces',
    summary: 'Remove a role assignment; the last administrator stays',
  })
  @Delete(':key/members/:id')
  @HttpCode(204)
  removeMember(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('id', MemberId) id: string,
  ): Promise<void> {
    return this.spaces.removeMember(principal, key, id);
  }

  @Endpoint({
    tag: 'Spaces',
    summary: 'The space’s page tree in order',
    description:
      'A flat list in depth-first order; nest it by `parentId`. Drafts that were never published appear for editors only.',
    response: z.array(PageTreeEntry),
  })
  @Get(':key/pages')
  tree(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<PageTreeEntry[]> {
    return this.pages.tree(principal, key);
  }

  @Endpoint({
    tag: 'Spaces',
    summary: 'Create a page as a draft',
    description:
      'Requires the space permission `edit`. The page is visible to readers after its first publish.',
    response: Page,
  })
  @Post(':key/pages')
  @HttpCode(201)
  createPage(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(CreatePageRequest) body: CreatePageRequest,
  ): Promise<Page> {
    return this.pages.create(principal, key, body);
  }

  @Endpoint({
    tag: 'Spaces',
    summary: 'Pages in the space’s trash',
    description: 'Each entry was deleted on its own; pages below it come back with it.',
    response: z.array(TrashedPage),
  })
  @Get(':key/trash')
  trash(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<TrashedPage[]> {
    return this.pages.trash(principal, key);
  }
}
