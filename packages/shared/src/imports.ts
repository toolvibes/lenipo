import { z } from 'zod';
import { Id } from './identity.js';

/** Imports from Jira and Confluence Server/DC (TL-35, E-118). */
export const IMPORT_SOURCES = ['jira', 'confluence', 'archive'] as const;
export const ImportSource = z.enum(IMPORT_SOURCES).meta({ id: 'ImportSource' });
export type ImportSource = z.infer<typeof ImportSource>;

export const IMPORT_STATES = ['pending', 'running', 'done', 'failed'] as const;

/** What an import did or, in a dry run, would do. */
export const ImportReport = z
  .object({
    counts: z.record(z.string(), z.number().int()),
    /** How names were matched, e.g. "Status In Review → Review". */
    mappings: z.array(z.string()),
    /** What was left out, with the reason. */
    skipped: z.array(z.string()),
  })
  .meta({ id: 'ImportReport' });
export type ImportReport = z.infer<typeof ImportReport>;

export const ImportJob = z
  .object({
    id: Id,
    source: ImportSource,
    dryRun: z.boolean(),
    /** What is imported, e.g. "Jira https://jira.example.org: WEB, API". */
    label: z.string(),
    state: z.enum(IMPORT_STATES),
    progress: z.string(),
    log: z.array(z.string()),
    report: ImportReport.nullable(),
    createdBy: z.object({ id: Id, displayName: z.string() }).nullable(),
    createdAt: z.iso.datetime(),
    finishedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'ImportJob' });
export type ImportJob = z.infer<typeof ImportJob>;

export const JiraImportRequest = z
  .object({
    url: z.url({ protocol: /^https?$/ }).max(500),
    /** A personal access token, or user:password for basic auth. */
    token: z.string().min(1).max(500),
    projectKeys: z
      .array(
        z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z][A-Z0-9]{1,9}$/),
      )
      .min(1)
      .max(20),
    dryRun: z.boolean().default(true),
  })
  .meta({ id: 'JiraImportRequest' });
export type JiraImportRequest = z.infer<typeof JiraImportRequest>;

export const ConfluenceImportQuery = z.object({
  /** Key of the new space; the export's key if empty. */
  spaceKey: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,9}$/)
    .optional(),
  dryRun: z.enum(['true', 'false']).default('true'),
});
export type ConfluenceImportQuery = z.infer<typeof ConfluenceImportQuery>;

/** A project or space archive of another Tasklore instance (TL-39, E-120). */
export const ArchiveImportQuery = z.object({
  /** Key of the new project or space; the archive's key if empty. */
  targetKey: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,9}$/)
    .optional(),
  dryRun: z.enum(['true', 'false']).default('true'),
});
export type ArchiveImportQuery = z.infer<typeof ArchiveImportQuery>;
