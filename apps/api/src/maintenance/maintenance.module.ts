import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { BackupService } from './backup.service.js';
import { MaintenanceController, RestoreController } from './maintenance.controller.js';
import { RetentionService } from './retention.service.js';

@Module({
  imports: [IdentityModule],
  controllers: [MaintenanceController, RestoreController],
  providers: [RetentionService, BackupService],
  exports: [RetentionService, BackupService],
})
export class MaintenanceModule {}
