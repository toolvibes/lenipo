import { z } from 'zod';
import { Id } from './identity.js';

const Days = z.number().int().min(0).max(3650);

/** How long deleted and old data is kept (TL-39, E-120); 0 keeps it for good. */
export const RetentionSettings = z
  .object({
    /** Issues, pages and comments in the trash are deleted for good after this many days. */
    trashDays: Days.default(30),
    /** Page versions older than this are thinned to the last one per day; 0 keeps every one. */
    versionDays: Days.default(0),
    /** Audit log entries older than this are deleted. */
    auditDays: Days.default(365),
  })
  .meta({ id: 'RetentionSettings' });
export type RetentionSettings = z.infer<typeof RetentionSettings>;

/** What one clean-up run deleted. */
export const RetentionResult = z
  .object({
    issues: z.number().int(),
    pages: z.number().int(),
    comments: z.number().int(),
    versions: z.number().int(),
    auditEntries: z.number().int(),
    files: z.number().int(),
    /** Per-person page views turned into anonymous counts (TL-51, E-135). */
    pageViews: z.number().int(),
    /** Projects and wiki spaces emptied from the trash with everything in them (E-164). */
    projects: z.number().int(),
    spaces: z.number().int(),
  })
  .meta({ id: 'RetentionResult' });
export type RetentionResult = z.infer<typeof RetentionResult>;

/** Scheduled backups (TL-39, E-120). */
export const BackupSettings = z
  .object({
    enabled: z.boolean().default(true),
    /** Hour of the day in the server's time zone (UTC in containers). */
    hour: z.number().int().min(0).max(23).default(2),
    /** How many scheduled backups to keep; older ones are deleted. Manual ones stay. */
    keep: z.number().int().min(1).max(100).default(3),
  })
  .meta({ id: 'BackupSettings' });
export type BackupSettings = z.infer<typeof BackupSettings>;

export const BACKUP_STATES = ['running', 'done', 'failed'] as const;

export const Backup = z
  .object({
    id: Id,
    trigger: z.enum(['manual', 'scheduled']),
    state: z.enum(BACKUP_STATES),
    createdAt: z.string(),
    finishedAt: z.string().nullable(),
    sizeBytes: z.number().int().nullable(),
    /** Rows and files written. */
    rows: z.number().int().nullable(),
    files: z.number().int().nullable(),
    error: z.string().nullable(),
  })
  .meta({ id: 'Backup' });
export type Backup = z.infer<typeof Backup>;

/** What a restore brought back. */
export const RestoreResult = z
  .object({
    tables: z.number().int(),
    rows: z.number().int(),
    files: z.number().int(),
  })
  .meta({ id: 'RestoreResult' });
export type RestoreResult = z.infer<typeof RestoreResult>;

// ---------------------------------------------------------------- updates (TL-110, E-155)

/** The running version and, if the check is on, the newest released one. */
export const UpdateStatus = z
  .object({
    current: z.string(),
    /** Daily look at the public list of releases; off unless an administrator turns it on. */
    enabled: z.boolean(),
    latest: z.string().nullable(),
    /** The release notes of the newest version. */
    url: z.string().nullable(),
    checkedAt: z.iso.datetime().nullable(),
    /** A newer version than the running one is out. */
    available: z.boolean(),
    /** The last check failed with this message. */
    error: z.string().nullable(),
  })
  .meta({ id: 'UpdateStatus' });
export type UpdateStatus = z.infer<typeof UpdateStatus>;

export const UpdateSettings = z.object({ enabled: z.boolean() }).meta({ id: 'UpdateSettings' });
export type UpdateSettings = z.infer<typeof UpdateSettings>;
