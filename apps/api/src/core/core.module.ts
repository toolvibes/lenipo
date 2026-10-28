import { type DynamicModule, Global, Module } from '@nestjs/common';
import type { DatabaseHandle } from '../db/client.js';
import type { AppConfig } from './config.js';
import { CONFIG, DATABASE } from './tokens.js';

@Global()
@Module({})
export class CoreModule {
  static forRoot(config: AppConfig, database: DatabaseHandle): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: DATABASE, useValue: database },
      ],
      exports: [CONFIG, DATABASE],
    };
  }
}
