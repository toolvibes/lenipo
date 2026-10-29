import { z } from 'zod';
import { Id } from './identity.js';
import { TqlText } from './search.js';
import { IssueSummary, ProjectKey, SprintState } from './tracking.js';

export const BoardType = z.enum(['kanban', 'scrum']);
export type BoardType = z.infer<typeof BoardType>;

export const SwimlaneMode = z.enum(['none', 'epic', 'assignee']);
export type SwimlaneMode = z.infer<typeof SwimlaneMode>;

/** What a Scrum board adds up in the backlog and reports (T-SPR-08). */
export const EstimationField = z.enum(['storyPoints', 'originalEstimate', 'issueCount']);
export type EstimationField = z.infer<typeof EstimationField>;

const WipLimit = z.number().int().min(0).max(999).nullable();

export const BoardColumn = z
  .object({
    id: Id,
    name: z.string(),
    /** Statuses shown in this column; the first one is where cards land when possible. */
    statusIds: z.array(Id),
    wipMin: WipLimit,
    wipMax: WipLimit,
  })
  .meta({ id: 'BoardColumn' });
export type BoardColumn = z.infer<typeof BoardColumn>;

export const QuickFilter = z
  .object({ id: Id, name: z.string(), query: z.string() })
  .meta({ id: 'QuickFilter' });
export type QuickFilter = z.infer<typeof QuickFilter>;

export const BoardSummary = z
  .object({
    id: Id,
    name: z.string(),
    type: BoardType,
    project: z.object({ key: z.string(), name: z.string() }),
  })
  .meta({ id: 'BoardSummary' });
export type BoardSummary = z.infer<typeof BoardSummary>;

/** A board with its configuration (T-BRD, E-53). */
export const Board = BoardSummary.extend({
  /** TQL conditions; cards are always ordered by the global rank. */
  query: z.string(),
  swimlanes: SwimlaneMode,
  hideDoneAfterDays: z.number().int().nullable(),
  estimation: EstimationField,
  columns: z.array(BoardColumn),
  quickFilters: z.array(QuickFilter),
  /** The caller administers the location project and may configure the board. */
  canConfigure: z.boolean(),
}).meta({ id: 'Board' });
export type Board = z.infer<typeof Board>;

const BoardName = z.string().trim().min(1).max(80);

export const CreateBoardRequest = z
  .object({
    name: BoardName,
    projectKey: ProjectKey,
    type: BoardType.default('kanban'),
    /** Defaults to the location project. */
    query: TqlText.optional(),
  })
  .meta({ id: 'CreateBoardRequest' });
export type CreateBoardRequest = z.infer<typeof CreateBoardRequest>;

export const UpdateBoardRequest = z
  .object({
    name: BoardName,
    query: TqlText,
    swimlanes: SwimlaneMode,
    hideDoneAfterDays: z.number().int().min(1).max(365).nullable(),
    estimation: EstimationField,
    /** The full list in display order; entries without id are new columns. */
    columns: z
      .array(
        z.object({
          id: Id.optional(),
          name: z.string().trim().min(1).max(40),
          statusIds: z.array(Id).max(50),
          wipMin: WipLimit.default(null),
          wipMax: WipLimit.default(null),
        }),
      )
      .min(1)
      .max(20),
    /** The full list in display order. */
    quickFilters: z
      .array(
        z.object({
          id: Id.optional(),
          name: z.string().trim().min(1).max(40),
          query: TqlText.min(1),
        }),
      )
      .max(20),
  })
  .partial()
  .meta({ id: 'UpdateBoardRequest' });
export type UpdateBoardRequest = z.infer<typeof UpdateBoardRequest>;

/** Built-in quick filters; custom ones are given by id. */
export const BUILT_IN_QUICK_FILTERS = ['mine', 'recent'] as const;

export const BoardIssuesQuery = z.object({
  /** Comma-separated: "mine", "recent" and ids of the board's quick filters; combined with AND. */
  filters: z.string().max(2_000).optional(),
});
export type BoardIssuesQuery = z.infer<typeof BoardIssuesQuery>;

// ---------------------------------------------------------------- sprints (E-55)

