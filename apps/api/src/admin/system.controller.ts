import { Controller, Get, Inject } from '@nestjs/common';
import { AUTOMATION_ACTOR_ID, SystemInfo } from '@toolvibes/shared';
import { count, ne } from 'drizzle-orm';
import { RequireGlobal } from '../access/require-global.js';
import { type AppConfig, oidcEnabled } from '../core/config.js';
import { Endpoint } from '../core/http/endpoint.js';
import { CONFIG, DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { users } from '../db/schema/index.js';
import { API_VERSION } from '../openapi/version.js';

const STARTED_AT = new Date();

@RequireGlobal('admin')
@Controller('admin/system')
export class SystemController {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(DATABASE) private readonly database: DatabaseHandle,
  ) {}

  @Endpoint({
    tag: 'Admin',
    summary: 'Show version, runtime and database information',
    response: SystemInfo,
  })
  @Get()
  async info(): Promise<SystemInfo> {
    const [postgres] = await this.database.sql<{ server_version: string }[]>`show server_version`;
    const [migrations] = await this.database.sql<{ applied: number }[]>`
      select count(*)::int as applied from drizzle.__drizzle_migrations`;
    // The automation actor is not a person (E-103).
    const [userCount] = await this.database.db
      .select({ total: count() })
      .from(users)
      .where(ne(users.id, AUTOMATION_ACTOR_ID));
    return {
      version: API_VERSION,
      mode: this.config.MODE,
      startedAt: STARTED_AT.toISOString(),
      uptimeSeconds: Math.round((Date.now() - STARTED_AT.getTime()) / 1000),
      nodeVersion: process.version,
      postgresVersion: postgres?.server_version ?? 'unknown',
      migrationsApplied: migrations?.applied ?? 0,
      users: userCount?.total ?? 0,
      oidcEnabled: oidcEnabled(this.config),
    };
  }
}
