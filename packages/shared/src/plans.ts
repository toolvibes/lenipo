import { z } from 'zod';
import { Id } from './identity.js';
import { TqlText } from './search.js';
import { TimelineEpic } from './timeline.js';
import { StoryPoints, UserRef } from './tracking.js';

/**
 * Cross-project plans with capacity and what-if scenarios (T-RDM-03, T-RDM-04, TL-46, E-136):
 * several projects, optionally narrowed by TQL; everyone sees only the issues they may browse.
 */
export const PlanSummary = z
  .object({
    id: Id,
    name: z.string(),
    description: z.string(),
    owner: UserRef.nullable(),
    /** The plan's projects the caller may browse. */
    projects: z.array(z.object({ key: z.string(), name: z.string() })),
    /** The owner and administrators change the plan and its scenarios. */
    canEdit: z.boolean(),
  })
  .meta({ id: 'PlanSummary' });
export type PlanSummary = z.infer<typeof PlanSummary>;

export const Plan = PlanSummary.extend({ tql: z.string() }).meta({ id: 'Plan' });
export type Plan = z.infer<typeof Plan>;

const PlanName = z.string().trim().min(1).max(120);

export const CreatePlanRequest = z
  .object({
    name: PlanName,
    description: z.string().max(2000).default(''),
    projectKeys: z.array(z.string().trim().min(1).max(20)).min(1).max(50),
    /** Narrows the plan's issues; empty for all of them. */
    tql: TqlText.default(''),
  })
  .meta({ id: 'CreatePlanRequest' });
export type CreatePlanRequest = z.infer<typeof CreatePlanRequest>;

export const UpdatePlanRequest = CreatePlanRequest.partial().meta({ id: 'UpdatePlanRequest' });
export type UpdatePlanRequest = z.infer<typeof UpdatePlanRequest>;

/** A month as its first day, e.g. 2026-11-01. */
export const PlanMonth = z.iso.date().refine((value) => value.endsWith('-01'), 'First of a month');

export const SetCapacityRequest = z
  .object({
    projectKey: z.string().trim().min(1).max(20),
    month: PlanMonth,
    /** Story points the project's team can take on that month; null removes it. */
    points: z.number().min(0).max(100_000).nullable(),
  })
  .meta({ id: 'SetCapacityRequest' });
export type SetCapacityRequest = z.infer<typeof SetCapacityRequest>;

/** What a scenario changes on an issue; a missing field stays as it is. */
export const ScenarioChange = z
  .object({
    startDate: z.iso.date().nullable(),
    dueDate: z.iso.date().nullable(),
    storyPoints: StoryPoints,
  })
  .partial()
  .meta({ id: 'ScenarioChange' });
export type ScenarioChange = z.infer<typeof ScenarioChange>;

export const PlanScenario = z
  .object({
    id: Id,
    name: z.string(),
    /** Changed issues, by key, with their changes. */
    changes: z.array(z.object({ key: z.string(), change: ScenarioChange })),
  })
  .meta({ id: 'PlanScenario' });
export type PlanScenario = z.infer<typeof PlanScenario>;

export const CreateScenarioRequest = z
  .object({ name: PlanName })
  .meta({ id: 'CreateScenarioRequest' });
export type CreateScenarioRequest = z.infer<typeof CreateScenarioRequest>;

export const PlanView = z
  .object({
    plan: Plan,
    scenarios: z.array(PlanScenario),
    /** The scenario shown, if any; its changes are already in the bars below. */
    scenarioId: Id.nullable(),
    projects: z.array(
      z.object({
        key: z.string(),
        name: z.string(),
        epics: z.array(TimelineEpic),
      }),
    ),
    /** Planned points per project and month (due date, else start date) against capacity. */
    capacity: z.array(
      z.object({
        projectKey: z.string(),
        month: z.iso.date(),
        capacity: z.number().nullable(),
        planned: z.number(),
      }),
    ),
  })
  .meta({ id: 'PlanView' });
export type PlanView = z.infer<typeof PlanView>;

export const ApplyScenarioRequest = z
  .object({
    /** Only these issues; missing for all changes of the scenario. */
    issueKeys: z.array(z.string()).optional(),
  })
  .meta({ id: 'ApplyScenarioRequest' });
export type ApplyScenarioRequest = z.infer<typeof ApplyScenarioRequest>;

export const ApplyScenarioResult = z
  .object({
    applied: z.array(z.string()),
    skipped: z.array(
      z.object({ key: z.string(), reason: z.enum(['forbidden', 'changed', 'gone']) }),
    ),
  })
  .meta({ id: 'ApplyScenarioResult' });
export type ApplyScenarioResult = z.infer<typeof ApplyScenarioResult>;
