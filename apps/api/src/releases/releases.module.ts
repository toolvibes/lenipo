import { Module } from '@nestjs/common';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { ReleaseService } from './release.service.js';
import { ReleasesController } from './releases.controller.js';

@Module({
  imports: [TrackingModule, WikiModule],
  controllers: [ReleasesController],
  providers: [ReleaseService],
  exports: [ReleaseService],
})
export class ReleasesModule {}
