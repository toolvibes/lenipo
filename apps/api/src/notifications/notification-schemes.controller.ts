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
  Put,
} from '@nestjs/common';
import {
  CreateNotificationSchemeRequest,
  NotificationScheme,
  NotificationSchemeSummary,
  SetProjectPermissionSchemeRequest,
  UpdateNotificationSchemeRequest,
} from '@toolvibes/shared';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { NotificationSchemeService } from './notification-scheme.service.js';

const SchemeId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

/** Notification schemes for global administrators (P-NTF-03, TL-71, E-83). */
@RequireGlobal('admin')
@Controller()
export class NotificationSchemesController {
  constructor(
    @Inject(NotificationSchemeService) private readonly schemes: NotificationSchemeService,
  ) {}

  @Endpoint({
    tag: 'Administration',
    summary: 'List the notification schemes with the projects using them',
    response: z.array(NotificationSchemeSummary),
  })
  @Get('admin/notification-schemes')
  listNotificationSchemes(): Promise<NotificationSchemeSummary[]> {
    return this.schemes.list();
  }

  @Endpoint({
    tag: 'Administration',
    summary: 'Get a notification scheme with its rules',
    response: NotificationScheme,
  })
  @Get('admin/notification-schemes/:id')
  getNotificationScheme(@Param('id', SchemeId) id: string): Promise<NotificationScheme> {
    return this.schemes.get(id);
  }

  @Endpoint({
    tag: 'Administration',
    summary: 'Create a notification scheme as a copy of another (the default one if not given)',
    response: NotificationScheme,
  })
  @Post('admin/notification-schemes')
  @HttpCode(201)
  createNotificationScheme(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateNotificationSchemeRequest) body: CreateNotificationSchemeRequest,
  ): Promise<NotificationScheme> {
    return this.schemes.create(principal, body);
  }

  @Endpoint({
    tag: 'Administration',
    summary: 'Rename a notification scheme or replace its rules',
    response: NotificationScheme,
  })
  @Patch('admin/notification-schemes/:id')
  updateNotificationScheme(
    @CurrentPrincipal() principal: Principal,
    @Param('id', SchemeId) id: string,
    @ValidBody(UpdateNotificationSchemeRequest) body: UpdateNotificationSchemeRequest,
  ): Promise<NotificationScheme> {
    return this.schemes.update(principal, id, body);
  }

  @Endpoint({ tag: 'Administration', summary: 'Delete a notification scheme no project uses' })
  @Delete('admin/notification-schemes/:id')
  @HttpCode(204)
  deleteNotificationScheme(
    @CurrentPrincipal() principal: Principal,
    @Param('id', SchemeId) id: string,
  ): Promise<void> {
    return this.schemes.delete(principal, id);
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'Give the project a notification scheme; null for the default one',
    description: 'Requires the global permission `admin` (E-83).',
  })
  @Put('projects/:key/notification-scheme')
  @HttpCode(204)
  setNotificationScheme(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(SetProjectPermissionSchemeRequest) body: SetProjectPermissionSchemeRequest,
  ): Promise<void> {
    return this.schemes.assign(principal, key, body.schemeId);
  }
}
