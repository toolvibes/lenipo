import { z } from 'zod';
import { EstimationField } from './boards.js';
import { TqlText } from './search.js';
import { UserRef } from './tracking.js';

const Id = z.uuid();
const Days = z.number().int().min(7).max(365).default(30);

/** Fields that statistics gadgets count by. */
export const STATISTIC_FIELDS = [
  'status',
  'statusCategory',
  'priority',
  'assignee',
  'reporter',
  'issueType',
  'project',
  'resolution',
  'component',
  'label',
] as const;
export const StatisticField = z.enum(STATISTIC_FIELDS).meta({ id: 'StatisticField' });
export type StatisticField = z.infer<typeof StatisticField>;

export const StatisticsRequest = z
  .object({ query: TqlText, x: StatisticField, y: StatisticField.optional() })
  .meta({ id: 'StatisticsRequest' });
export type StatisticsRequest = z.infer<typeof StatisticsRequest>;

/** One value of a counted field; key null means "none" (unassigned, no component …). */
export const StatisticValue = z
  .object({ key: z.string().nullable(), label: z.string(), color: z.string().nullable() })
  .meta({ id: 'StatisticValue' });
export type StatisticValue = z.infer<typeof StatisticValue>;

export const Statistics = z
  .object({
    /** Matching issues; with label or component one issue may count in several rows. */
    total: z.number().int(),
    x: z.array(StatisticValue),
    y: z.array(StatisticValue).nullable(),
    /** counts[xIndex][yIndex], or counts[xIndex][0] without y. */
    counts: z.array(z.array(z.number().int())),
  })
  .meta({ id: 'Statistics' });
export type Statistics = z.infer<typeof Statistics>;

export const CreatedResolvedRequest = z
  .object({ query: TqlText, days: z.number().int().min(7).max(365).default(30) })
  .meta({ id: 'CreatedResolvedRequest' });
export type CreatedResolvedRequest = z.infer<typeof CreatedResolvedRequest>;

export const CreatedResolved = z
  .object({
    points: z.array(
      z.object({ date: z.iso.date(), created: z.number().int(), resolved: z.number().int() }),
    ),
  })
  .meta({ id: 'CreatedResolved' });
export type CreatedResolved = z.infer<typeof CreatedResolved>;

/** Fields whose history is kept and can be shown over time (TL-21, E-102). */
export const SERIES_FIELDS = [
  'status',
  'statusCategory',
  'priority',
  'assignee',
  'issueType',
] as const;
export const SeriesField = z.enum(SERIES_FIELDS).meta({ id: 'SeriesField' });
export type SeriesField = z.infer<typeof SeriesField>;

export const FieldSeriesRequest = z
  .object({ query: TqlText, field: SeriesField.default('status'), days: Days })
  .meta({ id: 'FieldSeriesRequest' });
export type FieldSeriesRequest = z.infer<typeof FieldSeriesRequest>;

/** Issues per value of a field at the end of each day, rebuilt from the history (CFD). */
export const FieldSeries = z
  .object({
    dates: z.array(z.iso.date()),
    values: z.array(StatisticValue),
    /** counts[valueIndex][dayIndex] */
    counts: z.array(z.array(z.number().int())),
    /** True when the query matched more issues than are counted. */
    truncated: z.boolean(),
  })
  .meta({ id: 'FieldSeries' });
export type FieldSeries = z.infer<typeof FieldSeries>;

export const PeriodRequest = z.object({ query: TqlText, days: Days }).meta({ id: 'PeriodRequest' });
export type PeriodRequest = z.infer<typeof PeriodRequest>;

const Spread = z.object({
  average: z.number().nullable(),
  median: z.number().nullable(),
  p85: z.number().nullable(),
});

/** Lead time (created → resolved) and cycle time (first "in progress" → resolved) in days. */
export const ControlChart = z
  .object({
    points: z.array(
      z.object({
        key: z.string(),
        summary: z.string(),
        resolvedAt: z.iso.datetime(),
        leadDays: z.number(),
        /** Null when the issue never was in a status of the "in progress" category. */
        cycleDays: z.number().nullable(),
      }),
    ),
    lead: Spread,
    cycle: Spread,
    truncated: z.boolean(),
  })
  .meta({ id: 'ControlChart' });
