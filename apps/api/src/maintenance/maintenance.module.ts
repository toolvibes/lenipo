import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { BackupService } from './backup.service.js';
import {
  MaintenanceController,
  RestoreController,
  UpdatesController,
} from './maintenance.controller.js';
import { RetentionService } from './retention.service.js';
import { UpdateCheckService } from './update-check.service.js';

@Module({
  imports: [IdentityModule],
  controllers: [MaintenanceController, RestoreController, UpdatesController],
  providers: [RetentionService, BackupService, UpdateCheckService],
  exports: [RetentionService, BackupService, UpdateCheckService],
})
export class MaintenanceModule {}
