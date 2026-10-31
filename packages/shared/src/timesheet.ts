import { z } from 'zod';
import { TqlText } from './search.js';
import { UserRef } from './tracking.js';

const Id = z.uuid();
const Day = z.iso.date();

/** One person's week (TL-24, E-105): issues as rows, Monday to Sunday as columns. */
export const TimesheetQuery = z.object({
  /** Whose timesheet; defaults to the caller. */
  user: Id.optional(),
  /** Any day of the week; defaults to today. */
  week: Day.optional(),
});
export type TimesheetQuery = z.infer<typeof TimesheetQuery>;

export const TimesheetCell = z.object({
  date: Day,
  seconds: z.number().int(),
  /** The worklogs behind the sum; a cell with several is edited in the issue's list. */
  worklogIds: z.array(Id),
});
export type TimesheetCell = z.infer<typeof TimesheetCell>;

export const TimesheetRow = z.object({
  issue: z.object({
    key: z.string(),
    summary: z.string(),
    project: z.object({ key: z.string(), name: z.string() }),
  }),
  cells: z.array(TimesheetCell),
  total: z.number().int(),
});
export type TimesheetRow = z.infer<typeof TimesheetRow>;

export const Timesheet = z
  .object({
    user: UserRef,
    /** Monday of the week. */
    week: Day,
    days: z.array(Day),
    rows: z.array(TimesheetRow),
    dayTotals: z.array(z.number().int()),
    total: z.number().int(),
    /** Only one's own timesheet can be changed. */
    editable: z.boolean(),
  })
  .meta({ id: 'Timesheet' });
export type Timesheet = z.infer<typeof Timesheet>;

/** Sets the time of one cell: creates, changes or (with 0) removes the day's worklog. */
export const TimesheetCellRequest = z
  .object({
    issueKey: z.string().min(1).max(30),
    date: Day,
    seconds: z
      .number()
      .int()
      .min(0)
      .max(24 * 3600),
  })
  .meta({ id: 'TimesheetCellRequest' });
export type TimesheetCellRequest = z.infer<typeof TimesheetCellRequest>;

/** A running timer: one per person, kept on the server (E-105). */
export const RunningTimer = z
  .object({
    issue: z.object({ key: z.string(), summary: z.string() }),
    startedAt: z.iso.datetime(),
  })
  .meta({ id: 'RunningTimer' });
export type RunningTimer = z.infer<typeof RunningTimer>;

export const TimerState = z.object({ timer: RunningTimer.nullable() }).meta({ id: 'TimerState' });
export type TimerState = z.infer<typeof TimerState>;

export const StopTimerRequest = z
  .object({ comment: z.string().max(2_000).default('') })
  .meta({ id: 'StopTimerRequest' });
export type StopTimerRequest = z.infer<typeof StopTimerRequest>;

export const TIME_GROUPS = ['issue', 'project', 'person', 'epic'] as const;
export const TimeGroup = z.enum(TIME_GROUPS);
export type TimeGroup = z.infer<typeof TimeGroup>;
export const TIME_PERIODS = ['none', 'day', 'week', 'month'] as const;
export const TimePeriod = z.enum(TIME_PERIODS);
export type TimePeriod = z.infer<typeof TimePeriod>;

/** Logged time of a query's issues, grouped and per period (T-TIM-05). */
export const TimePivotRequest = z
  .object({
    query: TqlText,
    from: Day,
    to: Day,
    groupBy: TimeGroup.default('person'),
    period: TimePeriod.default('week'),
  })
  .meta({ id: 'TimePivotRequest' });
export type TimePivotRequest = z.infer<typeof TimePivotRequest>;

export const TimePivot = z
  .object({
    /** Period starts (day, Monday or first of month); one "total" column without periods. */
    columns: z.array(z.string()),
    rows: z.array(
      z.object({
        key: z.string().nullable(),
        label: z.string(),
        values: z.array(z.number().int()),
        total: z.number().int(),
      }),
    ),
    totals: z.array(z.number().int()),
    total: z.number().int(),
  })
  .meta({ id: 'TimePivot' });
export type TimePivot = z.infer<typeof TimePivot>;
