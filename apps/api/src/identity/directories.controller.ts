import { Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  Directory,
  DirectoryOrder,
  DirectorySyncResult,
  LdapConfig,
  SaveDirectoryRequest,
} from '@tasklore/shared';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import { DirectoryService } from './directory.service.js';

const Uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

/** User directories (TL-38, E-119), for administrators. */
@RequireGlobal('admin')
@Controller('admin/directories')
export class DirectoriesController {
  constructor(@Inject(DirectoryService) private readonly directories: DirectoryService) {}

  @Endpoint({
    tag: 'Directories',
    summary: 'List user directories in sign-in order',
    response: z.array(Directory),
  })
  @Get()
  list(): Promise<Directory[]> {
    return this.directories.list();
  }

  @Endpoint({
    tag: 'Directories',
    summary: 'Add an LDAP/AD directory',
    response: z.array(Directory),
  })
  @Post()
  create(@ValidBody(SaveDirectoryRequest) body: SaveDirectoryRequest): Promise<Directory[]> {
    return this.directories.create(body);
  }

  @Endpoint({
    tag: 'Directories',
    summary: 'Try LDAP settings',
    description: 'Connects, binds and searches people without saving anything.',
    response: z.object({ ok: z.boolean(), message: z.string() }),
  })
  @Post('test')
  test(@ValidBody(LdapConfig) body: LdapConfig) {
    return this.directories.test(body);
  }

  @Endpoint({
    tag: 'Directories',
    summary: 'Change the sign-in order of the directories',
    response: z.array(Directory),
  })
  @Put('order')
  reorder(@ValidBody(DirectoryOrder) body: DirectoryOrder): Promise<Directory[]> {
    return this.directories.reorder(body);
  }

  @Endpoint({
    tag: 'Directories',
    summary: 'Change an LDAP/AD directory',
    response: z.array(Directory),
  })
  @Put(':id')
  update(
    @Param('id', Uuid) id: string,
    @ValidBody(SaveDirectoryRequest) body: SaveDirectoryRequest,
  ): Promise<Directory[]> {
    return this.directories.update(id, body);
  }

  @Endpoint({
    tag: 'Directories',
    summary: 'Remove an LDAP/AD directory',
    description: 'Its people are deactivated; its groups stay as ordinary groups.',
    response: z.array(Directory),
  })
  @Delete(':id')
  remove(@Param('id', Uuid) id: string): Promise<Directory[]> {
    return this.directories.delete(id);
  }

  @Endpoint({
    tag: 'Directories',
    summary: 'Synchronise a directory now',
    response: DirectorySyncResult,
  })
  @Post(':id/sync')
  sync(@Param('id', Uuid) id: string): Promise<DirectorySyncResult> {
    return this.directories.sync(id);
  }
}
