import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../../core/http/decorators.js';
import { Endpoint } from '../../core/http/endpoint.js';
import { DATABASE } from '../../core/tokens.js';
import type { DatabaseHandle } from '../../db/client.js';
import { SkipRateLimit } from '../../operations/operations.guard.js';

const HealthStatus = z
  .object({ status: z.enum(['ok', 'error']), database: z.enum(['ok', 'unreachable']).optional() })
  .meta({ id: 'HealthStatus' });

let draining = false;

/** From a shutdown signal on, readiness fails so load balancers stop sending requests (TL-42). */
export function markDraining(): void {
  draining = true;
}

@Public()
@SkipRateLimit()
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  /** Liveness: the process is up. */
  @Endpoint({ tag: 'Health', summary: 'Liveness: the process is running', response: HealthStatus })
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** Readiness: dependencies are reachable. */
  @Endpoint({
    tag: 'Health',
    summary: 'Readiness: the database is reachable',
    response: HealthStatus,
  })
  @Get('ready')
  async ready() {
    if (draining) throw new ServiceUnavailableException({ status: 'error', draining: true });
    try {
      await this.database.sql`select 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unreachable' });
    }
    return { status: 'ok', database: 'ok' };
  }
}
