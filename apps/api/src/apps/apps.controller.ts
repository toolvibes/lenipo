import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  AppManifest,
  AppManifestRequest,
  AppSummary,
  AppToken,
  InstallAppRequest,
  InstalledApp,
  UpdateAppRequest,
} from '@toolvibes/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { AppsService } from './apps.service.js';

const AppId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });
const RefreshAppRequest = z
  .object({ approvedScopes: InstallAppRequest.shape.approvedScopes.default([]) })
  .meta({ id: 'RefreshAppRequest' });
type RefreshAppRequest = z.infer<typeof RefreshAppRequest>;

function ownOrigin(request: Request): string {
  return `${request.protocol}://${request.get('host')}`;
}

/** Installing and managing apps (TL-50, E-140). */
@RequireGlobal('admin')
@Controller('admin/apps')
export class AppsAdminController {
  constructor(@Inject(AppsService) private readonly apps: AppsService) {}

  @Endpoint({ tag: 'Apps', summary: 'List installed apps', response: z.array(InstalledApp) })
  @Get()
  listInstalledApps(): Promise<InstalledApp[]> {
    return this.apps.listInstalled();
  }

  @Endpoint({
    tag: 'Apps',
    summary: 'Load and check the manifest of an app before installing it',
    response: AppManifest,
  })
  @Post('preview')
  @HttpCode(200)
  previewApp(
    @Req() request: Request,
    @ValidBody(AppManifestRequest) body: AppManifestRequest,
  ): Promise<AppManifest> {
    return this.apps.preview(body.manifestUrl, ownOrigin(request));
  }

  @Endpoint({
    tag: 'Apps',
    summary: 'Install an app from its manifest, approving its scopes',
    response: InstalledApp,
  })
  @Post()
  installApp(
    @CurrentPrincipal() principal: Principal,
    @Req() request: Request,
    @ValidBody(InstallAppRequest) body: InstallAppRequest,
  ): Promise<InstalledApp> {
    return this.apps.install(principal, body, ownOrigin(request));
  }

  @Endpoint({
    tag: 'Apps',
    summary: 'Load the manifest again; new scopes need approval',
    response: InstalledApp,
  })
  @Post(':id/refresh')
  @HttpCode(200)
  refreshApp(
    @CurrentPrincipal() principal: Principal,
    @Req() request: Request,
    @Param('id', AppId) id: string,
    @ValidBody(RefreshAppRequest) body: RefreshAppRequest,
  ): Promise<InstalledApp> {
    return this.apps.refresh(principal, id, body.approvedScopes, ownOrigin(request));
  }

  @Endpoint({ tag: 'Apps', summary: 'Switch an app on or off', response: InstalledApp })
  @Patch(':id')
  updateApp(
    @CurrentPrincipal() principal: Principal,
    @Param('id', AppId) id: string,
    @ValidBody(UpdateAppRequest) body: UpdateAppRequest,
  ): Promise<InstalledApp> {
    return this.apps.setEnabled(principal, id, body.enabled);
  }

  @Endpoint({ tag: 'Apps', summary: 'Remove an app; its tokens end at once' })
  @Delete(':id')
  @HttpCode(204)
  uninstallApp(
    @CurrentPrincipal() principal: Principal,
    @Param('id', AppId) id: string,
  ): Promise<void> {
    return this.apps.uninstall(principal, id);
  }
}

/** What installed apps offer, for everyone signed in. */
@Controller('apps')
export class AppsController {
  constructor(@Inject(AppsService) private readonly apps: AppsService) {}

  @Endpoint({
    tag: 'Apps',
    summary: 'Enabled apps with their panels, macros and gadgets',
    response: z.array(AppSummary),
  })
  @Get()
  listApps(): Promise<AppSummary[]> {
    return this.apps.listEnabled();
  }

  @Endpoint({
    tag: 'Apps',
    summary: 'A short-lived token for an app, acting as you within its approved scopes',
    response: AppToken,
  })
  @Post(':id/token')
  @HttpCode(200)
  appToken(
    @CurrentPrincipal() principal: Principal,
    @Param('id', AppId) id: string,
  ): Promise<AppToken> {
    return this.apps.token(principal, id);
  }
}
