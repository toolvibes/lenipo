import { Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { PublishReleaseNotesRequest, Release, ReleaseNotes } from '@tasklore/shared';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { ReleaseService } from './release.service.js';

const VersionId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@Controller('projects/:key/releases')
export class ReleasesController {
  constructor(@Inject(ReleaseService) private readonly releases: ReleaseService) {}

  @Endpoint({
    tag: 'Versions',
    summary: 'A version’s progress, issues by status and warnings',
    response: Release,
  })
  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('id', VersionId) id: string,
  ): Promise<Release> {
    return this.releases.get(principal, key.toUpperCase(), id);
  }

  @Endpoint({
    tag: 'Versions',
    summary: 'Release notes as Markdown, grouped by issue type',
    response: ReleaseNotes,
  })
  @Get(':id/notes')
  notes(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('id', VersionId) id: string,
  ): Promise<ReleaseNotes> {
    return this.releases.notes(principal, key.toUpperCase(), id);
  }

  @Endpoint({
    tag: 'Versions',
    summary: 'Publish the release notes as a wiki page (project administrators)',
    response: Release,
  })
  @Post(':id/notes')
  @HttpCode(200)
  publish(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('id', VersionId) id: string,
    @ValidBody(PublishReleaseNotesRequest) body: PublishReleaseNotesRequest,
  ): Promise<Release> {
    return this.releases.publish(principal, key.toUpperCase(), id, body);
  }
}
