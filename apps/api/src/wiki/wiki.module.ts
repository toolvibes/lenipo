import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { IssuePagesController } from './issue-pages.controller.js';
import { LabelsController } from './labels.controller.js';
import { PageService } from './page.service.js';
import { PageAttachmentService } from './page-attachment.service.js';
import { PageAttachmentsController } from './page-attachments.controller.js';
import { PageCommentService } from './page-comment.service.js';
import { PageCommentsController } from './page-comments.controller.js';
import { PagesController } from './pages.controller.js';
import { ProjectSpacesController } from './project-spaces.controller.js';
import { SpaceService } from './space.service.js';
import { SpaceAccessService } from './space-access.service.js';
import { SpacesController } from './spaces.controller.js';
import { TemplateService } from './template.service.js';
import { TemplatesController } from './templates.controller.js';

@Module({
  imports: [IdentityModule, TrackingModule],
  controllers: [
    TemplatesController,
    IssuePagesController,
    SpacesController,
    PagesController,
    PageAttachmentsController,
    PageCommentsController,
    ProjectSpacesController,
    LabelsController,
  ],
  providers: [
    SpaceAccessService,
    SpaceService,
    TemplateService,
    PageService,
    PageAttachmentService,
    PageCommentService,
  ],
  exports: [SpaceAccessService, SpaceService, PageService],
})
export class WikiModule {}
