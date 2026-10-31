import { Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  ProjectWikiPages,
  PublishReleaseNotesRequest,
  Release,
  ReleaseNotes,
} from '@tasklore/shared';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { ProjectPagesService } from './project-pages.service.js';
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

/** The wiki pages a project creates by itself (TL-28, E-109). */
@Controller('projects/:key/wiki-pages')
export class ProjectWikiPagesController {
  constructor(@Inject(ProjectPagesService) private readonly projectPages: ProjectPagesService) {}

  @Endpoint({
    tag: 'Projects',
    summary: 'Wiki pages the project creates on sprint completion and release',
    response: ProjectWikiPages,
  })
  @Get()
  wikiPages(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<ProjectWikiPages> {
    return this.projectPages.get(principal, key.toUpperCase());
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'Change the automatic wiki pages (project administrators)',
    response: ProjectWikiPages,
  })
  @Put()
  setWikiPages(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(ProjectWikiPages) body: ProjectWikiPages,
  ): Promise<ProjectWikiPages> {
    return this.projectPages.set(principal, key.toUpperCase(), body);
  }
}
