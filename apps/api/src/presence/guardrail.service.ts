import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AgentBudget,
  type AgentUsage,
  BUDGET_METRICS,
  type BudgetMetric,
  type BudgetUsage,
  CLAIM_MINUTES,
  type ReportUsageRequest,
} from '@toolvibes/shared';
import { and, eq, gt, sql } from 'drizzle-orm';
import { AccessService, type AgentPauseState, pausedError } from '../access/access.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  agentBudgetAlerts,
  agentProfiles,
  agentUsage,
  issueClaims,
  users,
} from '../db/schema/index.js';
import { NotificationService } from '../notifications/notification.service.js';

const TODAY = sql`(now() at time zone 'utc')::date`;
const LEVELS = [80, 100] as const;

interface UsageRow extends Record<string, unknown> {
  day_issues: number;
  day_seconds: number;
  day_cost: number | string;
  month_issues: number;
  month_seconds: number;
  month_cost: number | string;
}

const usage = (issues: number, seconds: number, micros: number | string): BudgetUsage => ({
  issues: Number(issues),
  minutes: Math.floor(Number(seconds) / 60),
  cost: Number(micros) / 1_000_000,
});

/**
 * Budgets of agents (TL-98, E-150): Lenipo counts new claims and the time claims are held
 * (from heartbeats), the runner reports cost. At 80 % and 100 % the responsible person hears of
 * it; while a limit is reached, new claims are refused and work already claimed may finish.
 */
