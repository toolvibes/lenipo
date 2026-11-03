import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { PresenceModule } from '../presence/presence.module.js';
import { SearchModule } from '../search/search.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { McpController } from './mcp.controller.js';

@Module({
  imports: [IdentityModule, TrackingModule, SearchModule, BoardsModule, WikiModule, PresenceModule],
  controllers: [McpController],
})
export class McpModule {}
