import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { ProjectPagesService } from './project-pages.service.js';
import { ReleaseService } from './release.service.js';
import { ProjectWikiPagesController, ReleasesController } from './releases.controller.js';

@Module({
  imports: [TrackingModule, WikiModule, BoardsModule],
  controllers: [ReleasesController, ProjectWikiPagesController],
  providers: [ReleaseService, ProjectPagesService],
  exports: [ReleaseService, ProjectPagesService],
})
export class ReleasesModule {}
