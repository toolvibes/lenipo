import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { SearchModule } from '../search/search.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { BoardService } from './board.service.js';
import { BoardsController } from './boards.controller.js';

@Module({
  imports: [IdentityModule, TrackingModule, SearchModule],
  controllers: [BoardsController],
  providers: [BoardService],
  exports: [BoardService],
})
export class BoardsModule {}
