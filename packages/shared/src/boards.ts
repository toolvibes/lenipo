import { z } from 'zod';
import { Id } from './identity.js';
import { TqlText } from './search.js';
import { IssueSummary, ProjectKey } from './tracking.js';

export const BoardType = z.enum(['kanban', 'scrum']);
export type BoardType = z.infer<typeof BoardType>;

export const SwimlaneMode = z.enum(['none', 'epic', 'assignee']);
export type SwimlaneMode = z.infer<typeof SwimlaneMode>;

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

export const BoardData = z
  .object({
    board: Board,
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
