import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { EstimateCard, Estimation } from '@toolvibes/shared';
import { and, asc, eq } from 'drizzle-orm';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { estimationRounds, estimationVotes, users } from '../db/schema/index.js';
import { signalIssue } from '../realtime/signals.js';
import { IssueService } from './issue.service.js';

/**
 * Planning poker on an issue (TL-51, E-134): whoever may edit the issue starts a round, everyone
 * who sees it lays a card face down, the cards turn over together. The result becomes story
 * points through the normal issue update.
 */
@Injectable()
export class EstimationService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(IssueService) private readonly issues: IssueService,
  ) {}

  async get(principal: Principal, key: string): Promise<Estimation | null> {
    const { issue, permissions } = await this.issues.load(principal, key, 'browse');
    return this.present(principal, issue.id, permissions.has('edit-issues'));
  }

  /** Starts a round, or a fresh one: earlier cards go. */
  async start(principal: Principal, key: string): Promise<Estimation | null> {
    const { issue } = await this.issues.load(principal, key, 'edit-issues');
    await this.database.atomic(async () => {
      const db = this.database.db;
      await db.delete(estimationRounds).where(eq(estimationRounds.issueId, issue.id));
      await db
        .insert(estimationRounds)
        .values({ issueId: issue.id, startedById: principal.userId });
    });
    await signalIssue(this.database.db, issue.id);
    return this.present(principal, issue.id, true);
  }

  async vote(principal: Principal, key: string, value: EstimateCard): Promise<Estimation | null> {
    const { issue, permissions } = await this.issues.load(principal, key, 'browse');
    const round = await this.round(issue.id);
    if (!round) throw new ConflictException('No estimation round is open');
    if (round.revealedAt) throw new ConflictException('The cards are already revealed');
    await this.database.db
      .insert(estimationVotes)
      .values({ issueId: issue.id, userId: principal.userId, value })
      .onConflictDoUpdate({
        target: [estimationVotes.issueId, estimationVotes.userId],
        set: { value, votedAt: new Date() },
      });
    await signalIssue(this.database.db, issue.id);
    return this.present(principal, issue.id, permissions.has('edit-issues'));
  }

  async reveal(principal: Principal, key: string): Promise<Estimation | null> {
    const { issue } = await this.issues.load(principal, key, 'edit-issues');
    const [revealed] = await this.database.db
      .update(estimationRounds)
      .set({ revealedAt: new Date() })
      .where(eq(estimationRounds.issueId, issue.id))
      .returning({ issueId: estimationRounds.issueId });
    if (!revealed) throw new ConflictException('No estimation round is open');
    await signalIssue(this.database.db, issue.id);
    return this.present(principal, issue.id, true);
  }

  async end(principal: Principal, key: string): Promise<void> {
    const { issue, permissions } = await this.issues.load(principal, key, 'browse');
    if (!permissions.has('edit-issues')) {
      throw new ForbiddenException('Requires the project permission "edit-issues"');
    }
    await this.database.db.delete(estimationRounds).where(eq(estimationRounds.issueId, issue.id));
    await signalIssue(this.database.db, issue.id);
  }

  private async round(issueId: string) {
    const [round] = await this.database.db
      .select()
      .from(estimationRounds)
      .where(eq(estimationRounds.issueId, issueId));
    return round;
  }

  private async present(
    principal: Principal,
    issueId: string,
    canManage: boolean,
  ): Promise<Estimation | null> {
    const round = await this.round(issueId);
    if (!round) return null;
    const db = this.database.db;
    const [starter] = round.startedById
      ? await db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(eq(users.id, round.startedById))
      : [];
    const votes = await db
      .select({
        userId: users.id,
        displayName: users.displayName,
        value: estimationVotes.value,
      })
      .from(estimationVotes)
      .innerJoin(users, eq(users.id, estimationVotes.userId))
      .where(and(eq(estimationVotes.issueId, issueId)))
      .orderBy(asc(estimationVotes.votedAt));
    const revealed = round.revealedAt !== null;
    return {
      startedBy: starter ?? null,
      startedAt: round.startedAt.toISOString(),
      revealed,
      votes: votes.map((vote) => ({
        user: { id: vote.userId, displayName: vote.displayName },
        value: revealed ? (vote.value as EstimateCard) : null,
      })),
      mine: (votes.find((vote) => vote.userId === principal.userId)?.value as EstimateCard) ?? null,
      canManage,
    };
  }
}
