import { z } from 'zod';
import { DisplayName, Id } from './identity.js';
import { ProjectPermission, UserRef } from './tracking.js';

/**
 * Agents (TL-92, E-144): accounts of AI agents such as Claude Code or Codex. They are users with
 * the kind "agent": assignable, with roles and history like people, but without a password or
 * sign-in; their responsible person or an administrator creates their tokens.
 */

/** Suggestions for the vendor field; any other name is allowed. */
export const AGENT_VENDORS = [
  'Claude Code',
  'Codex CLI',
  'Gemini CLI',
  'GitHub Copilot',
  'Cursor',
] as const;

const Vendor = z.string().trim().min(1).max(60);
const Model = z.string().trim().max(80);

// Guardrails (TL-98, E-150), needed by the agent itself.

export const AgentPause = z
  .object({
    at: z.iso.datetime(),
    by: UserRef.nullable(),
    reason: z.string(),
  })
  .meta({ id: 'AgentPause' });
export type AgentPause = z.infer<typeof AgentPause>;

export const PauseRequest = z
  .object({ reason: z.string().trim().max(500).default('') })
  .meta({ id: 'PauseRequest' });
export type PauseRequest = z.infer<typeof PauseRequest>;

export const BUDGET_METRICS = ['issues', 'minutes', 'cost'] as const;
export type BudgetMetric = (typeof BUDGET_METRICS)[number];

/** Limits of one period; null: none. Cost is in the currency the runner reports in. */
export const BudgetLimits = z
  .object({
    /** Issues newly claimed. */
    issues: z.number().int().min(0).max(100_000).nullable().default(null),
    /** Minutes holding claims, measured by heartbeats. */
    minutes: z.number().int().min(0).max(1_000_000).nullable().default(null),
    cost: z.number().min(0).max(10_000_000).nullable().default(null),
  })
  .meta({ id: 'BudgetLimits' });
export type BudgetLimits = z.infer<typeof BudgetLimits>;

export const AgentBudget = z
  .object({
    day: BudgetLimits.default({ issues: null, minutes: null, cost: null }),
    month: BudgetLimits.default({ issues: null, minutes: null, cost: null }),
  })
  .meta({ id: 'AgentBudget' });
export type AgentBudget = z.infer<typeof AgentBudget>;

export const Agent = z
  .object({
    id: Id,
    displayName: z.string(),
    vendor: z.string(),
    model: z.string(),
    owner: UserRef.nullable(),
    /** TQL for what the agent may take with claim-next; empty: anything (TL-94, E-146). */
    taskFilter: z.string(),
    /** Where the agent's notifications are sent; null: none (TL-95, E-147). */
    webhookUrl: z.string().nullable(),
    status: z.enum(['active', 'deactivated']),
    /** Not-Aus (TL-98, E-150): set while the agent only reads. */
    paused: AgentPause.nullable(),
    budget: AgentBudget,
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'Agent' });
export type Agent = z.infer<typeof Agent>;

export const CreateAgentRequest = z
  .object({
    displayName: DisplayName,
    vendor: Vendor,
    model: Model.default(''),
    taskFilter: z.string().trim().max(2000).default(''),
    /** The responsible person; the creating administrator when left out. */
    ownerId: Id.optional(),
    /** Groups to join; agents are not in "users" and get projects one by one. */
    groups: z.array(z.string().trim().min(1)).default([]),
  })
  .meta({ id: 'CreateAgentRequest' });
export type CreateAgentRequest = z.infer<typeof CreateAgentRequest>;

export const UpdateAgentRequest = z
  .object({
    displayName: DisplayName.optional(),
    vendor: Vendor.optional(),
    model: Model.optional(),
    taskFilter: z.string().trim().max(2000).optional(),
    ownerId: Id.nullable().optional(),
    budget: AgentBudget.optional(),
  })
  .meta({ id: 'UpdateAgentRequest' });
export type UpdateAgentRequest = z.infer<typeof UpdateAgentRequest>;

// ---------------------------------------------------------------- presence (TL-93, E-145)

export const PRESENCE_STATES = ['active', 'waiting', 'blocked', 'offline'] as const;
export const PresenceState = z.enum(PRESENCE_STATES).meta({ id: 'PresenceState' });
export type PresenceState = z.infer<typeof PresenceState>;

/** A heartbeat older than this counts as offline. */
export const HEARTBEAT_MINUTES = 30;
/** People without a heartbeat count as active while they used Lenipo this recently. */
export const ONLINE_MINUTES = 15;

