import { Controller, Get, HttpCode, Inject, Post, Put } from '@nestjs/common';
import {
  MarkNotificationsRead,
  NotificationList,
  NotificationListQuery,
  NotificationSettings,
  UnreadCount,
  UpdateNotificationSettings,
} from '@tasklore/shared';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { NotificationService } from './notification.service.js';

@Controller('me')
export class NotificationsController {
  constructor(@Inject(NotificationService) private readonly notifications: NotificationService) {}

  @Endpoint({
    tag: 'Notifications',
    summary: 'List the caller’s notifications, newest first',
    response: NotificationList,
  })
  @Get('notifications')
  list(
    @CurrentPrincipal() principal: Principal,
    @ValidQuery(NotificationListQuery) query: NotificationListQuery,
  ): Promise<NotificationList> {
    return this.notifications.list(principal.userId, query);
  }

  @Endpoint({
    tag: 'Notifications',
    summary: 'Count unread notifications',
    description: 'Cheap enough to poll; the web app asks every 30 seconds and on focus (E-44).',
    response: UnreadCount,
  })
  @Get('notifications/unread-count')
  async unread(@CurrentPrincipal() principal: Principal): Promise<UnreadCount> {
    return { count: await this.notifications.unreadCount(principal.userId) };
  }

  @Endpoint({ tag: 'Notifications', summary: 'Mark notifications as read' })
  @Post('notifications/read')
  @HttpCode(204)
  read(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(MarkNotificationsRead) body: MarkNotificationsRead,
  ): Promise<void> {
    return this.notifications.markRead(principal.userId, body.ids, body.all);
  }

  @Endpoint({
    tag: 'Notifications',
    summary: 'Get the caller’s notification settings',
    response: NotificationSettings,
  })
  @Get('notification-settings')
  settings(@CurrentPrincipal() principal: Principal): Promise<NotificationSettings> {
    return this.notifications.settings(principal.userId);
  }

  @Endpoint({
    tag: 'Notifications',
    summary: 'Change the caller’s notification settings',
    response: NotificationSettings,
  })
  @Put('notification-settings')
  updateSettings(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(UpdateNotificationSettings) body: UpdateNotificationSettings,
  ): Promise<NotificationSettings> {
    return this.notifications.updateSettings(principal.userId, body);
  }
}
