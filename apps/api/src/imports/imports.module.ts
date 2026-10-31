import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { ImportService } from './import.service.js';
import { ImportsController } from './imports.controller.js';

@Module({
  imports: [IdentityModule, TrackingModule, BoardsModule, WikiModule],
  controllers: [ImportsController],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportsModule {}
