import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { AttachmentService } from './attachment.service.js';
import { AttachmentsController } from './attachments.controller.js';
import { TrackingBootstrapService } from './bootstrap.service.js';
import { ComponentService } from './component.service.js';
import { CustomFieldService } from './custom-field.service.js';
import { CustomFieldsController } from './custom-fields.controller.js';
import { EstimationController } from './estimation.controller.js';
import { EstimationService } from './estimation.service.js';
import { IssueService } from './issue.service.js';
import { IssuesController } from './issues.controller.js';
import { LinkService } from './link.service.js';
import { MetaService } from './meta.service.js';
import { PermissionSchemeService } from './permission-scheme.service.js';
import { PermissionSchemesController } from './permission-schemes.controller.js';
import { ProjectService } from './project.service.js';
import { ProjectAccessService } from './project-access.service.js';
import { ProjectMemberService } from './project-member.service.js';
import { ProjectsController } from './projects.controller.js';
import { SecuritySchemeService } from './security-scheme.service.js';
import { SecuritySchemesController } from './security-schemes.controller.js';
import { TimeTrackingController } from './time-tracking.controller.js';
import { TimelineService } from './timeline.service.js';
import { TimesheetController } from './timesheet.controller.js';
import { TimesheetService } from './timesheet.service.js';
import { VersionService } from './version.service.js';
import { WorkflowService } from './workflow.service.js';
import { WorkingTimeService } from './working-time.service.js';
import { WorklogService } from './worklog.service.js';

@Module({
  imports: [IdentityModule],
  controllers: [
    ProjectsController,
    IssuesController,
    AttachmentsController,
    TimeTrackingController,
    TimesheetController,
    CustomFieldsController,
    PermissionSchemesController,
    SecuritySchemesController,
    EstimationController,
  ],
  providers: [
    TrackingBootstrapService,
    EstimationService,
    MetaService,
    ProjectAccessService,
    ProjectService,
    ProjectMemberService,
    PermissionSchemeService,
    SecuritySchemeService,
    ComponentService,
    CustomFieldService,
    LinkService,
    WorkingTimeService,
    VersionService,
    IssueService,
    TimelineService,
    WorkflowService,
    WorklogService,
    TimesheetService,
    AttachmentService,
  ],
  exports: [
    ProjectMemberService,
    ComponentService,
    CustomFieldService,
    IssueService,
    MetaService,
    ProjectAccessService,
    ProjectService,
    WorkingTimeService,
    WorklogService,
    VersionService,
    TimelineService,
  ],
})
export class TrackingModule {}
