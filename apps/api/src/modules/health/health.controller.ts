import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { DATABASE } from '../../core/tokens.js';
import type { DatabaseHandle } from '../../db/client.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  /** Liveness: the process is up. */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** Readiness: dependencies are reachable. */
  @Get('ready')
  async ready() {
    try {
      await this.database.sql`select 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unreachable' });
    }
    return { status: 'ok', database: 'ok' };
  }
}
