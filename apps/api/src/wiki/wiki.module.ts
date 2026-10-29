import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { PageService } from './page.service.js';
import { PagesController } from './pages.controller.js';
import { SpaceService } from './space.service.js';
import { SpaceAccessService } from './space-access.service.js';
import { SpacesController } from './spaces.controller.js';

@Module({
  imports: [IdentityModule],
  controllers: [SpacesController, PagesController],
  providers: [SpaceAccessService, SpaceService, PageService],
  exports: [SpaceAccessService, SpaceService, PageService],
})
export class WikiModule {}