export type ControlChart = z.infer<typeof ControlChart>;

/** Open issues and their average age at the end of each day. */
export const AverageAge = z
  .object({
    points: z.array(
      z.object({ date: z.iso.date(), open: z.number().int(), averageDays: z.number() }),
    ),
    truncated: z.boolean(),
  })
  .meta({ id: 'AverageAge' });
export type AverageAge = z.infer<typeof AverageAge>;

export const ScopeProgressRequest = z
  .object({
    /** The board whose closed sprints and estimation are used. */
    boardId: Id,
    /** The issues of the release or epic, e.g. `fixVersion = "1.0"` or `parent = TL-19`. */
    query: TqlText,
  })
  .meta({ id: 'ScopeProgressRequest' });
export type ScopeProgressRequest = z.infer<typeof ScopeProgressRequest>;

/** Release burndown and epic report: scope and done work per closed sprint, with a forecast. */
export const ScopeProgress = z
  .object({
    estimation: EstimationField,
    sprints: z.array(
      z.object({
        name: z.string(),
        completedAt: z.iso.datetime(),
        scope: z.number(),
        added: z.number(),
        done: z.number(),
        remaining: z.number(),
      }),
    ),
    scope: z.number(),
    done: z.number(),
    remaining: z.number(),
    /** Done work per sprint over the last three closed sprints. */
    velocity: z.number(),
    /** Sprints still needed at that pace; null without velocity. */
    forecastSprints: z.number().int().nullable(),
  })
  .meta({ id: 'ScopeProgress' });
export type ScopeProgress = z.infer<typeof ScopeProgress>;

export const TimeReportRequest = z
  .object({
    query: TqlText,
    /** Worklogs from this day on (inclusive) … */
    from: z.iso.date(),
    /** … up to this day (inclusive). */
    to: z.iso.date(),
  })
  .meta({ id: 'TimeReportRequest' });
export type TimeReportRequest = z.infer<typeof TimeReportRequest>;

export const TimeReport = z
  .object({
    issues: z.array(
      z.object({
        key: z.string(),
        summary: z.string(),
        originalEstimateSeconds: z.number().int().nullable(),
        timeSpentSeconds: z.number().int(),
        remainingEstimateSeconds: z.number().int().nullable(),
        /** Logged in the period. */
        loggedSeconds: z.number().int(),
      }),
    ),
    people: z.array(z.object({ user: UserRef.nullable(), loggedSeconds: z.number().int() })),
    totals: z.object({
      originalEstimateSeconds: z.number().int(),
      timeSpentSeconds: z.number().int(),
      remainingEstimateSeconds: z.number().int(),
      loggedSeconds: z.number().int(),
    }),
    truncated: z.boolean(),
  })
  .meta({ id: 'TimeReport' });
export type TimeReport = z.infer<typeof TimeReport>;

/** A report with its settings, as shown on the reports page, in a gadget or a wiki macro. */
export const ReportConfig = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('cfd'), query: TqlText, days: Days }),
    z.object({ kind: z.literal('field-series'), query: TqlText, field: SeriesField, days: Days }),
    z.object({ kind: z.literal('control-chart'), query: TqlText, days: Days }),
    z.object({ kind: z.literal('average-age'), query: TqlText, days: Days }),
    z.object({ kind: z.literal('created-vs-resolved'), query: TqlText, days: Days }),
    z.object({ kind: z.literal('pie'), query: TqlText, field: StatisticField }),
    z.object({ kind: z.literal('scope-progress'), query: TqlText, boardId: Id }),
    z.object({ kind: z.literal('burnup'), boardId: Id }),
    z.object({ kind: z.literal('time-tracking'), query: TqlText, days: Days }),
  ])
  .meta({ id: 'ReportConfig' });
export type ReportConfig = z.infer<typeof ReportConfig>;
export type ReportKind = ReportConfig['kind'];
export const REPORT_KINDS = [
  'cfd',
  'burnup',
  'control-chart',
  'scope-progress',
  'created-vs-resolved',
  'average-age',
  'field-series',
  'pie',
  'time-tracking',
] as const satisfies readonly ReportKind[];
