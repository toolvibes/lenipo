import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type BlockerRequest,
  CLAIM_MINUTES,
  type Comment,
  type HandoverRequest,
} from '@toolvibes/shared';
import { and, eq, or, sql } from 'drizzle-orm';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { issueClaims, users } from '../db/schema/index.js';
import { requireIssueScope } from '../search/search.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { PresenceService } from './presence.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A name inside `@[…](user:id)`; brackets and backslashes are escaped like the editor does. */
const label = (name: string) => name.replace(/[[\]\\]/g, '\\$&');

/**
 * Handovers and blockers between people and agents (TL-95, E-147): one call writes the comment,
 * moves assignee and claim, or links the blocker and reports the blocked state.
 */
@Injectable()
export class HandoverService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(PresenceService) private readonly presence: PresenceService,
  ) {}

  /**
   * A comment with done, open and notes, marked as handover. With `to` the next one becomes
   * assignee, is mentioned and takes over one's claim; otherwise one's claim ends.
   */
  async handover(principal: Principal, key: string, request: HandoverRequest): Promise<Comment> {
    requireIssueScope(principal, true);
    const issue = await this.issues.get(principal, key);
    const next = request.to ? await this.person(request.to) : null;
    const [author] = await this.database.db
      .select({ locale: users.locale })
      .from(users)
      .where(eq(users.id, principal.userId));
    const german = author?.locale !== 'en';
    const markdown = [
      `**${german ? 'Übergabe' : 'Handover'}**${
        next ? ` ${german ? 'an' : 'to'} @[${label(next.displayName)}](user:${next.id})` : ''
      }`,
      `**${german ? 'Erledigt' : 'Done'}**\n\n${request.done}`,
      request.open ? `**${german ? 'Offen' : 'Open'}**\n\n${request.open}` : null,
      request.notes ? `**${german ? 'Hinweise' : 'Notes'}**\n\n${request.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');
    const comment = await this.issues.addComment(
      principal,
      key,
      { body: { markdown } },
      'handover',
    );
    if (next && issue.assignee?.id !== next.id) {
      await this.issues.update(principal, key, { assigneeId: next.id });
    }
    const own = and(
      eq(issueClaims.issueId, issue.id),
      eq(issueClaims.userId, principal.userId),
      sql`${issueClaims.expiresAt} > now()`,
    );
    if (next) {
      // The work area goes with the claim; the clock starts again.
      await this.database.db
        .update(issueClaims)
        .set({
          userId: next.id,
          claimedAt: sql`now()`,
          expiresAt: sql`now() + make_interval(mins => ${CLAIM_MINUTES})`,
        })
        .where(own);
    } else {
      await this.database.db.delete(issueClaims).where(own);
    }
    return comment;
  }

  /**
   * Reports a blocker: links the blocking issue, writes the note as comment and sets one's
   * heartbeat to blocked on this issue.
   */
  async blocker(principal: Principal, key: string, request: BlockerRequest): Promise<Comment> {
    requireIssueScope(principal, true);
    const issue = await this.issues.get(principal, key);
    const blockedBy = request.blockedBy?.toUpperCase();
    if (blockedBy) {
      try {
        await this.issues.addLink(principal, issue.key, {
          type: 'blocks',
          direction: 'inward',
          issueKey: blockedBy,
        });
      } catch (error) {
        // Already linked that way: the report still counts.
        if (!(error instanceof ConflictException)) throw error;
      }
    }
    const [author] = await this.database.db
      .select({ locale: users.locale })
      .from(users)
      .where(eq(users.id, principal.userId));
    const german = author?.locale !== 'en';
    const heading = german
      ? `**Blockiert${blockedBy ? ` durch ${blockedBy}` : ''}**`
      : `**Blocked${blockedBy ? ` by ${blockedBy}` : ''}**`;
    const comment = await this.issues.addComment(principal, issue.key, {
      body: { markdown: `${heading}\n\n${request.note}` },
    });
    await this.presence.beat(principal, {
      state: 'blocked',
      issueKey: issue.key,
      note: request.note.slice(0, 280),
    });
    return comment;
  }

  /** An active person or agent by id or e-mail. */
  private async person(value: string): Promise<{ id: string; displayName: string }> {
    const [row] = await this.database.db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(
        and(
          eq(users.status, 'active'),
          UUID.test(value)
            ? or(eq(users.id, value), eq(users.email, value.toLowerCase()))
            : eq(users.email, value.toLowerCase()),
        ),
      );
    if (!row) throw new NotFoundException(`Nobody found for "${value}"`);
    return row;
  }
}
