import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { AccessCheckController } from './access-check.controller.js';
import { AccessCheckService } from './access-check.service.js';
import { DraftService } from './draft.service.js';
import { IssuePagesController } from './issue-pages.controller.js';
import { LabelsController } from './labels.controller.js';
import { PageService } from './page.service.js';
import { PageAttachmentService } from './page-attachment.service.js';
import { PageAttachmentsController } from './page-attachments.controller.js';
import { PageCommentService } from './page-comment.service.js';
import { PageCommentsController } from './page-comments.controller.js';
import { PagesController, RestrictedPagesController } from './pages.controller.js';
import { ProjectSpacesController } from './project-spaces.controller.js';
import { SpaceService } from './space.service.js';
import { SpaceAccessService } from './space-access.service.js';
import { SpacesController } from './spaces.controller.js';
import { TemplateService } from './template.service.js';
import { TemplatesController } from './templates.controller.js';
import { WikiMacrosController } from './wiki-macros.controller.js';
import { WikiMacrosService } from './wiki-macros.service.js';

@Module({
  imports: [IdentityModule, TrackingModule],
  controllers: [
    WikiMacrosController,
    AccessCheckController,
    TemplatesController,
    IssuePagesController,
    RestrictedPagesController,
    SpacesController,
    PagesController,
    PageAttachmentsController,
    PageCommentsController,
    ProjectSpacesController,
    LabelsController,
  ],
  providers: [
    WikiMacrosService,
    AccessCheckService,
    SpaceAccessService,
    SpaceService,
    TemplateService,
    DraftService,
    PageService,
    PageAttachmentService,
    PageCommentService,
  ],
  exports: [SpaceAccessService, SpaceService, PageService, DraftService, PageCommentService],
})
export class WikiModule {}