export const UpdatePresenceRequest = z
  .object({
    state: PresenceState,
    /** The issue being worked on; null clears it, left out keeps it. */
    issueKey: z.string().trim().min(1).max(40).nullable().optional(),
    branch: z.string().trim().max(200).nullable().optional(),
    /** A short line, e.g. what blocks or what is awaited. */
    note: z.string().trim().max(280).optional(),
  })
  .meta({ id: 'UpdatePresenceRequest' });
export type UpdatePresenceRequest = z.infer<typeof UpdatePresenceRequest>;

const IssueBrief = z.object({ key: z.string(), summary: z.string() });

export const Presence = z
  .object({
    state: PresenceState,
    issue: IssueBrief.nullable(),
    branch: z.string().nullable(),
    note: z.string(),
    /** The last heartbeat; null without one. */
    heartbeatAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'Presence' });
export type Presence = z.infer<typeof Presence>;

/** Someone working in a project: with recent activity, open issues or a heartbeat there. */
export const TeamMember = Presence.extend({
  user: UserRef,
  agent: z.boolean(),
  /** The latest of heartbeat, use of Lenipo and changes in the project. */
  lastActivityAt: z.iso.datetime().nullable(),
  /** Open issues assigned in this project. */
  openIssues: z.number().int(),
}).meta({ id: 'TeamMember' });
export type TeamMember = z.infer<typeof TeamMember>;

// ---------------------------------------------------------------- claims (TL-94, E-146)

/** A claim lasts this long and every heartbeat extends it. */
export const CLAIM_MINUTES = 30;

const WorkPath = z.string().trim().min(1).max(300);

export const ClaimRequest = z
  .object({
    /** The branch the work happens on. */
    branch: z.string().trim().max(200).optional(),
    /** Files or folders the work changes, e.g. `apps/web/src/features/` or `packages/shared/**`. */
    paths: z.array(WorkPath).max(50).default([]),
    /** Claim despite overlapping work areas; recorded on the claim. */
    force: z.boolean().default(false),
  })
  .meta({ id: 'ClaimRequest' });
export type ClaimRequest = z.infer<typeof ClaimRequest>;

export const ClaimNextRequest = ClaimRequest.extend({
  /** TQL narrowing the candidates further, besides the agent's own filter. */
  filter: z.string().trim().max(2000).optional(),
}).meta({ id: 'ClaimNextRequest' });
export type ClaimNextRequest = z.infer<typeof ClaimNextRequest>;

export const Claim = z
  .object({
    issue: IssueBrief,
    user: UserRef,
    branch: z.string().nullable(),
    paths: z.array(z.string()),
    /** Claimed despite overlapping work areas. */
    forced: z.boolean(),
    claimedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: 'Claim' });
export type Claim = z.infer<typeof Claim>;

/** A claim, or null when there is none (or nothing fit claim-next). */
export const ClaimResult = z.object({ claim: Claim.nullable() }).meta({ id: 'ClaimResult' });
export type ClaimResult = z.infer<typeof ClaimResult>;

// ---------------------------------------------------------------- collaboration (TL-95, E-147)

const Section = z.string().trim().max(20_000);

export const HandoverRequest = z
  .object({
    /** What is done, Markdown. */
    done: Section.min(1),
    /** What is still missing, Markdown. */
    open: Section.default(''),
    notes: Section.default(''),
    /** The person or agent taking over: id or e-mail; becomes assignee and holds the claim. */
    to: z.string().trim().min(1).max(254).optional(),
  })
  .meta({ id: 'HandoverRequest' });
export type HandoverRequest = z.infer<typeof HandoverRequest>;

export const BlockerRequest = z
  .object({
    /** The issue in the way; linked as "blocks" when given. */
    blockedBy: z.string().trim().min(1).max(40).optional(),
    note: z.string().trim().min(1).max(2000),
  })
  .meta({ id: 'BlockerRequest' });
export type BlockerRequest = z.infer<typeof BlockerRequest>;

export const AgentWebhookRequest = z
  .object({ url: z.url().max(2000) })
  .meta({ id: 'AgentWebhookRequest' });
export type AgentWebhookRequest = z.infer<typeof AgentWebhookRequest>;

/** Returned once when the webhook is set; the secret signs every delivery. */
export const AgentWebhook = z
  .object({ url: z.string(), secret: z.string() })
  .meta({ id: 'AgentWebhook' });
export type AgentWebhook = z.infer<typeof AgentWebhook>;

// ---------------------------------------------------------------- roles and approvals (TL-96, E-148)

/**
 * What an agent does in a project: planners plan, fill and start sprints, coordinators complete
 * them, implementers and testers claim work, reviewers review. Without roles: implementer.
 */
