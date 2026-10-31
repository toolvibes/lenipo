import { z } from 'zod';
import { Id } from './identity.js';
import { IssueSummary } from './tracking.js';

/**
 * Where a bar sits on the timeline (E-68). `derived` bars come from children or sprints
 * because the issue has no dates of its own; setting dates replaces them.
 */
export const TimelineSpan = z
  .object({
    start: z.iso.date(),
    end: z.iso.date(),
    derived: z.boolean(),
  })
  .meta({ id: 'TimelineSpan' });
export type TimelineSpan = z.infer<typeof TimelineSpan>;

export const TimelineRow = z
  .object({
    issue: IssueSummary,
    /** Null: nothing to place yet. */
    span: TimelineSpan.nullable(),
  })
  .meta({ id: 'TimelineRow' });
export type TimelineRow = z.infer<typeof TimelineRow>;

export const TimelineEpic = TimelineRow.extend({
  /** Done share of the children, by story points when they have any, else by count. */
  progress: z.object({
    done: z.number(),
    total: z.number(),
    unit: z.enum(['points', 'issues']),
  }),
  children: z.array(TimelineRow),
}).meta({ id: 'TimelineEpic' });
export type TimelineEpic = z.infer<typeof TimelineEpic>;

/** A version with a release date, drawn as a diamond (T-RDM-05). */
export const TimelineMilestone = z
  .object({
    id: Id,
    name: z.string(),
    date: z.iso.date(),
    released: z.boolean(),
    /** Timeline issues with this fix version (TL-23). */
    issueKeys: z.array(z.string()),
  })
  .meta({ id: 'TimelineMilestone' });
export type TimelineMilestone = z.infer<typeof TimelineMilestone>;

/** "A blocks B" between two issues of the timeline (T-RDM-02, E-104). */
export const TimelineDependency = z
  .object({
    linkId: Id,
    /** The blocking issue. */
    from: z.string(),
    /** The waiting issue. */
    to: z.string(),
    /** The waiting issue starts before the blocking one ends. */
    conflict: z.boolean(),
  })
  .meta({ id: 'TimelineDependency' });
export type TimelineDependency = z.infer<typeof TimelineDependency>;

/** Something in the plan that cannot work out as drawn. */
export const TimelineConflict = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('dependency'),
      issueKey: z.string(),
      blockerKey: z.string(),
      /** Days the issue starts before its blocker ends. */
      days: z.number().int(),
    }),
    z.object({
      kind: z.literal('milestone'),
      issueKey: z.string(),
      version: z.string(),
      /** Days the issue ends after the release date. */
      days: z.number().int(),
    }),
  ])
  .meta({ id: 'TimelineConflict' });
export type TimelineConflict = z.infer<typeof TimelineConflict>;

export const Timeline = z
  .object({
    epics: z.array(TimelineEpic),
    milestones: z.array(TimelineMilestone),
    dependencies: z.array(TimelineDependency),
    conflicts: z.array(TimelineConflict),
    /** May change versions, e.g. drag a milestone. */
    canEditVersions: z.boolean(),
  })
  .meta({ id: 'Timeline' });
export type Timeline = z.infer<typeof Timeline>;
