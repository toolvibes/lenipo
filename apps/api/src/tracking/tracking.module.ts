import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { AttachmentService } from './attachment.service.js';
import { AttachmentsController } from './attachments.controller.js';
import { TrackingBootstrapService } from './bootstrap.service.js';
import { ComponentService } from './component.service.js';
import { IssueService } from './issue.service.js';
import { IssuesController } from './issues.controller.js';
import { LinkService } from './link.service.js';
import { MetaService } from './meta.service.js';
import { ProjectService } from './project.service.js';
import { ProjectAccessService } from './project-access.service.js';
import { ProjectsController } from './projects.controller.js';

@Module({
  imports: [IdentityModule],
  controllers: [ProjectsController, IssuesController, AttachmentsController],
  providers: [
    TrackingBootstrapService,
    MetaService,
    ProjectAccessService,
    ProjectService,
    ComponentService,
    LinkService,
    IssueService,
    AttachmentService,
  ],
  exports: [IssueService, MetaService, ProjectAccessService, ProjectService],
})
export class TrackingModule {}
