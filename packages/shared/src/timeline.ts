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
  })
  .meta({ id: 'TimelineMilestone' });
export type TimelineMilestone = z.infer<typeof TimelineMilestone>;

export const Timeline = z
  .object({
    epics: z.array(TimelineEpic),
    milestones: z.array(TimelineMilestone),
  })
  .meta({ id: 'Timeline' });
export type Timeline = z.infer<typeof Timeline>;
