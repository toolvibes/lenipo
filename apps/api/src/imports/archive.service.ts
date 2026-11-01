import { PassThrough, type Readable } from 'node:stream';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { strToU8, Zip, ZipDeflate } from 'fflate';
import type { Logger } from '../core/logger.js';
import { DATABASE, FILE_STORE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { API_VERSION } from '../openapi/version.js';
import type { FileStore } from '../storage/file-store.js';

export const ARCHIVE_FORMAT = 'lenipo-archive';
export const ARCHIVE_VERSION = 1;

// biome-ignore lint/suspicious/noExplicitAny: rows as PostgreSQL writes them with to_jsonb
export type ArchiveRow = Record<string, any>;

/**
 * One project or space with everything in it, for another Lenipo instance (TL-39, E-120).
 * Rows keep their ids and snake_case columns; people and shared settings such as issue types
 * travel as lookups, matched by e-mail, key or name on import.
 */
export interface Archive {
  format: typeof ARCHIVE_FORMAT;
  formatVersion: number;
  kind: 'project' | 'space';
  exportedAt: string;
  apiVersion: string;
  lookups: Record<
    | 'users'
    | 'issueTypes'
    | 'statuses'
    | 'priorities'
    | 'resolutions'
    | 'linkTypes'
    | 'customFields',
    ArchiveRow[]
  >;
  /** The project or space row and the rows below it, by table name. */
  root: ArchiveRow;
  tables: Record<string, ArchiveRow[]>;
}

/** Writes project and space archives as ZIP: archive.json plus files/<attachment id>. */
@Injectable()
export class ArchiveService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(FILE_STORE) private readonly store: FileStore,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  private async rows(query: string, parameters: string[]): Promise<ArchiveRow[]> {
    const rows = await this.database.sql.unsafe<{ r: ArchiveRow }[]>(query, parameters);
    return rows.map((row) => row.r);
  }

  private async lookups(): Promise<Archive['lookups']> {
    const all = (table: string, columns: string) =>
      this.rows(`select jsonb_build_object(${columns}) as r from ${table}`, []);
    return {
      users: await all('users', `'id', id, 'email', email, 'display_name', display_name`),
      issueTypes: await all('issue_types', `'id', id, 'key', key, 'name', name`),
      statuses: await all('statuses', `'id', id, 'key', key, 'name', name, 'category', category`),
      priorities: await all('priorities', `'id', id, 'key', key, 'name', name`),
      resolutions: await all('resolutions', `'id', id, 'key', key, 'name', name`),
      linkTypes: await all('issue_link_types', `'id', id, 'key', key, 'name', name`),
      customFields: await all('custom_fields', `'id', id, 'name', name`),
    };
  }

  async project(key: string): Promise<{ stream: Readable; fileName: string }> {
    const [root] = await this.rows('select to_jsonb(p) as r from projects p where key = $1', [
      key.toUpperCase(),
    ]);
    if (!root) throw new NotFoundException('Project not found');
    const id = root.id as string;
    const issues = `select id from issues where project_id = $1 and deleted_at is null`;
    const tables: Record<string, ArchiveRow[]> = {
      project_components: await this.rows(
        'select to_jsonb(t) as r from project_components t where project_id = $1',
        [id],
      ),
      project_versions: await this.rows(
        'select to_jsonb(t) as r from project_versions t where project_id = $1',
        [id],
      ),
      issues: await this.rows(
        `select to_jsonb(t) as r from issues t where project_id = $1 and deleted_at is null
         order by number`,
        [id],
      ),
      issue_comments: await this.rows(
        `select to_jsonb(t) as r from issue_comments t
         where issue_id in (${issues}) and deleted_at is null order by created_at`,
        [id],
      ),
      issue_worklogs: await this.rows(
        `select to_jsonb(t) as r from issue_worklogs t where issue_id in (${issues})`,
        [id],
      ),
      issue_links: await this.rows(
        `select to_jsonb(t) as r from issue_links t
         where source_id in (${issues}) and target_id in (${issues})`,
        [id],
      ),
      issue_components: await this.rows(
        `select to_jsonb(t) as r from issue_components t where issue_id in (${issues})`,
        [id],
      ),
      issue_versions: await this.rows(
        `select to_jsonb(t) as r from issue_versions t where issue_id in (${issues})`,
        [id],
      ),
      issue_attachments: await this.rows(
        `select to_jsonb(t) as r from issue_attachments t where issue_id in (${issues})`,
        [id],
      ),
    };
    return {
      stream: this.zip({ kind: 'project', root, tables }, tables.issue_attachments ?? []),
      fileName: `lenipo-project-${root.key}.zip`,
    };
  }

  async space(key: string): Promise<{ stream: Readable; fileName: string }> {
    const [root] = await this.rows('select to_jsonb(s) as r from spaces s where key = $1', [
      key.toUpperCase(),
    ]);
    if (!root) throw new NotFoundException('Space not found');
    const id = root.id as string;
    const pages = `select id from pages where space_id = $1 and deleted_at is null`;
    const tables: Record<string, ArchiveRow[]> = {
      pages: await this.rows(
        'select to_jsonb(t) as r from pages t where space_id = $1 and deleted_at is null',
        [id],
      ),
      page_versions: await this.rows(
        `select to_jsonb(t) as r from page_versions t where page_id in (${pages})
         order by page_id, number`,
        [id],
      ),
      page_comments: await this.rows(
        `select to_jsonb(t) as r from page_comments t
         where page_id in (${pages}) and deleted_at is null order by created_at`,
        [id],
      ),
      page_attachments: await this.rows(
        `select to_jsonb(t) as r from page_attachments t where page_id in (${pages})`,
        [id],
      ),
    };
    return {
      stream: this.zip({ kind: 'space', root, tables }, tables.page_attachments ?? []),
      fileName: `lenipo-space-${root.key}.zip`,
    };
  }

  private zip(
    content: Pick<Archive, 'kind' | 'root' | 'tables'>,
    attachments: ArchiveRow[],
  ): Readable {
    const out = new PassThrough();
    const zip = new Zip((error, chunk, final) => {
      if (error) {
        out.destroy(error);
        return;
      }
      out.write(chunk);
      if (final) out.end();
    });
    const fill = async () => {
      const archive: Archive = {
        format: ARCHIVE_FORMAT,
        formatVersion: ARCHIVE_VERSION,
        exportedAt: new Date().toISOString(),
        apiVersion: API_VERSION,
        lookups: await this.lookups(),
        ...content,
      };
      const json = new ZipDeflate('archive.json', { level: 6 });
      zip.add(json);
      json.push(strToU8(JSON.stringify(archive)), true);
      for (const attachment of attachments) {
        let stream: Readable;
        try {
          stream = await this.store.get(attachment.storage_key);
        } catch (error) {
          this.logger.warn({ err: error, key: attachment.storage_key }, 'File missing in archive');
          continue;
        }
        const file = new ZipDeflate(`files/${attachment.id}`, { level: 0 });
        zip.add(file);
        for await (const chunk of stream) file.push(chunk as Uint8Array);
        file.push(new Uint8Array(0), true);
      }
      zip.end();
    };
    fill().catch((error: Error) => out.destroy(error));
    return out;
  }
}
