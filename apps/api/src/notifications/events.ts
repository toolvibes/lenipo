import type { Executor } from '../db/client.js';
import { domainEvents } from '../db/schema/index.js';

/** A changed field with machine values (for rules) and display values (for people). */
export interface ChangedItem {
  field: string;
  fromValue: string | null;
  toValue: string | null;
  fromDisplay: string | null;
  toDisplay: string | null;
}

/** What happened to an issue; written to the outbox in the transaction of the change (E-44). */
export type IssueEvent =
  | { type: 'issue.created'; mentions: string[] }
  | { type: 'issue.updated'; items: ChangedItem[]; mentions: string[] }
  | {
      type: 'issue.commented';
      commentId: string;
      excerpt: string;
      mentions: string[];
      /** An edit: only people mentioned for the first time are told. */
      edited: boolean;
    }
  | { type: 'issue.comment_deleted'; commentId: string };

export async function emitIssueEvent(
  tx: Executor,
  issueId: string,
  actorId: string | null,
  event: IssueEvent,
): Promise<void> {
  const { type, ...payload } = event;
  await tx.insert(domainEvents).values({ type, issueId, actorId, payload });
}
