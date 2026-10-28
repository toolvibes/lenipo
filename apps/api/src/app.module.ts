import { type DynamicModule, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { AppConfig } from './core/config.js';
import { CoreModule } from './core/core.module.js';
import type { Logger } from './core/logger.js';
import type { DatabaseHandle } from './db/client.js';
import { HealthModule } from './modules/health/health.module.js';

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
        CoreModule.forRoot(config, database),
        LoggerModule.forRoot({ pinoHttp: { logger } }),
        HealthModule,
      ],
    };
  }
}
