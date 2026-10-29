import { sql } from 'drizzle-orm';
import type { Executor } from '../db/client.js';

/** The NOTIFY channel of realtime signals (E-58). */
export const CHANGES_CHANNEL = 'tasklore_changes';

/**
 * A realtime signal: only ids, the client refetches through the normal API (E-58).
 * Kept far below the 8 kB NOTIFY limit.
 */
export type Signal =
  | { type: 'issue'; issueKey: string; projectKey: string }
  | { type: 'board'; boardId: string }
  | { type: 'notification'; userId: string }
  | { type: 'space'; spaceKey: string }
  | { type: 'page'; pageId: string; spaceKey: string };

/** Sends a signal when the transaction commits; outside a transaction at once. */
export async function signal(db: Executor, payload: Signal): Promise<void> {
  await db.execute(sql`select pg_notify(${CHANGES_CHANNEL}, ${JSON.stringify(payload)})`);
}

/** "This issue changed", with key and project key read in the same transaction. */
export async function signalIssue(db: Executor, issueId: string): Promise<void> {
  await db.execute(sql`
    select pg_notify(${CHANGES_CHANNEL}, json_build_object(
      'type', 'issue', 'issueKey', i.key, 'projectKey', p.key)::text)
    from issues i join projects p on p.id = i.project_id
    where i.id = ${issueId}`);
}
