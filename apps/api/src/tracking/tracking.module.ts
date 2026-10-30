import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { AttachmentService } from './attachment.service.js';
import { AttachmentsController } from './attachments.controller.js';
import { TrackingBootstrapService } from './bootstrap.service.js';
import { ComponentService } from './component.service.js';
import { CustomFieldService } from './custom-field.service.js';
import { CustomFieldsController } from './custom-fields.controller.js';
import { IssueService } from './issue.service.js';
import { IssuesController } from './issues.controller.js';
import { LinkService } from './link.service.js';
import { MetaService } from './meta.service.js';
import { ProjectService } from './project.service.js';
import { ProjectAccessService } from './project-access.service.js';
import { ProjectsController } from './projects.controller.js';
import { TimeTrackingController } from './time-tracking.controller.js';
import { TimelineService } from './timeline.service.js';
import { VersionService } from './version.service.js';
import { WorkingTimeService } from './working-time.service.js';
import { WorklogService } from './worklog.service.js';

@Module({
  imports: [IdentityModule],
  controllers: [
    ProjectsController,
    IssuesController,
    AttachmentsController,
    TimeTrackingController,
    CustomFieldsController,
  ],
  providers: [
    TrackingBootstrapService,
    MetaService,
    ProjectAccessService,
    ProjectService,
    ComponentService,
    CustomFieldService,
    LinkService,
    WorkingTimeService,
    VersionService,
    IssueService,
    TimelineService,
    WorklogService,
    AttachmentService,
  ],
  exports: [
    ComponentService,
    CustomFieldService,
    IssueService,
    MetaService,
    ProjectAccessService,
    ProjectService,
    WorkingTimeService,
    WorklogService,
    VersionService,
  ],
})
export class TrackingModule {}