@Injectable()
export class GuardrailService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(NotificationService) private readonly notifications: NotificationService,
  ) {}

  async usage(agentId: string): Promise<AgentUsage> {
    const [profile] = await this.database.db
      .select({
        budget: agentProfiles.budget,
        pausedAt: agentProfiles.pausedAt,
        pausedById: agentProfiles.pausedById,
        reason: agentProfiles.pauseReason,
      })
      .from(agentProfiles)
      .where(eq(agentProfiles.userId, agentId));
    if (!profile) throw new NotFoundException('Agent not found');
    const budget = AgentBudget.parse(profile.budget);
    const [row] = [
      ...(await this.database.db.execute<UsageRow>(sql`
        select
          coalesce(sum(issues) filter (where day = ${TODAY}), 0)::int as day_issues,
          coalesce(sum(seconds) filter (where day = ${TODAY}), 0)::int as day_seconds,
          coalesce(sum(cost_micros) filter (where day = ${TODAY}), 0)::bigint as day_cost,
          coalesce(sum(issues), 0)::int as month_issues,
          coalesce(sum(seconds), 0)::int as month_seconds,
          coalesce(sum(cost_micros), 0)::bigint as month_cost
        from agent_usage
        where user_id = ${agentId} and day >= date_trunc('month', ${TODAY})::date`)),
    ];
    const day = usage(row?.day_issues ?? 0, row?.day_seconds ?? 0, row?.day_cost ?? 0);
    const month = usage(row?.month_issues ?? 0, row?.month_seconds ?? 0, row?.month_cost ?? 0);
    const exceeded = (['day', 'month'] as const).flatMap((period) =>
      BUDGET_METRICS.filter((metric) => {
        const limit = budget[period][metric];
        return limit !== null && (period === 'day' ? day : month)[metric] >= limit;
      }).map((metric) => `${period}.${metric}`),
    );
    const paused = profile.pausedAt
      ? {
          at: profile.pausedAt.toISOString(),
          by: profile.pausedById ? await this.ref(profile.pausedById) : null,
          reason: profile.reason,
        }
      : null;
    return { day, month, budget, paused, exceeded };
  }

  private async ref(id: string) {
    const [row] = await this.database.db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, id));
    return row ?? null;
  }

  /** The agent's own Not-Aus; null when it works. */
  pauseOf(userId: string): Promise<AgentPauseState | null> {
    return this.access.agentPause(userId);
  }

  /** Before new work: not paused here and within budget. People always pass. */
  async requireActive(userId: string, projectId?: string): Promise<void> {
    const pause = await this.access.agentPause(userId, projectId);
    if (pause) throw pausedError(pause);
    if (!(await this.access.isAgent(userId))) return;
    const { exceeded } = await this.usage(userId);
    if (exceeded.length > 0) {
      throw new ConflictException({
        type: 'urn:lenipo:problem:budget-exceeded',
        message: `The budget is used up (${exceeded.join(', ')}); work already claimed may finish`,
      });
    }
  }

  /** A newly claimed issue. */
  async countClaim(userId: string): Promise<void> {
    await this.add(userId, { issues: 1 });
  }

  /** The cost of a run, as the runner reports it. */
  async report(principal: Principal, request: ReportUsageRequest): Promise<AgentUsage> {
    if (!(await this.access.isAgent(principal.userId))) {
      throw new NotFoundException('Only agents report usage');
    }
    await this.add(principal.userId, { costMicros: Math.round(request.cost * 1_000_000) });
    return this.usage(principal.userId);
  }

  /**
   * A heartbeat: the time since the previous one counts while the agent holds a claim, at most
   * one claim lease, so a gap without heartbeats is not billed.
   */
  async heartbeat(userId: string, previousAt: Date | null): Promise<void> {
    if (!previousAt || !(await this.access.isAgent(userId))) return;
    const seconds = Math.min(
      Math.floor((Date.now() - previousAt.getTime()) / 1000),
      CLAIM_MINUTES * 60,
    );
    if (seconds <= 0) return;
    const [held] = await this.database.db
      .select({ issueId: issueClaims.issueId })
      .from(issueClaims)
      .where(and(eq(issueClaims.userId, userId), gt(issueClaims.expiresAt, sql`now()`)))
      .limit(1);
    if (held) await this.add(userId, { seconds });
  }

  private async add(
    userId: string,
    amounts: { issues?: number; seconds?: number; costMicros?: number },
  ): Promise<void> {
    // Only agents have budgets.
    if (!(await this.access.isAgent(userId))) return;
    const issues = amounts.issues ?? 0;
    const seconds = amounts.seconds ?? 0;
    const costMicros = amounts.costMicros ?? 0;
    await this.database.db
      .insert(agentUsage)
      .values({ userId, day: TODAY, issues, seconds, costMicros })
      .onConflictDoUpdate({
        target: [agentUsage.userId, agentUsage.day],
        set: {
          issues: sql`${agentUsage.issues} + ${issues}`,
          seconds: sql`${agentUsage.seconds} + ${seconds}`,
          costMicros: sql`${agentUsage.costMicros} + ${costMicros}`,
        },
      });
    await this.alert(userId);
  }

  /** Tells the responsible person once per period, metric and level. */
  private async alert(userId: string): Promise<void> {
    const current = await this.usage(userId);
    const now = new Date().toISOString();
    const reached: Array<{ period: 'day' | 'month'; metric: BudgetMetric; level: number }> = [];
    for (const period of ['day', 'month'] as const) {
      for (const metric of BUDGET_METRICS) {
        const limit = current.budget[period][metric];
        if (limit === null || limit <= 0) continue;
        const share = (current[period][metric] / limit) * 100;
        for (const level of LEVELS) if (share >= level) reached.push({ period, metric, level });
      }
    }
    if (reached.length === 0) return;
    const [profile] = await this.database.db
      .select({ ownerId: agentProfiles.ownerId })
      .from(agentProfiles)
      .where(eq(agentProfiles.userId, userId));
    await this.database.atomic(async () => {
      const db = this.database.db;
      const inserted = await db
        .insert(agentBudgetAlerts)
        .values(
          reached.map(({ period, metric, level }) => ({
            userId,
            period: period === 'day' ? now.slice(0, 10) : now.slice(0, 7),
            metric,
            level,
          })),
        )
        .onConflictDoNothing()
        .returning();
      if (!profile?.ownerId) return;
      // Only the highest new level of each metric and period.
      const highest = new Map<string, (typeof inserted)[number]>();
      for (const alert of inserted) {
        const key = `${alert.period}:${alert.metric}`;
        if ((highest.get(key)?.level ?? 0) < alert.level) highest.set(key, alert);
      }
      for (const alert of highest.values()) {
        await this.notifications.notifyBudget(db, [profile.ownerId], userId, {
          field: alert.metric,
          from: alert.period.length === 10 ? 'day' : 'month',
          to: String(alert.level),
        });
      }
    });
  }
}
