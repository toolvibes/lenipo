import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SearchModule } from '../search/search.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { BoardService } from './board.service.js';
import { BoardsController } from './boards.controller.js';
import { BulkController } from './bulk.controller.js';
import { BulkService } from './bulk.service.js';
import { ReportService } from './report.service.js';
import { SprintService } from './sprint.service.js';
import { SprintApprovalService } from './sprint-approval.service.js';
import { SprintsController } from './sprints.controller.js';

@Module({
  imports: [IdentityModule, TrackingModule, SearchModule, NotificationsModule],
  controllers: [BoardsController, SprintsController, BulkController],
  providers: [BoardService, SprintService, ReportService, BulkService, SprintApprovalService],
  exports: [BoardService, SprintService, ReportService, SprintApprovalService],
})
export class BoardsModule {}
