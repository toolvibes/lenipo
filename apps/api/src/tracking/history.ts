import type { Principal } from '../core/http/principal.js';
import type { Executor } from '../db/client.js';
import { issueChangeGroups, issueChangeItems } from '../db/schema/index.js';
import { type ChangedItem, emitIssueEvent } from '../notifications/events.js';

export type Change = ChangedItem;

const HISTORY_TEXT_LIMIT = 1_000;

export function displayText(value: string | null): string | null {
  return value === null ? null : value.slice(0, HISTORY_TEXT_LIMIT);
}

/**
 * Writes one change group (who, when, through what) with its field changes, and the matching
 * outbox event for notifications. `mentions` are people newly mentioned in the description.
 */
export async function recordChanges(
  tx: Executor,
  issueId: string,
  principal: Principal,
  changes: Change[],
  mentions: string[] = [],
  /** A workflow change moved the issue (E-70): shown as such, nobody is notified. */
  migration = false,
): Promise<void> {
  if (changes.length === 0) return;
  const [group] = await tx
    .insert(issueChangeGroups)
    .values({ issueId, authorId: principal.userId, via: migration ? 'workflow' : principal.via })
    .returning({ id: issueChangeGroups.id });
  if (!group) throw new Error('Change group insert returned no row');
  await tx
    .insert(issueChangeItems)
    .values(changes.map((change) => ({ ...change, groupId: group.id })));
  await emitIssueEvent(tx, issueId, principal.userId, {
    type: 'issue.updated',
    items: changes,
    mentions,
    ...(migration ? { migration: true } : {}),
  });
}
