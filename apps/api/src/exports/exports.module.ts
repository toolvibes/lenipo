import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { SearchModule } from '../search/search.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { ExportsController } from './exports.controller.js';
import { IssueExportService } from './issue-export.service.js';
import { PageExportService } from './page-export.service.js';

@Module({
  imports: [IdentityModule, TrackingModule, WikiModule, SearchModule],
  controllers: [ExportsController],
  providers: [PageExportService, IssueExportService],
})
export class ExportsModule {}
