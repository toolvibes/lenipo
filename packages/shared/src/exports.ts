import { z } from 'zod';
import { CustomColumn, IssueColumn } from './home.js';
import { TqlText } from './search.js';

/** At most this many issues go into one export (T-QRY-09, E-111). */
export const ISSUE_EXPORT_LIMIT = 10_000;

export const ISSUE_EXPORT_FORMATS = ['csv', 'xlsx', 'json'] as const;
export type IssueExportFormat = (typeof ISSUE_EXPORT_FORMATS)[number];

export const IssueExportRequest = z
  .object({
    query: TqlText.default(''),
    format: z.enum(ISSUE_EXPORT_FORMATS),
    /** Columns after key and summary, as in result lists. */
    columns: z
      .array(z.union([IssueColumn, CustomColumn]))
      .max(60)
      .default([]),
    /** Headings for key, summary and the columns, in the caller's language; TQL names otherwise. */
    headings: z.array(z.string().max(200)).max(62).optional(),
  })
  .meta({ id: 'IssueExportRequest' });
export type IssueExportRequest = z.infer<typeof IssueExportRequest>;

/** Pages: Word, Markdown (ZIP with attachments) or one HTML file (W-EXP-02/03). */
export const PAGE_EXPORT_FORMATS = ['docx', 'markdown', 'html'] as const;
export type PageExportFormat = (typeof PAGE_EXPORT_FORMATS)[number];

/** Spaces: a ZIP of Markdown or HTML files with the attachments. */
export const SPACE_EXPORT_FORMATS = ['markdown', 'html'] as const;
export type SpaceExportFormat = (typeof SPACE_EXPORT_FORMATS)[number];

export const PageExportQuery = z.object({
  /** With the published child pages, depth first. */
  children: z.enum(['true', 'false']).default('false'),
  locale: z.enum(['de', 'en']).default('de'),
});
export type PageExportQuery = z.infer<typeof PageExportQuery>;

export const SpaceExportQuery = z.object({ locale: z.enum(['de', 'en']).default('de') });
export type SpaceExportQuery = z.infer<typeof SpaceExportQuery>;
