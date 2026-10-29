import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { SearchModule } from '../search/search.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { McpController } from './mcp.controller.js';

@Module({
  imports: [IdentityModule, TrackingModule, SearchModule],
  controllers: [McpController],
})
export class McpModule {}
