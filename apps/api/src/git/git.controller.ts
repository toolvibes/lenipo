import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  type RawBodyRequest,
  Req,
  Res,
} from '@nestjs/common';
import {
  CreatedGitConnection,
  CreateGitConnectionRequest,
  DevelopmentSummary,
  GitConnection,
  type GitProvider,
  IssueDevelopment,
} from '@toolvibes/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import type { AppConfig } from '../core/config.js';
import { CurrentPrincipal, Public, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { CONFIG } from '../core/tokens.js';
import { AllowCrossSite, issuerOf } from '../identity/oauth.controller.js';
import { ReleaseService } from '../releases/release.service.js';
import { GitService } from './git.service.js';
import { changesOf, eventOf, verify } from './providers.js';

const Uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

/** Git hosting (TL-36, E-116): connections, the inbound webhook, development info. */
@Controller()
export class GitController {
  constructor(
    @Inject(GitService) private readonly git: GitService,
    @Inject(ReleaseService) private readonly releases: ReleaseService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Endpoint({
    tag: 'Git',
    summary: 'List Git connections (admin)',
    response: z.array(GitConnection),
  })
  @RequireGlobal('admin')
  @Get('admin/git-connections')
  list(@Req() request: Request): Promise<GitConnection[]> {
    return this.git.list(issuerOf(this.config, request));
  }

  @Endpoint({
    tag: 'Git',
    summary: 'Connect Git hosting (admin)',
    description:
      'Returns the webhook URL and the secret once: as webhook secret for GitHub and Gitea/Forgejo, as secret token for GitLab.',
    response: CreatedGitConnection,
  })
  @RequireGlobal('admin')
  @Post('admin/git-connections')
  create(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateGitConnectionRequest) body: CreateGitConnectionRequest,
    @Req() request: Request,
  ): Promise<CreatedGitConnection> {
    return this.git.create(principal, body, issuerOf(this.config, request));
  }

  @Endpoint({ tag: 'Git', summary: 'Remove a Git connection and its links (admin)' })
  @RequireGlobal('admin')
  @Delete('admin/git-connections/:id')
  @HttpCode(204)
  remove(@CurrentPrincipal() principal: Principal, @Param('id', Uuid) id: string): Promise<void> {
    return this.git.delete(principal, id);
  }

  /** Called by the hosting; answers quickly, unknown events are accepted and ignored. */
  @Public()
  @AllowCrossSite()
  @Post('git/webhooks/:id')
  async webhook(
    @Param('id') id: string,
    @Req() request: RawBodyRequest<Request>,
    @Res() response: Response,
  ): Promise<void> {
    const connection = await this.git.connection(id);
    if (!connection) {
      response.status(404).json({ error: 'Unknown connection' });
      return;
    }
    const provider = connection.provider as GitProvider;
    const headers = Object.fromEntries(
      Object.entries(request.headers).map(([name, value]) => [
        name,
        Array.isArray(value) ? value[0] : value,
      ]),
    );
    if (!request.rawBody || !verify(provider, connection.secret, headers, request.rawBody)) {
      await this.git.noteDelivery(connection.id, 'Signatur oder Token passt nicht');
      response.status(401).json({ error: 'Invalid signature' });
      return;
    }
    await this.git.noteDelivery(connection.id, null);
    await this.git.receive(
      connection,
      changesOf(provider, eventOf(provider, headers), request.body),
    );
    response.status(202).json({ ok: true });
  }

  @Endpoint({
    tag: 'Git',
    summary: 'Development info of an issue',
    description:
      'Branches, commits (latest five), pull requests and the latest build per pipeline that name the issue.',
    response: IssueDevelopment,
  })
  @Get('issues/:key/development')
  development(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<IssueDevelopment> {
    return this.git.development(principal, key.toUpperCase());
  }

  @Endpoint({
    tag: 'Git',
    summary: 'Pull requests and builds of a release',
    description:
      'Per issue of the version with Git activity: open and merged pull requests, failing builds.',
    response: z.array(DevelopmentSummary),
  })
  @Get('projects/:key/releases/:id/development')
  async release(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('id', Uuid) id: string,
  ): Promise<DevelopmentSummary[]> {
    const release = await this.releases.get(principal, key.toUpperCase(), id);
    return this.git.summaries([...release.todo, ...release.inProgress, ...release.done]);
  }
}
