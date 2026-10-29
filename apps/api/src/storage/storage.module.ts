import { Global, Inject, Injectable, Module, type OnApplicationBootstrap } from '@nestjs/common';
import type { AppConfig } from '../core/config.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, FILE_STORE, LOGGER } from '../core/tokens.js';
import { createFileStore, type FileStore } from './file-store.js';

/** Prepares the directory or bucket once the application starts. */
@Injectable()
class FileStoreBootstrap implements OnApplicationBootstrap {
  constructor(
    @Inject(FILE_STORE) private readonly store: FileStore,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.store.init();
    this.logger.info({ driver: this.store.kind }, 'File storage ready');
  }
}

@Global()
@Module({
  providers: [
    {
      provide: FILE_STORE,
      inject: [CONFIG],
      useFactory: (config: AppConfig) => createFileStore(config),
    },
    FileStoreBootstrap,
  ],
  exports: [FILE_STORE],
})
export class StorageModule {}
