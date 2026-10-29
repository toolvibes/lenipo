import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { BoardsModule } from './boards/boards.module.js';
import type { AppConfig } from './core/config.js';
import { CoreModule } from './core/core.module.js';
import { ProblemFilter } from './core/http/problem.filter.js';
import type { Logger } from './core/logger.js';
import type { DatabaseHandle } from './db/client.js';
import { EventsModule } from './events/events.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { McpModule } from './mcp/mcp.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { OpenApiController } from './openapi/openapi.controller.js';
import { PersonalModule } from './personal/personal.module.js';
import { SearchModule } from './search/search.module.js';
import { StorageModule } from './storage/storage.module.js';
import { TrackingModule } from './tracking/tracking.module.js';

export interface AppDependencies {
  config: AppConfig;
  database: DatabaseHandle;
  logger: Logger;
}

@Module({})
export class AppModule {
  static forRoot({ config, database, logger }: AppDependencies): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.forRoot(config, database, logger),
        LoggerModule.forRoot({ pinoHttp: { logger } }),
        HealthModule,
        StorageModule,
        IdentityModule,
        TrackingModule,
        SearchModule,
        EventsModule,
        PersonalModule,
        BoardsModule,
        McpModule,
      ],
      controllers: [OpenApiController],
      providers: [{ provide: APP_FILTER, useValue: new ProblemFilter(logger) }],
    };
  }
}
