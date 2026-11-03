import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { JiraCompatController, JiraErrorFilter } from './jira-compat.controller.js';
import { JiraCompatService } from './jira-compat.service.js';

/** Jira REST API v2 compatibility for existing scripts and tools (TL-48, E-138). */
@Module({
  imports: [TrackingModule, SearchModule],
  controllers: [JiraCompatController],
  providers: [JiraCompatService, JiraErrorFilter],
})
export class JiraCompatModule {}