export const Sprint = z
  .object({
    id: Id,
    boardId: Id,
    name: z.string(),
    goal: z.string(),
    state: SprintState,
    startDate: z.iso.date().nullable(),
    endDate: z.iso.date().nullable(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'Sprint' });
export type Sprint = z.infer<typeof Sprint>;

const SprintName = z.string().trim().min(1).max(80);

export const CreateSprintRequest = z
  .object({
    /** Defaults to "<board> Sprint <n>". */
    name: SprintName.optional(),
    goal: z.string().max(1_000).default(''),
    startDate: z.iso.date().nullable().default(null),
    endDate: z.iso.date().nullable().default(null),
  })
  .meta({ id: 'CreateSprintRequest' });
export type CreateSprintRequest = z.infer<typeof CreateSprintRequest>;

export const UpdateSprintRequest = z
  .object({
    name: SprintName,
    goal: z.string().max(1_000),
    startDate: z.iso.date().nullable(),
    endDate: z.iso.date().nullable(),
  })
  .partial()
  .meta({ id: 'UpdateSprintRequest' });
export type UpdateSprintRequest = z.infer<typeof UpdateSprintRequest>;

export const StartSprintRequest = z
  .object({
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    goal: z.string().max(1_000).optional(),
  })
  .refine((value) => value.startDate <= value.endDate, 'The end is before the start')
  .meta({ id: 'StartSprintRequest' });
export type StartSprintRequest = z.infer<typeof StartSprintRequest>;

export const CompleteSprintRequest = z
  .object({
    /** Where unfinished issues go: the backlog, a new sprint, or a planned sprint by id. */
    moveTo: z.union([z.literal('backlog'), z.literal('new'), Id]).default('backlog'),
  })
  .meta({ id: 'CompleteSprintRequest' });
export type CompleteSprintRequest = z.infer<typeof CompleteSprintRequest>;

export const MoveToSprintRequest = z
  .object({
    issueKeys: z.array(z.string().min(1).max(30)).min(1).max(100),
    /** null moves the issues to the backlog. */
    sprintId: Id.nullable(),
  })
  .meta({ id: 'MoveToSprintRequest' });
export type MoveToSprintRequest = z.infer<typeof MoveToSprintRequest>;

export const BacklogData = z
  .object({
    board: Board,
    /** The active sprint first, then the planned ones in creation order. */
    sprints: z.array(z.object({ sprint: Sprint, issues: z.array(IssueSummary) })),
    /** Not done, not in an open sprint, in rank order (at most 500). */
    backlog: z.array(IssueSummary),
    truncated: z.boolean(),
  })
  .meta({ id: 'BacklogData' });
export type BacklogData = z.infer<typeof BacklogData>;

// ---------------------------------------------------------------- reports (E-56)

export const BurndownPoint = z
  .object({
    at: z.iso.datetime(),
    type: z.enum(['start', 'added', 'removed', 'estimate', 'done', 'reopened', 'now']),
    issueKey: z.string().nullable(),
    /** Change of the remaining value by this event. */
    delta: z.number(),
    remaining: z.number(),
  })
  .meta({ id: 'BurndownPoint' });
export type BurndownPoint = z.infer<typeof BurndownPoint>;

export const Burndown = z
  .object({
    sprint: Sprint,
    /** Story points, seconds of original estimate, or issue count. */
    estimation: EstimationField,
    /** Remaining at the start: the commitment. */
    committed: z.number(),
    /** The planned end, for the guideline. */
    plannedEnd: z.iso.datetime().nullable(),
    points: z.array(BurndownPoint),
  })
  .meta({ id: 'Burndown' });
export type Burndown = z.infer<typeof Burndown>;

export const Velocity = z
  .object({
    estimation: EstimationField,
    /** The last closed sprints, oldest first. */
    sprints: z.array(z.object({ sprint: Sprint, committed: z.number(), completed: z.number() })),
  })
  .meta({ id: 'Velocity' });
export type Velocity = z.infer<typeof Velocity>;

export const SprintReportEntry = z
  .object({
    issue: IssueSummary,
    /** The estimate at completion (closed sprints) or now (running ones). */
    estimate: z.number().nullable(),
    addedAfterStart: z.boolean(),
  })
  .meta({ id: 'SprintReportEntry' });
export type SprintReportEntry = z.infer<typeof SprintReportEntry>;

export const SprintReport = z
  .object({
    sprint: Sprint,
    estimation: EstimationField,
    completed: z.array(SprintReportEntry),
    notCompleted: z.array(SprintReportEntry),
    /** Taken out while the sprint was running. */
    removed: z.array(SprintReportEntry),
  })
  .meta({ id: 'SprintReport' });
export type SprintReport = z.infer<typeof SprintReport>;

export const BoardData = z
  .object({
    board: Board,
    /** Scrum boards show the issues of their active sprint; null if none runs. */
    sprint: Sprint.nullable(),
    /** Cards in rank order; only issues in a status of some column. */
    issues: z.array(IssueSummary),
    /** More issues match than a board shows (500). */
    truncated: z.boolean(),
    /** Statuses each issue can move to now, by issue id; for highlighting drop targets. */
    reachable: z.record(Id, z.array(Id)),
  })
  .meta({ id: 'BoardData' });
export type BoardData = z.infer<typeof BoardData>;

/** Moves a card into a column (transition if needed) and between two cards (rank). */
export const MoveCardRequest = z
  .object({
    issueKey: z.string().min(1).max(30),
    columnId: Id,
    /** The card that will be directly above; null or missing for the top. */
    afterKey: z.string().min(1).max(30).nullable().optional(),
    /** The card that will be directly below; null or missing for the bottom. */
    beforeKey: z.string().min(1).max(30).nullable().optional(),
  })
  .meta({ id: 'MoveCardRequest' });
export type MoveCardRequest = z.infer<typeof MoveCardRequest>;

export const RankIssueRequest = z
  .object({
    afterKey: z.string().min(1).max(30).nullable().optional(),
    beforeKey: z.string().min(1).max(30).nullable().optional(),
  })
  .refine((value) => value.afterKey || value.beforeKey, 'Give afterKey, beforeKey or both')
  .meta({ id: 'RankIssueRequest' });
export type RankIssueRequest = z.infer<typeof RankIssueRequest>;