export const AGENT_ROLES = ['planner', 'implementer', 'reviewer', 'tester', 'coordinator'] as const;
export const AgentRole = z.enum(AGENT_ROLES).meta({ id: 'AgentRole' });
export type AgentRole = z.infer<typeof AgentRole>;

export const ProjectAgent = z
  .object({
    agent: UserRef,
    vendor: z.string(),
    /** Empty means implementer. */
    roles: z.array(AgentRole),
  })
  .meta({ id: 'ProjectAgent' });
export type ProjectAgent = z.infer<typeof ProjectAgent>;

export const ProjectAgentSettings = z
  .object({
    /** Agents start and complete sprints only after a person approved it. */
    sprintApproval: z.boolean(),
    /** Statuses agents do not set themselves: a person approves the transition (TL-98). */
    approvalStatuses: z.array(Id),
    /** Not-Aus for all agents of the project (TL-98, E-150). */
    paused: AgentPause.nullable(),
    /** Where an issue moves after a review verdict; null: it stays (TL-97, E-149). */
    reviewStatuses: z.object({ approved: Id.nullable(), changesRequested: Id.nullable() }),
    /** Agents with a role in the project. */
    agents: z.array(ProjectAgent),
  })
  .meta({ id: 'ProjectAgentSettings' });
export type ProjectAgentSettings = z.infer<typeof ProjectAgentSettings>;

export const UpdateProjectAgentSettings = z
  .object({
    sprintApproval: z.boolean().optional(),
    approvalStatuses: z.array(Id).max(50).optional(),
    reviewStatuses: z
      .object({ approved: Id.nullable(), changesRequested: Id.nullable() })
      .optional(),
  })
  .meta({ id: 'UpdateProjectAgentSettings' });
export type UpdateProjectAgentSettings = z.infer<typeof UpdateProjectAgentSettings>;

export const SetAgentRolesRequest = z
  .object({ roles: z.array(AgentRole).max(AGENT_ROLES.length) })
  .meta({ id: 'SetAgentRolesRequest' });
export type SetAgentRolesRequest = z.infer<typeof SetAgentRolesRequest>;

export const SprintApproval = z
  .object({
    id: Id,
    action: z.enum(['start', 'complete']),
    sprint: z.object({ id: Id, name: z.string(), boardId: Id }),
    projectKey: z.string(),
    requestedBy: UserRef,
    status: z.enum(['pending', 'approved', 'rejected']),
    decidedBy: UserRef.nullable(),
    /** Why it was rejected. */
    reason: z.string(),
    createdAt: z.iso.datetime(),
    decidedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'SprintApproval' });
export type SprintApproval = z.infer<typeof SprintApproval>;

export const DecideApprovalRequest = z
  .object({
    approve: z.boolean(),
    reason: z.string().trim().max(2000).default(''),
  })
  .meta({ id: 'DecideApprovalRequest' });
export type DecideApprovalRequest = z.infer<typeof DecideApprovalRequest>;

// ---------------------------------------------------------------- reviews (TL-97, E-149)

export const REVIEW_STATUSES = ['requested', 'approved', 'changes_requested', 'cancelled'] as const;
export const ReviewStatus = z.enum(REVIEW_STATUSES).meta({ id: 'ReviewStatus' });
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export const ReviewRequest = z
  .object({
    id: Id,
    issue: IssueBrief,
    requester: UserRef,
    reviewer: UserRef,
    status: ReviewStatus,
    /** The reviewer's findings, Markdown. */
    verdict: z.string(),
    /** The latest pull request of the issue from the git integration, with the host's review state. */
    pullRequest: z
      .object({
        title: z.string(),
        url: z.string().nullable(),
        state: z.string(),
        review: z.string().nullable(),
      })
      .nullable(),
    createdAt: z.iso.datetime(),
    decidedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'ReviewRequest' });
export type ReviewRequest = z.infer<typeof ReviewRequest>;

export const CreateReviewRequest = z
  .object({
    /** Id or e-mail of the reviewer; left out: a reviewer agent of the project, another vendor first. */
    reviewer: z.string().trim().min(1).max(254).optional(),
  })
  .meta({ id: 'CreateReviewRequest' });
export type CreateReviewRequest = z.infer<typeof CreateReviewRequest>;

export const ReviewVerdictRequest = z
  .object({
    verdict: z.enum(['approved', 'changes_requested']),
    body: z.string().trim().min(1).max(20_000),
  })
  .meta({ id: 'ReviewVerdictRequest' });
export type ReviewVerdictRequest = z.infer<typeof ReviewVerdictRequest>;

// ---------------------------------------------------------------- guardrails (TL-98, E-150)

export const BudgetUsage = z
  .object({ issues: z.number().int(), minutes: z.number().int(), cost: z.number() })
  .meta({ id: 'BudgetUsage' });
