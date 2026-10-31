import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { ArchiveService } from './archive.service.js';
import { ImportService } from './import.service.js';
import { ArchivesController, ImportsController } from './imports.controller.js';

@Module({
  imports: [IdentityModule, TrackingModule, BoardsModule, WikiModule],
  controllers: [ImportsController, ArchivesController],
  providers: [ImportService, ArchiveService],
  exports: [ImportService],
})
export class ImportsModule {}
