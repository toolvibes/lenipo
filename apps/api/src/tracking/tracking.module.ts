import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { TrackingBootstrapService } from './bootstrap.service.js';
import { IssueService } from './issue.service.js';
import { IssuesController } from './issues.controller.js';
import { MetaService } from './meta.service.js';
import { ProjectService } from './project.service.js';
import { ProjectAccessService } from './project-access.service.js';
import { ProjectsController } from './projects.controller.js';

@Module({
  imports: [IdentityModule],
  controllers: [ProjectsController, IssuesController],
  providers: [
    TrackingBootstrapService,
    MetaService,
    ProjectAccessService,
    ProjectService,
    IssueService,
  ],
  exports: [IssueService, MetaService, ProjectAccessService, ProjectService],
})
export class TrackingModule {}
