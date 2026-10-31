import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { ReleasesModule } from '../releases/releases.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { GitController } from './git.controller.js';
import { GitService } from './git.service.js';

@Module({
  imports: [IdentityModule, TrackingModule, ReleasesModule],
  controllers: [GitController],
  providers: [GitService],
})
export class GitModule {}