export type BudgetUsage = z.infer<typeof BudgetUsage>;

/** What an agent used today and this month (UTC) against its budget, and whether it is paused. */
export const AgentUsage = z
  .object({
    day: BudgetUsage,
    month: BudgetUsage,
    budget: AgentBudget,
    /** The agent's own Not-Aus: it only reads and takes no new work. */
    paused: AgentPause.nullable(),
    /** Limits reached, e.g. `day.issues`; new claims are refused while any is. */
    exceeded: z.array(z.string()),
  })
  .meta({ id: 'AgentUsage' });
export type AgentUsage = z.infer<typeof AgentUsage>;

export const ReportUsageRequest = z
  .object({
    /** What the run cost, in the currency of the budget. */
    cost: z.number().min(0).max(100_000),
  })
  .meta({ id: 'ReportUsageRequest' });
export type ReportUsageRequest = z.infer<typeof ReportUsageRequest>;

export const IssueApproval = z
  .object({
    id: Id,
    issue: IssueBrief,
    projectKey: z.string(),
    toStatus: z.object({ id: Id, name: z.string() }),
    requestedBy: UserRef,
    status: z.enum(['pending', 'approved', 'rejected']),
    decidedBy: UserRef.nullable(),
    reason: z.string(),
    createdAt: z.iso.datetime(),
    decidedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'IssueApproval' });
export type IssueApproval = z.infer<typeof IssueApproval>;

/** Everything waiting for a person's approval where the caller may decide. */
export const PendingApprovals = z
  .object({ sprints: z.array(SprintApproval), issues: z.array(IssueApproval) })
  .meta({ id: 'PendingApprovals' });
export type PendingApprovals = z.infer<typeof PendingApprovals>;

export const AGENT_ACTIVITY_KINDS = ['request', 'change', 'comment', 'review', 'approval'] as const;

/** One entry of an agent's history. */
export const AgentActivity = z
  .object({
    at: z.iso.datetime(),
    kind: z.enum(AGENT_ACTIVITY_KINDS),
    issue: IssueBrief.nullable(),
    /** E.g. `POST /issues/TL-1/claim`, `transition_issue`, `Status: Offen → In Arbeit`. */
    title: z.string(),
    /** The answer of a request, null for the other kinds. */
    status: z.number().int().nullable(),
    /** False for rejected requests and reviews with changes requested. */
    ok: z.boolean(),
    /** Why it was rejected, a comment excerpt, a verdict. */
    detail: z.string(),
  })
  .meta({ id: 'AgentActivity' });
export type AgentActivity = z.infer<typeof AgentActivity>;

export const AgentActivityPage = z
  .object({
    entries: z.array(AgentActivity),
    /** Pass as `before` for older entries; null at the end. */
    next: z.iso.datetime().nullable(),
  })
  .meta({ id: 'AgentActivityPage' });
export type AgentActivityPage = z.infer<typeof AgentActivityPage>;

export const AgentActivityQuery = z.object({
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** Only rejected requests and changes requested. */
  failures: z.stringbool().default(false),
});

/** One agent on the dashboard. */
export const AgentOverview = z
  .object({
    agent: Agent,
    presence: Presence,
    usage: AgentUsage,
    /** Issues it resolved as assignee in the last 7 days. */
    throughput: z.number().int(),
    /** Rejected writing requests and reviews with changes requested, last 7 days. */
    failures: z.number().int(),
    /** Waiting for a person or blocked: on what and since when. */
    question: z
      .object({
        state: z.enum(['waiting', 'blocked']),
        issue: IssueBrief.nullable(),
        note: z.string(),
        since: z.iso.datetime(),
      })
      .nullable(),
  })
  .meta({ id: 'AgentOverview' });
export type AgentOverview = z.infer<typeof AgentOverview>;

/** What an agent may do: groups, projects with permissions and roles, tokens. */
export const AgentRights = z
  .object({
    groups: z.array(z.string()),
    projects: z.array(
      z.object({
        key: z.string(),
        name: z.string(),
        permissions: z.array(ProjectPermission),
        /** Empty means implementer. */
        roles: z.array(AgentRole),
        /** The project's Not-Aus holds its agents. */
        paused: z.boolean(),
      }),
    ),
    tokens: z.array(
      z.object({
        name: z.string(),
        scopes: z.array(z.string()),
        expiresAt: z.iso.datetime().nullable(),
        lastUsedAt: z.iso.datetime().nullable(),
      }),
    ),
  })
  .meta({ id: 'AgentRights' });
export type AgentRights = z.infer<typeof AgentRights>;
