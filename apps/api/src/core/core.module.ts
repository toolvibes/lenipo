import { type DynamicModule, Global, Module } from '@nestjs/common';
import type { DatabaseHandle } from '../db/client.js';
import type { AppConfig } from './config.js';
import type { Logger } from './logger.js';
import { CONFIG, DATABASE, LOGGER } from './tokens.js';

@Global()
@Module({})
export class CoreModule {
  static forRoot(config: AppConfig, database: DatabaseHandle, logger: Logger): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: DATABASE, useValue: database },
        { provide: LOGGER, useValue: logger },
      ],
      exports: [CONFIG, DATABASE, LOGGER],
    };
  }
}
