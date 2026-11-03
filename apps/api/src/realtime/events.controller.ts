import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentPrincipal } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { NotificationService } from '../notifications/notification.service.js';
import { RealtimeService } from './realtime.service.js';

const KEEP_ALIVE_MS = 25_000;

/**
 * New notifications as Server-Sent Events (TL-95, E-147), for agents and other API clients that
 * cannot use the web app's socket: they wait for mentions and assignments instead of polling.
 */
@Controller('me')
export class EventsController {
  constructor(
    @Inject(NotificationService) private readonly notifications: NotificationService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
  ) {}

  @Endpoint({
    tag: 'Notifications',
    summary: 'Stream the caller’s new notifications (Server-Sent Events)',
    description:
      'Each notification comes as `event: notification` with the notification as JSON and its id as event id. After a broken connection, `Last-Event-ID` (or `?after=<id>`) sends what was missed. A comment line every 25 seconds keeps proxies from closing the stream.',
  })
  @Get('events')
  async events(
    @CurrentPrincipal() principal: Principal,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const resume = Number(request.headers['last-event-id'] ?? request.query.after);
    let last =
      Number.isInteger(resume) && resume >= 0
        ? resume
        : await this.notifications.latestId(principal.userId);
    response.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      // Proxies such as nginx would otherwise hold the events back.
      'x-accel-buffering': 'no',
    });
    response.flushHeaders();
    response.write(': lenipo events\n\n');
    let running: Promise<void> | null = null;
    let again = false;
    const flush = async () => {
      do {
        again = false;
        const { notifications } = await this.notifications.list(principal.userId, {
          unread: false,
          limit: 100,
          after: last,
        });
        for (const notification of notifications.reverse()) {
          response.write(
            `id: ${notification.id}\nevent: notification\ndata: ${JSON.stringify(notification)}\n\n`,
          );
          last = notification.id;
        }
      } while (again);
    };
    const wake = () => {
      if (running) {
        again = true;
        return;
      }
      running = flush()
        .catch(() => {
          response.end();
        })
        .finally(() => {
          running = null;
        });
    };
    const stop = this.realtime.onNotification(principal.userId, wake);
    const keepAlive = setInterval(() => response.write(': keep-alive\n\n'), KEEP_ALIVE_MS);
    request.on('close', () => {
      stop();
      clearInterval(keepAlive);
    });
    wake();
  }
}
