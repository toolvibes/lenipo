import type { Principal } from '../core/http/principal.js';
import type { Executor } from '../db/client.js';
import { issueChangeGroups, issueChangeItems } from '../db/schema/index.js';

export interface Change {
  field: string;
  fromValue: string | null;
  fromDisplay: string | null;
  toValue: string | null;
  toDisplay: string | null;
}

const HISTORY_TEXT_LIMIT = 1_000;

export function displayText(value: string | null): string | null {
  return value === null ? null : value.slice(0, HISTORY_TEXT_LIMIT);
}

/** Writes one change group (who, when, through what) with its field changes. */
export async function recordChanges(
  tx: Executor,
  issueId: string,
  principal: Principal,
  changes: Change[],
): Promise<void> {
  if (changes.length === 0) return;
  const [group] = await tx
    .insert(issueChangeGroups)
    .values({ issueId, authorId: principal.userId, via: principal.via })
    .returning({ id: issueChangeGroups.id });
  if (!group) throw new Error('Change group insert returned no row');
  await tx
    .insert(issueChangeItems)
    .values(changes.map((change) => ({ ...change, groupId: group.id })));
}
