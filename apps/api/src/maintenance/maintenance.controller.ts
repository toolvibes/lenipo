import { rm } from 'node:fs/promises';
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  Backup,
  BackupSettings,
  RestoreResult,
  RetentionResult,
  RetentionSettings,
  UpdateSettings,
  UpdateStatus,
} from '@toolvibes/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { AuditService } from '../audit/audit.service.js';
import { CurrentPrincipal, Public, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { SetupService } from '../identity/setup.service.js';
import { disposition } from '../storage/disposition.js';
import { receiveUpload } from '../storage/upload.js';
import { BackupService, RestoreError } from './backup.service.js';
import { RetentionService } from './retention.service.js';
import { UpdateCheckService } from './update-check.service.js';

/** Retention and backups for administrators (TL-39, E-120). */
@RequireGlobal('admin')
@Controller('admin')
export class MaintenanceController {
  constructor(
    @Inject(RetentionService) private readonly retention: RetentionService,
    @Inject(BackupService) private readonly backups: BackupService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Endpoint({ tag: 'Maintenance', summary: 'Retention settings', response: RetentionSettings })
  @Get('retention')
  retentionSettings(): Promise<RetentionSettings> {
    return this.retention.settings();
  }

  @Endpoint({
    tag: 'Maintenance',
    summary: 'Change the retention settings',
    response: RetentionSettings,
  })
  @Put('retention')
  async setRetention(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(RetentionSettings) body: RetentionSettings,
  ): Promise<RetentionSettings> {
    const saved = await this.retention.setSettings(body);
    await this.audit.record({
      action: 'system.retention_changed',
      actorId: principal.userId,
      via: principal.via,
      details: saved,
    });
    return saved;
  }

  @Endpoint({
    tag: 'Maintenance',
    summary: 'Clean up now',
    description: 'Runs the hourly clean-up at once and reports what it deleted.',
    response: RetentionResult,
  })
  @Post('retention/run')
  @HttpCode(200)
  runRetention(): Promise<RetentionResult> {
    return this.retention.run();
  }

  @Endpoint({ tag: 'Maintenance', summary: 'Backup schedule', response: BackupSettings })
  @Get('backup-settings')
  backupSettings(): Promise<BackupSettings> {
    return this.backups.settings();
  }

  @Endpoint({ tag: 'Maintenance', summary: 'Change the backup schedule', response: BackupSettings })
  @Put('backup-settings')
  setBackupSettings(@ValidBody(BackupSettings) body: BackupSettings): Promise<BackupSettings> {
    return this.backups.setSettings(body);
  }

  @Endpoint({ tag: 'Maintenance', summary: 'List backups', response: z.array(Backup) })
  @Get('backups')
  listBackups(): Promise<Backup[]> {
    return this.backups.list();
  }

  @Endpoint({
    tag: 'Maintenance',
    summary: 'Start a backup',
    description: 'Returns at once with state "running"; the list shows when it is done.',
    response: Backup,
  })
  @Post('backups')
  @HttpCode(201)
  async startBackup(@CurrentPrincipal() principal: Principal): Promise<Backup> {
    const backup = await this.backups.start('manual', principal.userId);
    await this.audit.record({
      action: 'system.backup_started',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'backup',
      targetId: backup.id,
    });
    return backup;
  }

  @Endpoint({ tag: 'Maintenance', summary: 'Show one backup', response: Backup })
  @Get('backups/:id')
  getBackup(@Param('id', ParseUUIDPipe) id: string): Promise<Backup> {
    return this.backups.get(id);
  }

  @Endpoint({ tag: 'Maintenance', summary: 'Download a backup as ZIP', binary: true })
  @Get('backups/:id/download')
  async downloadBackup(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.backups.download(id);
    await this.audit.record({
      action: 'system.backup_downloaded',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'backup',
      targetId: id,
    });
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(file.stream, {
      type: 'application/zip',
      disposition: disposition('attachment', file.fileName),
      length: file.size || undefined,
    });
  }

  @Endpoint({ tag: 'Maintenance', summary: 'Delete a backup' })
  @Delete('backups/:id')
  @HttpCode(204)
  async deleteBackup(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.backups.delete(id);
    await this.audit.record({
      action: 'system.backup_deleted',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'backup',
      targetId: id,
    });
  }
}

/** Restoring a backup instead of setting up a new instance (TL-39, E-120). */
@Public()
@Controller('setup')
export class RestoreController {
  constructor(
    @Inject(BackupService) private readonly backups: BackupService,
    @Inject(SetupService) private readonly setup: SetupService,
  ) {}

  @Endpoint({
    tag: 'Setup',
    summary: 'Restore a backup into this fresh instance',
    description:
      'Only while setup is still required, with the setup code in the X-Setup-Code header. The ZIP (field "file") must come from the same Lenipo version. Afterwards people sign in with their accounts from the backup.',
    upload: 'file',
    response: RestoreResult,
  })
  @Post('restore')
  @HttpCode(200)
  async restore(
    @Headers('x-setup-code') code: string | undefined,
    @Req() request: Request,
  ): Promise<RestoreResult> {
    await this.setup.checkCode(code ?? '');
    const upload = await receiveUpload(request, 1024 ** 4);
    try {
      return await this.backups.restore(upload.path);
    } catch (error) {
      if (error instanceof RestoreError) throw new BadRequestException(error.message);
      throw error;
    } finally {
      await rm(upload.path, { force: true });
    }
  }
}

/** The running version and the optional update check (TL-110, E-155). */
@RequireGlobal('admin')
@Controller('admin/updates')
export class UpdatesController {
  constructor(@Inject(UpdateCheckService) private readonly updates: UpdateCheckService) {}

  @Endpoint({
    tag: 'Maintenance',
    summary: 'Running version and newest release',
    description: 'The newest release is known only while the update check is on.',
    response: UpdateStatus,
  })
  @Get()
  status(): Promise<UpdateStatus> {
    return this.updates.status();
  }

  @Endpoint({
    tag: 'Maintenance',
    summary: 'Turn the update check on or off',
    description:
      'Once a day the instance reads the public list of releases on GitHub; nothing else is sent. Turning it on checks at once.',
    response: UpdateStatus,
  })
  @Put()
  setEnabled(@ValidBody(UpdateSettings) body: UpdateSettings): Promise<UpdateStatus> {
    return this.updates.setEnabled(body.enabled);
  }
}
