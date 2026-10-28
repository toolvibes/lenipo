import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  AddGroupMemberRequest,
  CreateGroupRequest,
  CreateUserRequest,
  GroupSummary,
  UserSummary,
} from '@tasklore/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { AuditService } from '../audit/audit.service.js';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { GroupService } from './group.service.js';
import { PasswordService } from './password.service.js';
import { clientOf } from './request-guards.js';
import { UserService } from './user.service.js';

@RequireGlobal('admin')
@Controller('admin')
export class AdminController {
  constructor(
    @Inject(UserService) private readonly users: UserService,
    @Inject(GroupService) private readonly groups: GroupService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Endpoint({ tag: 'Admin', summary: 'List all users', response: z.array(UserSummary) })
  @Get('users')
  listUsers(): Promise<UserSummary[]> {
    return this.users.list();
  }

  @Endpoint({ tag: 'Admin', summary: 'Create a local user', response: UserSummary })
  @Post('users')
  @HttpCode(201)
  async createUser(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateUserRequest) body: CreateUserRequest,
    @Req() request: Request,
  ): Promise<UserSummary> {
    const id = await this.users.create({
      email: body.email,
      displayName: body.displayName,
      passwordHash: await this.passwords.hash(body.password),
      groupNames: [...new Set(['users', ...body.groups])],
    });
    await this.audit.record({
      action: 'user.created',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'user',
      targetId: id,
      ip: clientOf(request).ip,
      details: { email: body.email },
    });
    const created = (await this.users.list()).find((user) => user.id === id);
    if (!created) throw new NotFoundException('User not found after creation');
    return created;
  }

  @Endpoint({
    tag: 'Admin',
    summary: 'List all groups with their global permissions',
    response: z.array(GroupSummary),
  })
  @Get('groups')
  listGroups(): Promise<GroupSummary[]> {
    return this.groups.list();
  }

  @Endpoint({ tag: 'Admin', summary: 'Create a group', response: GroupSummary })
  @Post('groups')
  @HttpCode(201)
  async createGroup(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateGroupRequest) body: CreateGroupRequest,
    @Req() request: Request,
  ): Promise<GroupSummary> {
    const group = await this.groups.create(body);
    await this.audit.record({
      action: 'group.created',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'group',
      targetId: group.id,
      ip: clientOf(request).ip,
      details: { name: group.name, globalPermissions: group.globalPermissions },
    });
    return group;
  }

  @Endpoint({ tag: 'Admin', summary: 'Add a user to a group' })
  @Post('groups/:name/members')
  @HttpCode(204)
  async addMember(
    @CurrentPrincipal() principal: Principal,
    @Param('name') name: string,
    @ValidBody(AddGroupMemberRequest) body: AddGroupMemberRequest,
    @Req() request: Request,
  ): Promise<void> {
    await this.groups.addMember(name, body.userId);
    await this.audit.record({
      action: 'group.member_added',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'group',
      targetId: name,
      ip: clientOf(request).ip,
      details: { userId: body.userId },
    });
  }

  @Endpoint({ tag: 'Admin', summary: 'Remove a user from a group' })
  @Delete('groups/:name/members/:userId')
  @HttpCode(204)
  async removeMember(
    @CurrentPrincipal() principal: Principal,
    @Param('name') name: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() request: Request,
  ): Promise<void> {
    if (!(await this.groups.removeMember(name, userId))) {
      throw new NotFoundException('User is not a member of this group');
    }
    await this.audit.record({
      action: 'group.member_removed',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'group',
      targetId: name,
      ip: clientOf(request).ip,
      details: { userId },
    });
  }
}
