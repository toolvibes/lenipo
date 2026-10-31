import { z } from 'zod';
import { IssueSummary, Version } from './tracking.js';

/** Something to look at before a release (T-REL-02, TL-25, E-106). */
export const ReleaseWarning = z
  .object({
    kind: z.enum(['overdue', 'blocked', 'unassigned']),
    issueKey: z.string(),
    /** For blocked: the open blocking issue. */
    blockerKey: z.string().nullable(),
  })
  .meta({ id: 'ReleaseWarning' });
export type ReleaseWarning = z.infer<typeof ReleaseWarning>;

export const Release = z
  .object({
    version: Version,
    progress: z.object({
      issues: z.number().int(),
      done: z.number().int(),
      points: z.number(),
      donePoints: z.number(),
    }),
    /** The version's issues by status category. */
    todo: z.array(IssueSummary),
    inProgress: z.array(IssueSummary),
    done: z.array(IssueSummary),
    warnings: z.array(ReleaseWarning),
    /** The wiki page the release notes were published to. */
    notesPage: z.object({ id: z.uuid(), title: z.string(), spaceKey: z.string() }).nullable(),
    canEdit: z.boolean(),
  })
  .meta({ id: 'Release' });
export type Release = z.infer<typeof Release>;

export const ReleaseNotes = z
  .object({ title: z.string(), markdown: z.string() })
  .meta({ id: 'ReleaseNotes' });
export type ReleaseNotes = z.infer<typeof ReleaseNotes>;

/** Publishes the notes; a version with a notes page gets a new version of that page. */
export const PublishReleaseNotesRequest = z
  .object({
    title: z.string().trim().min(1).max(255),
    markdown: z.string().max(200_000),
    /** Only for the first publication; later ones update the remembered page. */
    spaceKey: z.string().trim().min(1).max(20).optional(),
    parentId: z.uuid().nullable().optional(),
  })
  .meta({ id: 'PublishReleaseNotesRequest' });
export type PublishReleaseNotesRequest = z.infer<typeof PublishReleaseNotesRequest>;

/** Wiki pages a project creates by itself (W-INT-05, W-INT-06, TL-28, E-109). */
export const ProjectWikiPages = z
  .object({
    /** Where the pages go; null switches everything off. */
    spaceKey: z.string().trim().min(1).max(20).nullable(),
    retroOnSprintEnd: z.boolean(),
    reportOnSprintEnd: z.boolean(),
    notesOnRelease: z.boolean(),
  })
  .meta({ id: 'ProjectWikiPages' });
export type ProjectWikiPages = z.infer<typeof ProjectWikiPages>;
